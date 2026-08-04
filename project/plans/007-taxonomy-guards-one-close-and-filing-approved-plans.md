<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-007: Taxonomy from the repo, guards from an audit, one `close`, and approved plans filed

| Field | Value |
|---|---|
| Status | Shipped |
| Created | 2026-08-03 |
| Author | Danilo Borges |
| Depends on | [Plan-005](005-collapse-record-skills-and-make-closure-run.md), [Plan-006](006-plan-progress-nudge-and-state-cleanup.md) |
| Related | [ADR-0004](../adr/0004-budgeted-artifacts-and-guards.md), [ADR-0009](../adr/0009-hooks-as-a-delivery-surface.md) |

<!-- Status lifecycle: Backlog → In Progress → Shipped. The file is never deleted; it is the record. -->

> **Migrated into this repository retroactively on 2026-08-04.** This design was written during a
> plan-mode session on 2026-08-03 and lived only under `~/.claude/plans/`, outside any repository, while
> the work it describes shipped as four task dossiers that closure has since deleted. Everything from
> `## Summary` down to `## Success criteria` is the original document, moved by copying its bytes; its
> wording is preserved, including where it says "all three" of four requests.
>
> The four living sections below the divider are **reconstructed** from that document and from git
> history — they were not maintained while the work happened, which is what the plan template warns makes
> them weak. They are marked where reconstruction was involved. `Created` is the date the design was
> written, not the date this file appeared.

---

## Summary

Four separate requests, kept deliberately apart, that together are what a 0.8.0 release would earn: a
hook that reads a repository's own governance vocabulary instead of hardcoding this one's, the committed
test suite that would have caught its defects, a consistency audit whose findings become guards rather
than prose, the collapse of `close-task` + `close-plan` into a single `close`, and a `PostToolUse` hook
that files an approved plan-mode plan into the repository it belongs to. All four tracks have landed; the
release that makes them reachable from `${CLAUDE_PLUGIN_ROOT}` in any install has not been cut.

## Goals

The four requests are the goals, stated as they were given. Each became one track.

1. **Join the taxonomy finding to the Track 3b debt.** `hooks/plan-progress-nudge.sh` shipped in 0.7.0
   hardcoding *vibe-ops's own* governance vocabulary, and Plan-006 cut its test suite as debt. The fix and
   the test that would have caught it are the same piece of work.
2. **A consistency check of `vibe-ops`.** Requested directly. The repo's validator is green at 10/10, so
   the audit has to look at what no fragment currently looks at.
3. **One `close`, shaped like `new`.** Plan-005 collapsed four `new-*` skills into `/vibe-ops:new <type>`;
   closure was left as two, `close-task` and `close-plan`. Finishing that symmetry.
4. **A post-plan hook** that copies an approved plan-mode plan to its right home and tells the model it
   moved.

## Scope

### In scope

All work lands in this repository, except one optional single-line edit to the umbrella workspace's own
plan template, called out explicitly in Track 1.

### Out of scope

Pushing the 18 unpushed commits and the `vibe-ops--v0.7.0` tag; cutting the 0.8.0 release these four
tasks earn; the slash-commands screenshot in `docs/images/` (needs a running UI); the graphify pipeline,
which another agent owns; task dossiers as a nudge target, still held back by Plan-006 for the same
reason.

## Design

### Why the four were kept separate

The thread running through all three is Plan-006's retrospective finding: *none* of its own verification
caught any of its three defects — each was found by a maintainer's question, by the hook firing for real,
or by `claude plugin tag` at release, because the tests exercised only the paths their author already had
in mind.

### What was verified in the planning turn

**The taxonomy defect is real.** [`hooks/plan-progress-nudge.sh`](../../hooks/plan-progress-nudge.sh)
calls `resolve-governance.sh plan` and extracts **only `DIR`**, discarding `AUTHORITY` — the file that
defines the taxonomy. It then hardcodes vibe-ops's vocabulary twice: the detection
`grep -l '^| Status | In Progress |' … | head -1`, and the four section names plus entry shapes in the
nudge text. Fixture-measured: a plan whose status is `Active`, or in YAML frontmatter, is **not detected**
(safe under-trigger); but a repo that *is* detected while naming its sections differently gets told to
write sections that do not exist — the hook then creates drift instead of preventing it. That matters
because this is a plugin installed into other repos, which is exactly what the umbrella's Plan-001 walks.

**The taxonomy is mechanically derivable, from the template rather than from prose.**
`project/templates/plan.md` carries both facts already, and the copy shipped to other repos
(`skills/repo-setup/templates/project/templates/plan.md`) is **byte-identical** — verified by `diff`, as is
the governance rule:

- line 32 — `<!-- Status lifecycle: Backlog → In Progress → Shipped. … -->` → the active label is the
  middle term
- line 67/77 — `<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->`
  → the living section names are the `##` headings after it

**`ExitPlanMode` carries what a post-plan hook needs.** Read from this session's own transcript: its input
is `{plan, planFilePath}` — `planFilePath` an absolute path under `~/.claude/plans/` — and the outcome is
distinguishable, `toolUseResult` being a JSON object `{"plan": …}` on approval and a string starting
`Error: …` on rejection or "stay in plan mode". **Unverified:** whether `PostToolUse` fires for this tool
at all, and what its `tool_response` looks like. That is Task 004's first step and it gates the design.

**One `planFilePath` serves a whole session.** In this session the single file
`entao-monta-um-plano-delightful-patterson.md` was approved twice, once as Plan-005 and once as Plan-006 —
so any per-session marker keyed to that path would suppress the second copy. Idempotence must key on the
target, not the source.

---

## Tracks

Each track shipped as a task dossier. The dossiers are deleted — that is the task lifecycle, not a loss —
and each track names the commit that still contains its own, so the working log stays reachable.

### Track 1 — Derive the taxonomy from the repository, and commit the gate suite

*Dossier: `project/tasks/001-derive-plan-taxonomy-and-commit-gate-suite.md` — closed and removed.
`git show 5da79e29d64a5acd024916f04f8968752185cdef:project/tasks/001-derive-plan-taxonomy-and-commit-gate-suite.md`*

**Why joined:** the fix and its missing test are one piece of work. Plan-006 records this as its most
expensive open item, *"because both post-install defects are exactly what an extendable suite would have
covered."*

#### Files

- `scripts/resolve-governance.sh` — two new outputs for `plan`
- `hooks/plan-progress-nudge.sh` — consume them; delete the hardcoding
- `project/templates/plan.md` + `skills/repo-setup/templates/project/templates/plan.md` — one end marker
- `scripts/test-plan-progress-nudge.sh` — new, styled on the existing `scripts/test-license-headers.sh`

#### The derivation, in the resolver (ADR-0009 obligation 2: hook and skill call one script)

Add to the `plan` output, sourced from `TPL` which the resolver already resolves:

```
PLAN_ACTIVE=In Progress                                    # or (unknown)
LIVING=Progress|Surprises & Discoveries|Decision Log|…     # or (unknown)
```

`PLAN_ACTIVE` = middle term of the `Status lifecycle:` comment; fall back to the `→` line in the Plan
section of `AUTHORITY`; else `(unknown)`. `LIVING` = the `##` headings between the LIVING SECTIONS start
marker and a **new end marker** added to both templates.

#### The hook's three-tier degradation

| What the repo has | What the hook does |
|---|---|
| Both markers | enumerate the real section names |
| Start marker only (older template) | do not enumerate — name the template: *"the sections below the LIVING SECTIONS divider in `<TPL>`"* |
| Neither, or `PLAN_ACTIVE=(unknown)` | **stay silent** |

Never invent a section name. Detection also becomes tolerant of cell spacing, and `head -1` goes — every
`In Progress` plan in the repo is named, not just the first.

**Regression to accept knowingly:** until a repo's template carries the end marker, the hook drops to
tier 2 there. Ship the marker in vibe-ops's own template in this task, and — *optional, one line, the only
edit outside vibe-ops* — in the umbrella's `project/templates/plan.md`, so the nudge keeps working where
the maintainer actually works.

#### The suite (Plan-006's Track 3b)

`scripts/test-plan-progress-nudge.sh`, self-contained against temp git repos, exit 0/1 like
`test-license-headers.sh`. The 10 gate cases Plan-006 ran ad hoc, **plus the three defects that escaped
it** — those three are the point of committing it:

- first Stop of a session seeds the offset and says nothing (the offset-reset false positive)
- the state sweep never selects its own directory (`-type f`; today only `rm -f`'s refusal to delete a
  directory prevents data loss)
- a repo whose plan status is `Active`, and one whose template lacks the end marker: silence and tier 2,
  never a wrong section name

Plus the invariants already measured once: garbage/empty/missing payloads exit 0 silently, and a turn
that wrote nothing spawns zero `git` processes.

---

### Track 2 — Consistency audit, and a guard for whatever turns out to be mechanical

*Dossier: `project/tasks/002-consistency-audit.md` — closed and removed.
`git show 5da79e29d64a5acd024916f04f8968752185cdef:project/tasks/002-consistency-audit.md`*

**Framing, per ADR-0004:** anything mechanically checkable becomes a fragment in `scripts/checks/`, not a
line in a document. The audit's output is a findings list plus at most one or two new fragments — not a
report nobody reads.

The validator is **10/10 green today**, so the audit looks where no fragment looks:

- **Manifest ↔ manifest ↔ changelog.** `.claude-plugin/plugin.json` `0.7.0`, the `marketplace.json`
  entry `0.7.0`, and the top CHANGELOG heading must agree. Both manifests also carry a duplicated
  `description` and `keywords` that can drift apart silently.
- **`hooks.json` ↔ `hooks/`.** Every registered file exists and every file is registered; and the
  `description` field, which today opens *"Five guards"* — a literal count that Task 003 makes wrong.
- **`skills/` ↔ prose.** Every `/vibe-ops:<name>` named anywhere resolves to a real skill directory. Ten
  distinct mentions across README, skills and shipped templates; the four commands removed in 0.7.0 are
  the drift this catches.
- **Dogfooding drift.** Every file under `skills/repo-setup/templates/` that has a counterpart in this
  repo's own tree must still match it. Verified clean today for the plan template and the governance rule
  — which is exactly why it is worth freezing as a check before Task 001 edits both copies.
- **`references/records/<type>.md`** exists for each of the four types `resolve-governance.sh` names.
- **`--list` composition** matches the fragment files on disk, so a fragment that stops being composed is
  visible.

Findings that are not mechanical go into the dossier and route at closure.

---

### Track 3 — Collapse `close-task` + `close-plan` into one `close`, the way `new` already is

*Dossier: `project/tasks/003-collapse-close-skills.md` — closed and removed.
`git show 5da79e29d64a5acd024916f04f8968752185cdef:project/tasks/003-collapse-close-skills.md`*

**The asymmetry:** `/vibe-ops:new <adr|rfc|plan|task>` is one skill dispatching on an argument, with the
repo resolved once in Step 0. Closure is still two skills — `skills/close-task/` (155 lines + the
`finalize.sh` mechanical tail) and `skills/close-plan/` (107 lines) — that share most of their spine:
find the record, route what the work taught through the promotion test, propagate to living docs, run the
demotion check, close the issue. What genuinely differs is small and belongs in one branch:

| | `task` | `plan` |
|---|---|---|
| Writes back | to the source doc, what actually happened | the retrospective, against the plan's own goals |
| Spawns an ADR | if a hard-to-reverse decision emerged | same |
| Ends with | distil into the issue, **delete** the dossier | close the issue, **keep** the file |

Consistent with ADR-0001: both are *event* skills, and the ADR's "never split into two skills" clause
binds target-state skills only. `finalize.sh` already carries `--plan <path>`, so the shared tail exists;
it moves to `skills/close/finalize.sh` and the existing `70-plugin-root-paths.sh` check catches any path
left behind.

Apply Plan-005's deduplication rule: where the template's own comment already says a thing, the skill
points at the template instead of repeating it.

#### The cost to decide out loud, not discover later

`/vibe-ops:close-task` and `close-plan` are named in **six** files that vibe-ops *ships into other
repositories* — `skills/repo-setup/templates/agents/rules/governance.md`,
`templates/root/GOVERNANCE.md`, and the scaffolded `plan.md` / `task.md` templates. Those copies already
exist in repos this rename cannot reach, where the reference simply dangles. Two options, and the dossier
records which was chosen and why: keep the old names as thin forwarding skills, or take the break and
declare it in the CHANGELOG (0.7.0 already carried one, when four commands were removed). Task 002's
`skills/ ↔ prose` check keeps the in-repo half of that honest afterwards.

And the 0.7.0 lesson applies directly to the new skill's frontmatter: **quote the description.** An
unquoted value containing `": "` loads the skill with empty metadata and no error;
`45-skill-frontmatter.sh` now guards it and `claude plugin validate` is the backstop.

---

### Track 4 — A `PostToolUse` hook on `ExitPlanMode`

*Dossier: `project/tasks/004-post-plan-hook.md` — closed and removed.
`git show 07960eaba6814efa1861312d5d2eb071747f9797:project/tasks/004-post-plan-hook.md`*

#### Step 1 gates the rest: measure

Register a probe hook and dump the raw payload with `claude --plugin-dir .`, the way Plan-006's Track 0
measured `block` vs `additionalContext`. Establish: does `PostToolUse` fire for `ExitPlanMode`; does it
fire on *rejection* as well as approval; what is in `tool_input` and `tool_response`; does
`hookSpecificOutput.additionalContext` reach the model from this event. **If it does not fire, stop and
report** — the design is different work and belongs in a plan, not this dossier.

#### Design (assuming Step 1 confirms)

**Cheap exit first** (ADR-0009 obligation 1): approval only, and only when the approved plan text carries
an H1 *and* a metadata table with a `Status` row. That gate is already authored — `plan-mode-context.sh`
asks the model to use the table only *"if this planning turn is going to produce a durable design record
rather than a one-off change"*. A throwaway plan has no table, so it is never copied. This is what keeps
`project/plans/` from filling with one-off plans.

**Which repository.** Resolving from `cwd`'s git toplevel is wrong in precisely the case that already
happened twice in this session: from an umbrella root it names the umbrella, and the plan-mode hook duly
reported `012` for a plan that was `vibe-ops`'s `005`. So:

1. an optional `| Repository | … |` row in the plan's metadata table, added to both plan templates and to
   `references/records/plan.md`, and requested by `plan-mode-context.sh` — marked *remove this row unless
   planning from a multi-repo workspace root*, like the existing `Depends on` row
2. otherwise `git rev-parse --show-toplevel`

Then re-run the resolver **inside the resolved repo** so the number is that repo's.

**Copy, never move, never overwrite.** Target `$DIR/$NEXT-<slug>.md`, slug derived from the H1. The source
under `~/.claude/plans/` is Claude Code's and stays put — the tool result itself tells the model it can
refer back to it. If the target exists, do nothing and say so. Idempotence keys on the target, because one
`planFilePath` serves a whole session and gets approved more than once.

**Tell the model what happened** via `additionalContext` — the "avisar da movimentação" half, and the part
that makes a wrong guess cheap to correct: which repository was resolved and *how* (declared row vs git
toplevel), the exact target path, that the record is now the copy and edits go there rather than to
`~/.claude/plans/`, that the number in the metadata table may need correcting to the real one, and that the
slug is the hook's guess.

**One policy line must change with it.** `plan-mode-context.sh` currently ends *"saving it into `$PLAN_DIR`
happens only if the user asks, through `/vibe-ops:new plan`"*. After this hook that sentence is false;
leaving it makes two hooks contradict each other in the same session. `/vibe-ops:new plan` keeps its
migration mode for plans written before the hook existed.

---

## Success criteria

**001 → 002 → 003 → 004.** 001 is committed debt and it changes both plan templates; 002 freezes the
dogfooding invariant those edits could break *before* 003 and 004 edit the same files; 003 is the widest
purely textual ripple, so it goes before 004 adds new rows to those templates; 004 builds on the resolver
outputs 001 introduced and is otherwise independent of 003.

- `bash scripts/check-agents-md.sh .` — 10/10 today, must stay green and grow with 002's fragments
- `bash scripts/check-agents-md.sh --self-test` — asserts the new fragments still fail on a broken repo
- `sh scripts/test-plan-progress-nudge.sh` — the new suite, exit 0
- `claude --plugin-dir .` in a scratch repo — ADR-0009 obligation 4; a hook is unreachable from
  `${CLAUDE_PLUGIN_ROOT}` until a release, which Plan-006 proved twice by needing uninstall + cache
  removal + reinstall to test its own code
- `claude plugin validate .` — the only thing in the chain that reads skill frontmatter as YAML, and the
  only thing that caught the 0.7.0 frontmatter bug

Then `/vibe-ops:close-task` on each dossier: write-back, route every `Surprises & Discoveries` entry, run
the demotion check, distil into the issue, delete the dossier.

---

<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->

## Progress

<!-- Reconstructed on 2026-08-04 from git history, not maintained while the work happened. Every entry
     below names the commit it was derived from, so the reconstruction can be checked. -->

- [x] 2026-08-03 Track 1 — taxonomy derived from the repository, gate suite committed (`e0c619b`).
- [x] 2026-08-03 Track 2 — consistency audit; five guards added, one finding investigated and skipped
      (`8dbd880`).
- [x] 2026-08-03 Track 3 — `close-task` + `close-plan` collapsed into one `close` dispatching on
      `task|plan` (`1c8af28`).
- [x] 2026-08-03 Track 4 — `PostToolUse` hook copies an approved plan-mode plan into `project/plans/` and
      reports where it landed (`3df7239`). The measurement in Step 1 must have confirmed `PostToolUse`
      fires for `ExitPlanMode`, since the hook shipped; the measurement itself was recorded in the dossier
      and is reachable only through that dossier's breadcrumb.
- [x] 2026-08-03 All four dossiers closed and removed (`c7ad6fe` for 001–003, `7215244` for 004).
- [x] 2026-08-04 This plan migrated into the repository, retroactively.
- [x] 2026-08-04 CHANGELOG entries written for all four tracks (`49469b3`). Track 3's breaking rename
      carries the consequence the design named and nobody had recorded: repos scaffolded by an older
      version still name `/vibe-ops:close-task` in their `GOVERNANCE.md`, governance rule and templates,
      and this release cannot reach those copies.
- [x] 2026-08-04 0.8.0 cut — `plugin.json`, the `marketplace.json` entry and the CHANGELOG heading all at
      `0.8.0` and agreeing per the `manifest-sync` guard; tagged `vibe-ops--v0.8.0`. Verified before
      cutting: `check-agents-md.sh` 15/15, `--self-test` passing, the nudge suite 18/18, the
      approved-copy suite 12/12, license headers green.
- [x] 2026-08-04 Merged to `main` via [#15](https://github.com/entelekheia-ai/vibe-ops/pull/15) — 30
      commits, 53 files, carrying **two** releases, because **0.7.0 had never been published either**: the
      remote held tags only up to `v0.6.0`. Merged as a merge commit (`4c52274`), not a squash, so both
      release tags remain reachable from `main`.
- [x] 2026-08-04 Ran `/vibe-ops:close plan` — retrospective written against the plan's own goals and
      criteria (including the two criteria that were wrong), all four Surprises entries routed, demotion
      check run and empty, living docs propagated, `check-agents-md.sh` green afterwards. The plan file is
      kept. No tracking issue existed, so there is none to close.

## Surprises & Discoveries

<!-- The first three entries are reconstructed on 2026-08-04 while migrating this plan; they are about the
     migration, and their evidence was gathered then. Anything the four tracks themselves surprised
     anyone with was routed at dossier closure and is not duplicated here. -->

- **Observation:** this plan's own design record was never filed into the repository, and the four
  dossiers that carried fragments of it were deleted at closure — so for a day the only in-repo trace of
  why any of this is shaped the way it is was the deleted-file history.
  **Evidence:** the document lived at `~/.claude/plans/entao-monta-um-plano-delightful-patterson.md`,
  outside any git repository, alongside 45 other plan-mode scratch files. `project/plans/` went
  `001`–`006` with nothing covering these four tracks: Plan-005 explicitly deferred the `close` collapse
  ("`close-task` / `close-plan` are **not merged in this plan**"), Plan-006 cut the gate suite as debt,
  and the audit and the post-plan hook appear in neither.
  **Why it matters:** the repo's own governance calls a plan the permanent design record and a task
  dossier ephemeral. Four tracks sharing one design, one ordering rationale and one release is a plan;
  filing it as four tasks meant closure correctly deleted the only copy of the reasoning.

- **Observation:** Track 4 shipped the hook that exists to prevent exactly this, and the hook would not
  have caught this document.
  **Evidence:** `hooks/plan-approved-copy.sh` gates on the approved plan text carrying an H1 **and** a
  metadata table with a `Status` row — the marker that separates a durable design record from a one-off.
  This document has the H1 and no table, so it would have been classified as a throwaway and skipped.
  **Why it matters:** the gate is a good default and it has a blind spot at the top end — a 262-line
  design that spawns four dossiers and earns a release looks, to the gate, exactly like a one-off. Worth
  weighing before treating the hook as complete coverage.

- **Observation:** all four tracks landed after the 0.7.0 release, and none of them is described in the
  changelog — including a breaking change.
  **Evidence:** `CHANGELOG.md`'s top heading is `## [0.7.0] — 2026-08-03` with no `Unreleased` section;
  `git log` places `e0c619b`, `8dbd880`, `1c8af28` and `3df7239` after `c81b552 chore(release): 0.7.0`.
  Track 3 renamed `/vibe-ops:close-task` and `/vibe-ops:close-plan` out of existence.
  **Why it matters:** 0.7.0 already carried one breaking rename and documented it carefully. This one is
  currently undocumented, and the decision about how to handle the six shipped files that still name the
  old commands (see Open questions) has no recorded answer.

- **Observation:** this plan's own `Success criteria` names the wrong interpreter for one of the two test
  suites, and following it produces a syntax error that is easy to misread as a pass.
  **Evidence:** the criteria say `sh scripts/test-plan-progress-nudge.sh`. All three test scripts declare
  `#!/usr/bin/env bash`. The nudge suite happens to survive `sh` because it uses nothing bash-only, but
  `scripts/test-plan-approved-copy.sh` dies at line 72 on `[[ ... ]]` with process substitution — `sh
  scripts/test-plan-approved-copy.sh` exits **2** having asserted nothing, while `bash` and the shebang
  both give exit 0 and 12/12. Run under either of those, it passes.
  **Why it matters:** it is the failure mode Plan-006's retrospective is about, one layer up. Measuring
  the exit code through a pipe (`sh … | tail`) reports the exit of `tail`, so a first pass at this
  genuinely showed `exit=0` next to a syntax error. A verification list that names the wrong interpreter
  is worse than one that names no command at all, because it produces output that looks like a run.
  The criteria above are the original document's and were left as written; this is the correction.

## Decision Log

- **Decision:** file this work as four task dossiers rather than as a plan. **Reversed on 2026-08-04.**
  **Rationale (original, preserved verbatim):** *"**Records to create:** `project/tasks/` there is empty
  (only `.gitkeep`), so these become `001`–`004` — the repo's first task dossiers. Written from
  `project/templates/task.md`, `Issue | pending`; opening GitHub issues on a public repo is
  outward-facing and stays the maintainer's call."*
  **Why it was reversed:** the reasoning was about where the *work items* belonged, and it was right about
  that — the four dossiers were real tasks. It never asked where the *design* belonged, and the design had
  no home, so it stayed outside the repository and the dossiers took the reasoning with them when they
  were deleted. Filing the plan does not undo the tasks; the two artifacts answer different questions.
  **Date / Author:** 2026-08-03 original, reversed 2026-08-04, Danilo Borges

- **Decision:** migrate with `Status | In Progress`, not `Shipped`.
  **Rationale:** all four tracks landed, but this repo's own rule is that a plugin is installed as a clone
  pinned to a released version, so work that has not been released is unreachable from
  `${CLAUDE_PLUGIN_ROOT}` in every install. Plan-005 was marked `Shipped` only once `vibe-ops--v0.7.0` was
  tagged. The 0.8.0 release these four tracks earn has not been cut, and the changelog entries are not
  written, so `Shipped` would claim delivery that has not happened.
  **Date / Author:** 2026-08-04, Danilo Borges

- **Decision:** drop the absolute machine path the source document opened with, and keep the sentence.
  **Rationale:** the original read *"All work lands in `/Users/…/entelekheia/vibe-ops`"*, which was
  accurate for a document sitting outside the repository. This repository is public
  (`github.com/entelekheia-ai/vibe-ops`), the plan now lives inside the tree it describes, and the
  template's optional `Repository` row exists for the umbrella case and is removed otherwise. The claim it
  carried — that everything lands here except one optional edit to the umbrella's plan template — is
  preserved in `Scope`. The one relative link that pointed *into* `vibe-ops/` from outside was repointed
  to `../../hooks/plan-progress-nudge.sh`; the markdown language server flagged it as unresolvable at the
  moment it was written.
  **Date / Author:** 2026-08-04, Danilo Borges

## Outcomes & Retrospective

**Closed 2026-08-04 as `Shipped`**, released in **0.8.0** (tag `vibe-ops--v0.8.0`) and merged to `main`
via [#15](https://github.com/entelekheia-ai/vibe-ops/pull/15).

### Against the four goals

All four are met and released. The taxonomy is derived from each repository's own template rather than
hardcoded, and the gate suite Plan-006 cut as debt is committed. The audit produced five guards instead of
a findings document, per ADR-0004. Closure is one skill dispatching on `task|plan`. An approved plan-mode
plan is filed into its repository automatically.

### Against the success criteria — including the two that were wrong

- `check-agents-md.sh .` — the criterion predicted "10/10 today, must stay green and grow with 002's
  fragments". It grew by exactly five, to **15/15**. Prediction correct.
- `--self-test` — passes, and now exercises every check rather than composing some that never fire.
- `sh scripts/test-plan-progress-nudge.sh` — **the criterion named the wrong interpreter.** All three
  suites are `bash`; the nudge suite survives `sh` by accident and `test-plan-approved-copy.sh` does not.
  Both pass under `bash` (18/18, 12/12). Wrong in the direction that produces output resembling a run,
  which is the worse direction.
- `claude plugin validate .` — passes. Worth its place: it is the only thing in the chain that reads skill
  frontmatter as YAML, and 0.8.0 ships a brand-new skill, which is exactly the shape of the bug it caught
  at 0.7.0.
- `claude --plugin-dir .` in a scratch repo — **not run at closure, and not runnable here.** It needs an
  interactive session, and this environment cannot launch one. The hooks were exercised through their
  committed suites instead. Recording this as a gap rather than implying coverage: the criterion is
  sound, and it went unmet.

### What the plan did not predict

It was written as four task dossiers and never asked where its own design would live. That question is the
one this record exists to answer, a day late — and it is the retrospective's main finding, not a footnote.
The plan's verification chain was deliberately designed against Plan-006's lesson that tests only exercise
the paths their author already imagined, and still had nothing to say about whether the design record
itself survived the work.

Two facts the closure surfaced that the plan had not: **0.7.0 had never been published either**, so the
merge carried two releases rather than one; and the release tag scheme drifted at 0.7.0 from `vX.Y.Z` to
`vibe-ops--vX.Y.Z` **with no recorded rationale anywhere in the repository**. The second is left open
deliberately — see Open questions.

### What was routed at closure

- Promoted to [`references/records/task.md`](../../references/records/task.md): a design shared by several
  dossiers needs a plan of its own, because closure deletes dossiers and takes the reasoning with them.
  This plan is the evidence.
- **Blocked, with what unblocks it:** the missing-changelog entry is mechanically checkable and by ADR-0004
  should be a guard, not prose — a fragment asserting that commits after the last release tag which touch
  `skills/` or `hooks/` are accompanied by an `Unreleased` section. Not written here because it is new
  work and this closure was scoped to finishing what was open. Unblocked by one fragment under
  `scripts/checks/` plus its `--self-test` fixture.
- Left in place: the hook's gate blind spot is a design question, not a learning, and lives in Open
  questions where it can be answered.
- Sent onward to the workspace: that measuring an exit code through a pipe reports the *pipe's* exit is
  true in any repository, so by the routing table it is not this repo's knowledge.

### Demotion check

Run, and empty. None of the five new guards makes an existing `AGENTS.md` line or rule redundant — the
closest candidate, "the only other place to update is this file's skill table", is **not** covered by
`command-references`, which verifies that `/vibe-ops:<name>` mentions resolve, not that the table is
complete. The line stays.

The retrospective proper is owed at closure. One thing is already clear enough to record: the plan's own
verification chain (`check-agents-md.sh`, `--self-test`, the new suite, `claude --plugin-dir`,
`claude plugin validate`) was designed against Plan-006's finding that tests only exercise the paths
their author already imagined — and it still had nothing to say about whether the design record itself
survived the work. That gap is what this migration closed, a day late.

<!-- ===== END LIVING SECTIONS ===== -->

---

## Open questions

- **Which option was taken for the six files that ship `/vibe-ops:close-task` into other repositories?**
  Track 3 laid out two — keep the old names as thin forwarding skills, or take the break and declare it in
  the changelog — and required the dossier to record which was chosen and why. The dossier is closed and
  the changelog carries no entry, so the answer is currently only inferable from the tree: no forwarding
  skills exist under `skills/`, which reads as the break having been taken silently. Confirm, then write
  the changelog entry.
- **Does `hooks/plan-approved-copy.sh`'s H1-plus-metadata-table gate need a second signal for long design
  documents?** Raised by this plan being invisible to it. Not obviously worth fixing — a looser gate fills
  `project/plans/` with one-off plans, which is the failure the gate was written to prevent.
- **Which release tag scheme does this repository use?** Found at closure: five tags are `vX.Y.Z`
  (`v0.4.0`–`v0.6.0`) and two are `vibe-ops--vX.Y.Z` (`0.7.0`, `0.8.0`). The prefix appeared at 0.7.0 with
  **no rationale recorded anywhere** — Plan-005 and Plan-006 both state the new tag name as a fact and
  never say why — and 0.8.0 followed the most recent example without questioning it. Nothing in
  `README.md`, `AGENTS.md`, `GOVERNANCE.md` or any rule documents a tag convention at all. Both directions
  are defensible: `vX.Y.Z` is the dominant scheme and the prefix carries no information in a repository
  whose name is already the plugin's, while the prefix is forward-looking for a repo that also hosts the
  `entelekheia` marketplace. Whichever is chosen, the fix includes **writing it down**, since the absence
  of a record is what let it drift. Deliberately not resolved inside this closure: retagging published
  refs is new work, and closure is for finishing what was open.

## Related

- [Plan-005](005-collapse-record-skills-and-make-closure-run.md) — collapsed the four `new-*` skills and
  made closure runnable; deferred the `close` collapse that became Track 3.
- [Plan-006](006-plan-progress-nudge-and-state-cleanup.md) — shipped `plan-progress-nudge.sh` with the
  hardcoded taxonomy Track 1 fixed, and cut the gate suite Track 1 committed.
- [ADR-0004](../adr/0004-budgeted-artifacts-and-guards.md) — "a guard, not a line", which is why Track 2's
  output is five check fragments rather than a findings document.
- [ADR-0009](../adr/0009-hooks-as-a-delivery-surface.md) — the obligations Tracks 1 and 4 are written
  against.
