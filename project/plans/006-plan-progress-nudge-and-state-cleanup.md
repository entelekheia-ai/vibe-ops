<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-006: Make the Living Sections Live — a Stop Hook That Attributes the Turn to a Repository

| Field | Value |
|---|---|
| Status | Shipped |
| Created | 2026-08-03 |
| Author | Danilo Borges |
| Related | [Plan-005](005-collapse-record-skills-and-make-closure-run.md) (deferred this) · [ADR-0009](../adr/0009-hooks-as-a-delivery-surface.md) · [ADR-0004](../adr/0004-budgeted-artifacts-and-guards.md) · [research: positioned context and hooks](../research/positioned-context-and-hooks.md) |

---

## Summary

A `Stop` hook that notices a turn changed files in a repository whose plan is `In Progress` while that
plan's living sections stayed untouched, and hands the observation back to the agent that still has tools.
The hook derives **which repository the turn worked in from the files this session wrote**, never from the
working directory — which is what makes it correct in a workspace of independent repositories with several
agents in them at once.

## Context

The governance rule is explicit that four sections of a plan — `Progress`, `Surprises & Discoveries`,
`Decision Log`, `Outcomes & Retrospective` — are maintained *while* the work happens, and that
"reconstructed from memory afterwards they are worthless". Plan-005 is the proof: most of its record was
written at the end, from memory, and its own retrospective says so.

This is the exact gap ADR-0009 admits hooks for. The instruction exists in two places already — the plan
template and the always-on governance rule — and neither can be present *at the moment a turn ends without
having recorded anything*. A line cannot choose when it arrives.

**Plan-005 deferred it for a reason that was wrong.** The deferral cited
`project/learnings/prompt-hooks-cannot-run-where-work-ends.md` as showing a reasoning hook cannot act. The
entry says nothing of the sort — its *How to apply* already prescribes the fix: *"the reasoning has to come
back through `systemMessage` to the main agent, which is the only thing in the loop holding tools."* The
blocker was a misreading of a correct entry, not a limit of the tool.

**The real difficulty is attribution, and it is specific to how this workspace is used.** A gate built on
`git status` in the session's working directory is wrong twice over here: the session is rooted at an
umbrella repository whose subfolders are independent repos, so `cwd` names the wrong one; and several
agents work in those repos concurrently, so a dirty tree is not evidence that *this* session did anything.
Attributing a sibling agent's in-flight work to the user's turn is the same failure mode that makes
`git add -A` forbidden in this workspace.

## Goals

1. A turn that wrote files into a repository with an `In Progress` plan ends with that plan's living
   sections reflecting the turn — or with an explicit statement that there was nothing worth recording.
2. The gate never attributes another agent's changes, or another repository's changes, to this session.
3. After the cheap exits, a turn that wrote nothing costs one string test and one incremental read.
4. The hook is never the only implementation: the same instruction stays in the template and the rule, and
   `close-plan` still checks the sections at closure.

## Scope

### In scope

- `vibe-ops` only. Nothing is written into another repository by this plan.
- `hooks/plan-progress-nudge.sh`, its registration in `hooks/hooks.json`, and the session state it keeps.
- Cleanup of every session state file this plugin writes, including the one `plan-mode-context.sh` already
  leaks. Pulled in because this plan adds a third state file to a plugin that never deleted the first two.
- A reusable attribution helper, `scripts/session-touched-repos.sh` — "which repositories, and which
  files, did this session write to since offset N" — testable on its own, without a hook.
- Fixtures and a test for the gate cases below.
- `AGENTS.md` hooks and scripts rows, `CHANGELOG.md`, and the release, since nothing reaches an install
  until one is cut.

### Out of scope

- **Task dossiers.** Same living sections, same argument, and deliberately held back: covering them makes
  the gate pass in many more turns, and there is no measurement yet of how often a passing gate is a false
  positive. Recorded in Open questions as the next candidate.
- **`SubagentStop`.** A subagent writes into its own transcript; whether its edits should be attributed to
  the parent turn is a separate question.
- **The `prompt` and `agent` hook types.** A `prompt` hook on `Stop` was measured to work, and is rejected
  here on cost (Decision Log). The `agent` type left no trace in an earlier probe and is not needed.
- **The thirteen-events dispute** carried in Plan-005's Open questions. Nothing here depends on it.

## Design

### Attribution comes from the transcript, not from the working directory

The `Stop` payload carries `session_id` and `transcript_path`. The transcript is **per session**, which
makes it the only source that knows what *this* agent wrote. File paths in a transcript are absolute and
appear inside `tool_use` blocks named `Edit` / `Write` / `NotebookEdit`.

```
new bytes since offset  ->  tool_use blocks naming Edit/Write/NotebookEdit  ->  file_path / notebook_path
        ->  git -C <dirname> rev-parse --show-toplevel  ->  the set of repositories this turn wrote to
```

Two properties follow directly, and they are the point of the design:

- **Multi-repo is correct by construction.** The repository comes from the files, so a session rooted at an
  umbrella repo that edits only `vibe-ops/**` is judged against *vibe-ops's* plan.
- **Multi-agent is correct by omission.** `git status` is never consulted. A sibling agent's dirty tree is
  invisible, because it is not in this session's transcript.

`scripts/session-touched-repos.sh <transcript-path> <offset>` prints `OFFSET=<new offset>`, then one
`PATH=<file>` line per distinct file a tracked write reached, then one `REPO=<git toplevel>` line per
distinct repository those files resolve to. `PATH` lines exist so the hook can check whether a plan file
was itself among the writes, without re-deriving that from the raw transcript.

It prefers `jq`, because a transcript line can carry several `tool_use` blocks in one JSON array (parallel
tool calls), and only `jq` can attribute a `file_path` to the block that actually owns it rather than a
`Read`/`Glob` block sharing the same line. Without `jq`, `awk`'s `split()` on a regex delimiter isolates
each `Edit`/`Write`/`NotebookEdit` block before `sed` extracts its path — deliberately not `grep -E`
alternation, and not the `\|` BRE form either: both were tried and dropped (Surprises).

### Session state, and why the offset is what makes it cheap

One file per session, `vibe-ops-progress-<session_id>`, under `${CLAUDE_PLUGIN_DATA:-$TMPDIR}`, holding a
byte offset and which plan (if any) is currently nudged. Each `Stop` reads only the bytes appended since
the last one, so cost is proportional to the turn rather than to the session's age.

Cheap exits, in order, before anything spawns `git`:

1. `stop_hook_active` is true → exit 0. This is the hook's own continuation; never re-fire into a loop.
2. No new bytes since the recorded offset → exit 0 (handled inside the helper itself).
3. No `Edit` / `Write` / `NotebookEdit` record in the new bytes → exit 0 (also inside the helper — it never
   spawns `git` unless it found a tracked write).
4. Already nudged about this exact plan, and it still hasn't been touched → exit 0.

Verified: a turn with no write spawns zero `git` processes; a turn with one write spawns two (one inside
the helper to resolve the file's repository, one inside `resolve-governance.sh` to re-derive that
repository's own toplevel — redundant but harmless, and not worth threading a pre-resolved root through a
script whose other caller, `/new`, always wants it re-derived).

### The judgement stays with the model

For each repository the turn wrote to: resolve its plans directory with the existing
`scripts/resolve-governance.sh` (the hook calls what the skill calls), find a plan whose metadata table
says `In Progress`, and check whether that plan file is itself among the paths this turn wrote. If it is,
the section is being maintained and the hook is silent.

Otherwise the hook returns `{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"…"}}`,
naming the plan file, the four sections, and the two entry shapes the rule defines (`Observation:` /
`Evidence:`; `Decision:` / `Rationale:` / `Date / Author:`). The text must make **declining an explicit,
correct outcome** possible — a turn that produced nothing worth recording should say so and stop, exactly
as the plan-mode injection already lets the model decline the format. `additionalContext` rather than
`decision:block` is what makes that decline possible without fighting the framing (Decision Log).

The hook writes nothing. It has no tools; the agent it hands back to does.

### Re-arming

After nudging, the hook stays silent until the plan file is written to, then re-arms. It therefore never
insists twice about the same state, and does not go quiet for the rest of a long session after one nudge.

### The state file is deleted, by two mechanisms because one is not enough

Nothing in this plugin deleted the session state it wrote before this plan, and that is already true in
production, not just in this design (Surprises). The new file is worse than the existing marker: it
carries an offset and a sentinel rather than being empty, and it is rewritten every turn.

1. **`SessionEnd`**, `hooks/session-state-cleanup.sh`, removes the file keyed to the ending session's
   `session_id`. Deterministic, and checks both possible state directories rather than only the one this
   process resolves `CLAUDE_PLUGIN_DATA` to, because that resolution has been observed to diverge across
   invocations (Open questions) and a no-op `rm -f` costs nothing.
2. **An opportunistic sweep**, folded into `plan-progress-nudge.sh` itself, for what step 1 never gets to —
   a crashed session, a `kill -9`, a machine that slept and never came back. It runs only on a turn that is
   already doing this I/O, so it costs nothing on the turns that exit cheaply: delete sibling `vibe-ops-*`
   state files older than seven days.

There is an honest tension with ADR-0009 here: a cleanup hook delivers neither disk state nor positioned
context, so it does not meet the admission test as written. It is housekeeping for the plugin's own
storage, which no other surface can reach — recorded as a deliberate exception rather than pretending it
qualifies.

### Failure direction

This is the only hook in the plugin that can interrupt a turn, so ADR-0009 obligation 3 is sharper here
than elsewhere: **every unexpected state exits 0 in silence.** Unparseable payload, missing transcript,
`git` absent, resolver missing, a path carrying a quote or a raw newline — all silent, and the
`additionalContext` text is run through the same backslash/quote/newline escape `task-dossier-guard.sh`
uses for its `REASON`, not just a bail-out check on the untrusted half of the string (Surprises).

## Tracks

**Track 0 — Measure the return shapes. Done.** All three `Stop` return shapes measured in a scratch plugin
(`claude --plugin-dir`, `--output-format stream-json --verbose`, `claude-code@2.1.220`): `systemMessage`
never reaches the model; `decision:block` reaches it framed as a denial (a synthetic user turn, "Stop hook
feedback: …"); `hookSpecificOutput.additionalContext` reaches it with no framing at all. Chosen:
`additionalContext`.

**Track 1 — Attribution helper. Done.** `scripts/session-touched-repos.sh`, verified against a synthetic
transcript with `jq` present and with a full PATH shim that excludes only `jq` — both paths produced
byte-identical `OFFSET`/`PATH`/`REPO` output, including correctly ignoring a `file_path`-shaped string
planted inside an `Edit`'s `old_string`.

**Track 2 — The hook. Done.** `hooks/plan-progress-nudge.sh` plus the `Stop` entry in `hooks/hooks.json`.

**Track 2b — State cleanup. Done.** `hooks/session-state-cleanup.sh` (`SessionEnd`) plus the opportunistic
sweep folded into Track 2's hook — written once, so it also covers `plan-mode-context.sh`'s pre-existing
marker.

**Track 3 — The gate cases. Done.** Ten cases run as stdin payloads against fixture repositories:
`stop_hook_active` true; no new bytes; new bytes with no write; a write into a repo with no plans
directory; a write into a repo whose `In Progress` plan was untouched (nudges, naming the plan); a write
that includes the plan itself (silent); a mixed turn writing into two repositories at once (nudges, naming
both); already-nudged-and-unchanged (silent); re-armed after the plan was touched (nudges again); and a
malformed payload. All ten pass, plus an exit-code sweep on garbage/empty/missing-transcript input and a
`git`-spawn count proving a no-write turn spawns zero `git` processes.

**Track 4 — Absorb and release.** `AGENTS.md` hooks and scripts rows, `hooks.json` description,
`CHANGELOG.md`, version bump. Ships together with Plan-005's own still-pending release, or waits for it —
maintainer's call.

## Success criteria

- A session rooted at the workspace that edits only `vibe-ops/**` nudges about **vibe-ops's** `In Progress`
  plan, and never about the workspace's. — met, case E/G.
- A turn in which a sibling agent dirtied another repository, and this session wrote nothing, produces no
  nudge. — met by construction: the gate never reads `git status`, only the transcript.
- A turn that writes the plan file itself is silent. — met, case F.
- `stop_hook_active: true` never produces a nudge, in any state. — met, case A.
- A turn that wrote nothing exits before spawning `git`. — met, measured 0 spawns for a read-only turn
  versus 2 for a real write.
- Every malformed input exits 0 with empty stdout. — met, case J plus a garbage/empty/missing-file sweep.
- After a session ends normally, no state file keyed to its `session_id` remains in either directory. —
  met live: two real `claude --plugin-dir` sessions against a scratch repo, both left no
  `vibe-ops-progress-<session_id>` file behind afterward, in any candidate directory.
- The state directory does not grow across a working day. — the mechanism is confirmed per-session; not yet
  observed over a full real day. This machine's 13 pre-existing stray markers (all predating this hook)
  are swept by the *opportunistic* path specifically, which needs a turn that both writes files and is
  older than the 7-day threshold — not yet observed clearing them for real.
- `bash scripts/check-agents-md.sh .` passes, including `plugin-root-paths` for the new script. — met
  (9/9, unchanged, since neither `hooks.json` nor a `.sh` file is `tracked_md`; the check's own scope is
  markdown-only, a pre-existing gap this plan does not extend).

## Verification

```bash
# the helper, on a synthetic transcript — no session, no hook
sh scripts/session-touched-repos.sh /tmp/fixture.jsonl 0

# the gate, one case per payload (10 cases: stop_hook_active, no-new-bytes,
# read-only, no-plans-dir, untouched-plan, plan-itself, mixed-two-repos,
# already-nudged, re-armed, malformed)
printf '%s' "$(cat /tmp/case-untouched-plan.json)" | sh hooks/plan-progress-nudge.sh

# no-jq, for real: a PATH shim containing every tool except jq
#   (a plain PATH=/usr/bin:/bin does NOT work — jq lives in /usr/bin on macOS)

# git-spawn count: shim git with a counter, diff a no-write turn against a real one

# cleanup: count before, run a session, count after — the number must return
find ~/.claude/plugins/data "${TMPDIR:-/tmp}" -maxdepth 2 -name 'vibe-ops-*' | wc -l

# end to end, against the working tree, since nothing reaches an install before a release
claude --plugin-dir . -p "…"    # in a scratch repo holding an In Progress plan
```

---

<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->

## Progress

- [x] Track 0 — measured `block` vs `systemMessage` vs `additionalContext` on `Stop`; `additionalContext`
      chosen
- [x] Track 1 — `scripts/session-touched-repos.sh`, jq path and no-jq fallback verified identical on a
      synthetic transcript with a spurious `file_path`-shaped substring embedded in an `old_string`
- [x] Track 2 — `hooks/plan-progress-nudge.sh` + the `Stop` entry in `hooks.json`
- [x] Track 2b — `hooks/session-state-cleanup.sh` (`SessionEnd`) + the opportunistic sweep folded into the
      nudge hook; not yet run against this machine's 13 stray markers (that happens for real once the
      release carrying this ships — see Open questions)
- [x] Track 3 — 10/10 gate cases pass, plus an exit-code sweep on garbage/empty/missing-file input and a
      git-spawn count proving a no-write turn spawns zero `git` processes
- [~] Track 3b — **CUT from this plan, carried as debt.** Commit the gate cases as a runnable suite. They were run ad hoc and never committed, so
      nothing can re-run them; two defects found afterwards (sweep `-type f`, offset seeding) are exactly
      what an extendable suite would have caught. See Surprises.
- [x] Observed live after install: hook fires, and its first firing was a false positive (offset seeding),
      now fixed and re-verified. Failure modes re-checked — empty payload, garbage payload and an empty
      transcript all exit 0 silently; `check-agents-md.sh` 9/9.
- [x] Track 4 — `AGENTS.md`, `CHANGELOG.md`, version bump to 0.7.0, tag `vibe-ops--v0.7.0` (unpushed; may ship with
      Plan-005)
- [x] Run `/vibe-ops:close-plan` — retrospective, route every Surprises & Discoveries entry, demotion
      check, close the tracking issue. The plan file itself is kept. Stays unchecked until the plan is
      actually closed; a Progress list that is otherwise complete but has this box open is not finished.

## Surprises & Discoveries

**Observation:** the hook's first real firing was a false positive, and it exposed a property the plan
specified that the implementation had silently dropped.
**Evidence:** with a fresh state file `OFFSET` starts at 0, so the next `Stop` attributes the *entire*
transcript as though it were this turn. Observed live: the offset jumped `0 -> 5,551,350` in one call on a
5.5 MB resumed session, and the nudge named `project/plans/001-repository-baseline-review.md` in the
umbrella repo — correct about the session, wrong about the turn, because those `project/learnings/` writes
happened hours earlier. The design brief had this right ("first Stop: record the baseline, exit silently —
a turn that just started has nothing to record") and the code did not. Fixed: no state file now means seed
`OFFSET` to the current transcript size and return nothing. Verified on a fixture — first `Stop` silent
with `OFFSET` equal to the transcript's exact byte count, a subsequent write still nudges.
**Why this one matters beyond itself:** the gate's cheap-exit chain was tested, and the *seeding* of the
chain was not. Every Track 3 case started from a state file that already existed.

**Observation:** Track 3's "10/10 gate cases pass" cannot be re-run — the cases were never committed.
**Evidence:** `scripts/` holds `test-license-headers.sh` and nothing for this hook; the gate cases were
executed ad hoc in a session whose context was later lost. From the repository's point of view a test that
is not committed did not happen, and the two defects found after it (the sweep's `-type f`, the offset
seeding) are both things a committed suite would have been extended to cover. Recorded as debt, not
re-declared as done.


**Observation:** the opportunistic sweep selected its own state directory, and the only thing preventing a
catastrophe was that `rm -f` refuses directories.
**Evidence:** `CLAUDE_PLUGIN_DATA` resolves to `~/.claude/plugins/data/vibe-ops-<marketplace>`, which
itself matches the sweep's `-name 'vibe-ops-*'` pattern at depth 0 — `find` includes its own starting
point. So `find "$STATE_DIR" -maxdepth 1 -name 'vibe-ops-*' -mtime +7` handed the state directory to `rm`,
which failed into `2>/dev/null`. Harmless today and a trap for tomorrow: anyone "hardening" the sweep with
`-delete` or `rm -rf` would wipe every session's state on the first old-enough run. Fixed by adding
`-type f`, verified against a fixture holding an old file, an old directory and a recent file — only the
old file was removed. Found because the maintainer asked whether the auto-cleaning could have deleted
something, not by any test in Track 3, which had only ever exercised the sweep against files.

**Observation:** a resumed session does not pick up a plugin reinstalled while it was running, even across
a restart — and the failure is silent in both directions.
**Evidence:** `claude plugin details` reports all five hooks registered, and running
`hooks/plan-progress-nudge.sh` by hand with this session's real payload produced a correct, correctly
targeted nudge. But no `vibe-ops-progress-<session_id>` state file was ever written by the harness for this
session, while session `fb092129` — started fresh — has one. The hook was fine; it was simply never
invoked here. A hook that does nothing and a hook that is not loaded look identical from inside the
session.


**Observation:** a `prompt` hook does run on `Stop`, and its reasoning re-enters the conversation.
**Evidence:** a probe plugin side-loaded with `claude --plugin-dir` on `claude-code@2.1.220`, carrying three
`Stop` hooks. The `command` hook ran and captured a payload with `hook_event_name: "Stop"`,
`stop_hook_active: true` and `last_assistant_message`. The `prompt` hook ran: the session had been asked to
reply `ping`, and its final output was instead the word the hook's prompt requested. The `agent` hook left
no trace — it was told to `touch` a file and the file was never created; whether the type was skipped or
ran without tools was not determined.

**Observation:** there are three testable `Stop`-hook return shapes, not two, and the third is a better fit
than either of the ones first compared.
**Evidence:** a probe plugin (`t0-probe`) side-loaded via `claude --plugin-dir`, one `Stop` command hook
whose return shape switched by a `MODE` file, run headless with `--output-format stream-json --verbose`.
`systemMessage` alone produced **one** assistant turn and the injected text never appeared in it
(`num_turns:1`, no token) — it does not reach the model. `decision:block` with a `reason` produced **two**
turns, and the reason arrives as a synthetic **user**-role message, literally `"Stop hook feedback:\n<reason>"`
— visible in the transcript as a denial. `hookSpecificOutput.additionalContext` also produced two turns and
the model acted on the injected text — but with **no synthetic user message at all**; the stream shows only
two `assistant` events, the same way `plan-mode-context.sh` already injects context on `UserPromptSubmit`,
just on `Stop` instead. All three runs exited 0 and did not loop (the probe's own `stop_hook_active` guard,
which the real hook also needs).

**Observation:** the reason Plan-005 gave for deferring this hook was a misreading of the learning it cited.
**Evidence:** `prompt-hooks-cannot-run-where-work-ends.md` does not say a reasoning hook cannot act; its
*How to apply* prescribes exactly this design — the reasoning returns to the main agent, "the only thing in
the loop holding tools". The deferral was not caused by the tool's limits.

**Observation:** the obvious gate — "the repository is dirty" — is wrong in this workspace in two
independent ways, and both were found by the maintainer asking how the hook tells things apart, before any
code existed.
**Evidence:** the session's `cwd` is the umbrella repository, so `git status` there describes the wrong
repo; and other agents edit these repositories concurrently, so a dirty tree is not evidence this session
did anything. The same concurrency is why `git add -A` is already forbidden here.

**Observation:** the plugin already leaks session state, and nothing has ever deleted it.
**Evidence:** `plan-mode-context.sh` writes a per-session marker and no code path removed it before this
plan. Counted on 2026-08-03: 11 markers in `$TMPDIR` (oldest 03:10 the same day) and 2 more in
`~/.claude/plugins/data/vibe-ops-entelekheia/` — the hook falls back to `TMPDIR` when `CLAUDE_PLUGIN_DATA`
is unset, so the same plugin scatters state across two directories. Every file was 0 bytes, so the cost was
inodes and tidiness rather than disk; the file this plan adds is not empty. Found because the maintainer
asked how often the state is deleted — a question the first design had no answer to.

**Observation:** the no-jq fallback needed a real fix, not just a different tool, once tested against an
adversarial fixture.
**Evidence:** the first draft isolated `Edit`/`Write`/`NotebookEdit` blocks with `grep -o` and BRE `\(a\|b\)`
alternation. This machine's `grep` (BSD grep, GNU-compatible 2.6.0-FreeBSD) happens to support `\|`, but
relying on that would repeat the exact BSD-`sed` trap that had already cost time earlier the same day —
untested portability standing in for a guarantee. Rewritten with `awk`'s `split()` on a regex delimiter,
which uses ERE (`|`, no backslash) and is POSIX-portable. Verified against a fixture whose `Edit.old_string`
contains a literal `"file_path":"…"` substring (as this script's own source now does): both the `jq` and the
`awk`/`sed` path produced byte-identical output and did not misattribute the embedded fake path to a repo,
because a nonexistent directory's `git rev-parse` simply fails and is dropped.

**Observation:** end to end against a live `claude --plugin-dir` session, the nudge fired and the model
narrated it unprompted, correctly treating it as declinable; `SessionEnd` cleanup was confirmed against two
real sessions, not just fixtures — but a second live run left the question of per-run reliability open,
because the harness gives no visible signal to tell "the hook didn't fire" apart from "it fired and the
model silently complied."
**Evidence:** in a scratch repo seeded with an `In Progress` plan, a prompt asking the model to write a
file and, separately, to report any injected instruction it saw produced a reply that explicitly named
"Stop hook" and listed Progress/Surprises & Discoveries/Decision Log/Outcomes — the exact section names
from this hook's template text — and explained it was declining because the user's own instruction not to
touch `project/plans/` took precedence. That is exactly the "declining an explicit, correct outcome"
behavior the design asked for, arrived at unprompted. A second run of the same scenario, without asking the
model to narrate, produced a terser "No update needed" with no explicit mention of a hook; replaying that
run's *exact* real transcript directly through the hook (bypassing the live session) reproduced the nudge
byte-for-byte, proving the hook's own logic was correct for that input — so either it fired silently and
the reply's "No update needed" already echoes the hook's own "no entry is needed" line, or the harness did
not deliver it that time. `stream-json --verbose` does not log `Stop`-hook firings as `hook_started`/
`hook_response` the way it does `SessionStart`, so there is no way to distinguish the two from the outside.
Both real sessions' state files were gone afterward in every candidate directory, confirming `SessionEnd`
cleanup ran live, not only in fixtures.

**Observation:** the first draft of the nudge hook would have shipped a JSON-breaking bug.
**Evidence:** `additionalContext`'s text template was written as a shell string with real embedded
newlines, then interpolated directly into `printf '...%s...'` with no escaping — a raw newline inside a
JSON string value is invalid, exactly the class of bug `task-dossier-guard.sh`'s `ESC` pipeline exists to
prevent. Caught by comparing the new code against that existing pattern before any run, not by testing.
Fixed by routing the text through the same backslash/quote/newline escape task-dossier-guard.sh uses.

**Observation:** this plugin's `SessionEnd` cleanup and a *resumed* session combine into the offset reset —
the cleanup is the thing that arms the false positive it took a fix to disarm.
**Evidence:** an audit of every hook on this machine found exactly one `SessionEnd` hook in the entire
system: this plugin's own `session-state-cleanup.sh`. A resume keeps the same `session_id`, so the sequence
is: session ends → the state file for that id is deleted → the session comes back under the same id → the
next `Stop` finds no state → `OFFSET=0` → the whole transcript is attributed to one turn. Deterministic
cleanup and a stable session identity are individually correct and jointly produce a wrong answer. The
offset-seeding fix makes the deletion harmless rather than removing it, which keeps both properties.

## Decision Log

**Decision:** the hook returns `hookSpecificOutput.additionalContext` on `Stop`, not `decision: block`.
**Rationale:** Track 0 measured both reach the model, but `block` arrives framed as a denial — a synthetic
user turn reading "Stop hook feedback: …" — which is wrong for an observation the model must be free to
correctly decline. `additionalContext` delivers the same re-entry with no denial framing, and reuses the
exact mechanism `plan-mode-context.sh` already ships, just on `Stop` instead of `UserPromptSubmit`.
**Date / Author:** 2026-08-03 / Danilo Borges

**Decision:** attribute the turn from the session transcript, not from `cwd` or `git status`.
**Rationale:** the transcript is the only per-session source of what was written. It makes the multi-repo
case correct by construction and the multi-agent case correct by omission. Measured feasible: paths are
absolute and extractable without `jq`, so the hook keeps working when `jq` is absent.
**Date / Author:** 2026-08-03 / Danilo Borges

**Decision:** a `command` hook, not the `prompt` hook that was measured to work.
**Rationale:** ADR-0009 obligation 1 requires a hook to exit on its own condition as its first act. A prompt
hook's first act is a model call, on every turn, in every repository the plugin is installed in. The
mechanical gate costs a string test, and the judgement is delegated to the agent that already holds the
turn in context — where it is free.
**Date / Author:** 2026-08-03 / Danilo Borges

**Decision:** carry the byte offset in the session state file.
**Rationale:** it turns a full transcript re-read into a read of the turn's own bytes. A full re-read is the
cost that got automatic capture rejected on `PreCompact`/`SessionEnd` — paying again for reasoning that was
free while the work happened.
**Date / Author:** 2026-08-03 / Danilo Borges

**Decision:** delete session state two ways — `SessionEnd` plus an opportunistic sweep — rather than either
alone.
**Rationale:** `SessionEnd` is exact but never runs for a session that crashed or was killed, which is the
most likely explanation for the 13 stale markers already on disk. The sweep costs one `find` on a turn that
was already writing, and it is the only thing that collects what `SessionEnd` misses. Accepting the
ADR-0009 tension explicitly: a cleanup hook is housekeeping, not delivery, and is admitted as an exception.
**Date / Author:** 2026-08-03 / Danilo Borges

## Outcomes & Retrospective

**Against the four goals.**

1. *A turn that wrote into a repo with an In Progress plan ends with the sections updated, or an explicit
   statement there was nothing to record.* **Met, and demonstrated on this plan.** Two of the entries in
   Surprises & Discoveries above exist only because the hook asked for them on turns that would otherwise
   have ended silently — including the one describing the hook's own over-triggering.
2. *Never attributes another agent's or another repository's changes to this session.* **Met by
   construction.** `git status` is never consulted; the repo comes from the files this session's transcript
   records. The one false positive observed was the opposite failure — attributing *this* session's own
   older writes to the current turn — and it was the offset, not the attribution.
3. *A turn that wrote nothing costs one string test and one incremental read.* **Met**, measured at zero
   `git` spawns for a read-only turn against two for a real write.
4. *Never the only implementation.* **Met** — the instruction stays in the template and the governance rule,
   and `close-plan` still checks the sections at closure, which is what this ceremony just did.

**What the criteria got wrong.** One acceptance criterion was a bad prediction and is recorded rather than
edited: *"the state directory does not grow across a working day."* The per-session mechanism is confirmed,
but the thirteen pre-existing markers need a turn that both writes files and crosses the seven-day
threshold, so the sweep has still never been observed clearing real accumulated state. The criterion
described an outcome the test could not reach in a day.

**Cut, not silently dropped.** *Track 3b — commit the gate cases as a runnable suite* is **cut from this
plan and carried as debt.** The cases were run ad hoc and never committed, so today they cannot be re-run;
from this repository's point of view they did not happen. This is the plan's most expensive open item,
because both post-install defects are exactly what an extendable suite would have covered. It is not closed
by this ceremony and it is not resolved.

**What actually caught the defects.** Nothing in this plan's own verification did. The sweep selecting its
own state directory, the offset reset on a resumed session, and the broken frontmatter on `skills/new` were
found by, respectively: a maintainer's question, the hook firing for real, and `claude plugin tag` at the
moment of release. The pattern is that each was invisible to a check written by the same person who wrote
the thing being checked — the tests exercised the paths I already had in mind. Two were converted into
guards (`-type f`, `45-skill-frontmatter.sh`); the third became the offset-seeding branch.

**Delivered in 0.7.0**, tagged `vibe-ops--v0.7.0`. Until that tag, every hook in this plan was unreachable
from `${CLAUDE_PLUGIN_ROOT}` in every install — which this plan proved twice over, having twice needed
uninstall + cache removal + reinstall to test its own code.

## Open questions

- **Task dossiers**, on the same gate. Next candidate, held back until there is a false-positive rate to
  look at.
- **Mixed tool records on one line.** Parallel tool calls put several blocks in one transcript record. The
  `jq`/`awk` extraction is scoped per block, but over-inclusion inside one block (e.g. a stray
  `file_path`-shaped string in an `Edit`'s `old_string`) was verified safe rather than eliminated — it only
  ever costs one failed `git rev-parse`.
- **A turn that writes through a shell command** rather than `Edit`/`Write` is invisible to the gate. Silent
  under-triggering, deliberately preferred to a false nudge.
- **A write that is undone in the same turn still arms the gate** — the mirror of the line above, and the
  over-triggering half nobody had written down. Observed: an `Edit` landed on
  `scripts/graphify/health-check`, was reverted with `git checkout --` in the same turn, and the gate still
  nudged, because the transcript records the `Edit` while the shell revert is exactly the kind of write the
  gate cannot see. The asymmetry is structural: reading `Edit`/`Write` records measures *intent to write*,
  not *net effect on the repository*. Cheap partial remedy: consult `git status` for the attributed repo
  **only after** the transcript has already selected it — as a subtractive filter, never as the selector,
  which is the mistake the whole design exists to avoid.
- **The nudge names the written repo's plan, but the lesson may belong to another repo's.** Same
  observation: the gate correctly attributed the turn to the umbrella repo and named its `Plan-001`, while
  what the turn actually taught belonged here, in `vibe-ops`'s `Plan-006`. The hook can identify *that*
  something is worth recording; it cannot know *where*. Left as is — routing is judgement, and handing it
  to the model is the design.
- **How old is stale.** The sweep uses a seven-day threshold with no measurement behind the number. Too
  short deletes a live long-running session's state and makes the hook nudge twice; too long is
  indistinguishable from not sweeping.
- **Why the state landed in two directories.** `CLAUDE_PLUGIN_DATA` is set for some invocations and not
  others, and the fallback quietly diverges instead of failing. `session-state-cleanup.sh` checks both
  directories defensively, but the divergence itself is still not understood.
- **Whether the thirteen pre-existing stray markers actually get swept** once this ships — the cleanup
  code is tested against fixtures, not yet observed clearing real accumulated state on this machine.
