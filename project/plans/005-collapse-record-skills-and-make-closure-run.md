<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-005: Collapse the Record-Creating Skills, Resolve Their Setup Once, and Make Closure Run

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-03 |
| Author | Danilo Borges |
| Related | [research: positioned context and hooks](../research/positioned-context-and-hooks.md) · [ADR-0001](../adr/0001-skill-taxonomy-target-state-vs-event.md) · [ADR-0004](../adr/0004-budgeted-artifacts-and-guards.md) |

---

## Context

The research written earlier today measured how a plugin's instructions actually reach a model. Applying
it to the task half of the lifecycle surfaced three things, and a fourth came out of the interview.

**The four `new-*` skills each re-derive the same facts.** `new-adr`, `new-rfc`, `new-plan` and `new-task`
open with an identical Step 0: a loop to find the artifact directory, a loop to find the template, a
cascade to decide which file is the numbering authority, and — for `new-task` — two more calls to learn
whether the repo is on GitHub and whether `gh` is authenticated. Four to five shell round trips per
invocation, in four copies of the same logic.

**They also restate their own templates.** Measured: 80% of `project/templates/plan.md` and 78% of
`task.md` are HTML guidance comments, one per section. The model reads the template — observable in
`InstructionsLoaded` — and `new-plan`'s Step 5 then rewrites much of the same guidance. The repo's own
guardrail says never keep two copies of a rule: the copy in the `SKILL.md` is the one that goes stale.

**They cost 1,436 characters of a shared budget.** The skill listing is capped at ~8,000 characters
*across every plugin the user has installed*, and `vibe-ops` alone currently spends 3,839 of it — 48%.
That is not this plugin's budget to spend; `context-mode`, `dot-agent` and anything installed later draw
from the same pool. The four record-creating skills are 37% of what `vibe-ops` takes.

**Closure is skipped, and its irreversible step is the one that loses knowledge.** `close-task` exists to
stop a dossier being deleted with its learnings inside it, and its own Step 6 calls the deletion "the only
irreversible action in the skill". The template already carries the marker that says whether closure ran —
an unchecked `## Closure` box — and nothing reads it. The tail of the ceremony is also ordering-sensitive
in a way prose keeps getting wrong.

## Goals

1. One command creates every governance record, and the listing cost of that capability drops by roughly a
   thousand characters, returned to the shared budget.
2. Every path, template, authority file and next number comes from a single resolver, called once.
3. No `SKILL.md` or reference restates what a template's own comments already say.
4. A dossier cannot be deleted while its `## Closure` box is unchecked, and the refusal names the skill
   that ticks it.
5. The mechanical tail of closure — tick, commit, capture sha, delete, commit, write the breadcrumb into
   the source plan, post the summary to the issue — runs as one script, in the one order that yields a
   valid breadcrumb.

## Scope

### In scope

- `vibe-ops` only. Nothing is written into another repository by this plan.
- Collapsing `new-adr` / `new-rfc` / `new-plan` / `new-task` into one `new` skill, with the per-record
  detail moved to `references/`.
- `close-task`, and two hooks.
- The breaking-change surface that follows: README, the slash-commands screenshot, `CHANGELOG.md`, the
  `AGENTS.md` skill table.
- A correction to the plan-mode hook shipped earlier today, which resolves against the wrong repository.
- The ADR that should have preceded shipping the plugin's first always-on surface.

### Out of scope

- **`close-task` / `close-plan` are not merged in this plan**, though the same argument applies to them
  (739 characters between the two). Doing both at once doubles the breaking surface in one release. It is
  recorded in Open questions with its number, as the obvious next candidate.
- `repo-setup` writing an always-on line naming the plan template into target repos. The research says
  that line is probably load-bearing, but the run separating the two explanations was cancelled. Changing
  what gets written into every repository on an unmeasured claim is the mistake this plan exists to avoid.
- `plansDirectory`, and the `Stop` hook for living sections. Both deferred, both recorded elsewhere.

## Design

### One skill, four references

`skills/new/SKILL.md`, `argument-hint: "<adr|rfc|plan|task> <topic>"`. Its body holds only what all four
share: the resolver call, collecting topic and author, the numbering-authority cascade, "read the template,
never reproduce it from memory", the English-output guarantee, and the common checklist.

Everything that diverges moves to `references/records/<type>.md` — one file per record type, which the
skill reads according to its first argument:

| File | What only it holds |
|---|---|
| `references/records/adr.md` | supersession, the `NNNN` / `DA<minor>-<seq>` schemes, immutability once Accepted |
| `references/records/rfc.md` | the Draft→Implemented lifecycle, `implemented/` and `rejected/`, repo-specific extras like an `INDEX.md` |
| `references/records/plan.md` | migration from another format (today's Step 1b), the four living sections, the maintenance-contract handoff (today's Step 7) |
| `references/records/task.md` | the issue/dossier duality, ephemerality, naming by issue number, the `gh` preconditions, and the closure-comment shape observed in practice (see Surprises) |

This is the mechanism the repo already uses — `references/` is defined in `AGENTS.md` as "shared policy the
skills point at instead of restating". The branches do not become conditionals inside one file; they become
four files, and only the one matching the argument is ever read.

The single `description` must carry every trigger the four carried between them — ADR, decision record,
RFC, design proposal, implementation plan, tracks, task, work item, dossier — because the description is
what the model matches against. Budget target: under 400 characters, against 1,436 today.

**This is a breaking change.** `/vibe-ops:new-adr` and its three siblings stop existing. No alias skills:
an alias costs exactly the listing characters this change exists to reclaim. Handled in Track 4.

### The resolver

`scripts/resolve-governance.sh`, one argument (`adr` | `rfc` | `plan` | `task`), printing `KEY=value`:

```
DIR=project/tasks
TPL=project/templates/task.md
AUTHORITY=.agents/rules/governance.md     # or <DIR>/AGENTS.md, or (default)
PAD_WIDTH=3
EXISTING=5
NEXT=006
GH_REMOTE=entelekheia-ai/vibe-ops         # task only; or (none)
GH_AUTH=ok                                # task only; or no / absent
```

**It also prints the reference for that type, inline.** The script already knows the argument, so the
per-record rules do not need a second lookup: one call returns the resolved state *and* the contents of
`references/records/<type>.md`. `--with-template` appends the template too, for the case where the skill is
about to write immediately. The model searches for nothing and reads nothing extra — the same bytes a
`Read` would have cost, minus the round trip and minus the chance of reading the wrong file.

It anchors on `git rev-parse --show-toplevel`, **not** `CLAUDE_PROJECT_DIR` — see Surprises. `NEXT` is
advisory for `task`, whose dossier is named by its issue number when one exists; the skill keeps that rule.
The script reports state, the skill keeps the judgement.

It follows the precedent of `license-setup/get-license.sh` — tooling the plugin *runs* rather than copies,
named in `AGENTS.md` and covered by the `plugin-root-paths` check.

### The hook that calls it

A `UserPromptExpansion` hook invokes the same script when the command is typed, so that path pays no round
trip. **The script is the single implementation; the hook is a second delivery path to it.**
`UserPromptExpansion` fires only on the typed path, and every skill here is deliberately model-invocable —
so the skill's own call is the primary path and the hook is an optimisation, never the mechanism.

Prerequisite, unknown today: what `command_name` carries for a plugin skill — `new` or `vibe-ops:new`.
Track 0 settles it with one probe.

### The closure guard

A `PreToolUse` hook on `Bash`, inspecting commands that delete a file under the tasks directory, deciding
from the dossier's own state:

| Dossier state | Decision |
|---|---|
| `## Closure` box unchecked (`- [ ]`) | **deny**, reason names `/vibe-ops:close-task` and what it does first |
| Box checked (`- [x]`) | allow — closure ran; the deletion is the ceremony's own last step |
| No tasks path in the command | silent exit, no decision |

`deny` rather than `ask`: an `ask` the user approves deletes the dossier with its learnings inside, and the
prompt becomes a formality. The escape hatch is not a permission click — it is running the ceremony, which
ticks the box and makes the deletion legitimate.

This invents no convention. `project/templates/task.md` already ships: *"Stays unchecked until closure
actually runs; a dossier that looks otherwise finished but has this box open is not done."* The guard only
reads it. That is ADR-0004 exactly, and it reads state from disk at the instant of the act — the sole
justification this repository accepts for a hook.

One gap to close: `close-task` Step 6 does not currently instruct ticking the box. Without that, the guard
would block the ceremony itself.

### The closure tail as a script

`skills/close-task/finalize.sh`, invoked by Step 6 *after* the confirmation the skill already requires.
It runs the ordering-sensitive sequence — the breadcrumb sha must come from the commit that still contains
the dossier:

```
0. find every tracked file that links to the dossier  -> the referrer list
1. tick the ## Closure box in the dossier
2. commit <dossier> [+ the source plan if it was written back to]   -> this commit is <sha>
3. sha = git rev-parse HEAD
4. git rm <dossier>
5. rewrite each referrer: the link becomes plain text plus a literal
   "git show <sha>:<dossier path>"; append the same to the source plan
6. commit the deletion together with the rewritten referrers
7. re-run the repo's link check AFTER the deletion
8. print DOSSIER_SHA and PLAN_SHA; if --summary-file was given and an issue is
   linked, post it with `gh issue comment` and print the comment URL
```

Steps 0, 5 and 7 exist because of a failure that already happened — see Surprises. They are also why the
script takes **a list** of dossiers rather than one: real closures here have taken three and four at a
time, and the referrer set has to be computed across the whole batch before any of them is deleted.

Judgement stays in the skill: what the write-back says, which `Surprises` entries survive the promotion
test, whether an ADR is needed, and the text of the executive summary. The script receives that text as a
file and posts it; it never composes it. The issue number is read from the dossier's `Issue:` line and the
plan's `Tracking issue` row rather than passed in.

**But it appends two footers, because those are the two that get forgotten.** Read from the closure
comments already posted in `dot-agent-spec`, the shape that works is: the model's narrative, then

````
```
git show <full 40-char sha>:project/tasks/<slug>.md
```
````

in a fenced block with the **full** sha, and a one-line note that the dossier was removed per the task
lifecycle rather than lost. That second line exists for the same reason as the referrer rewrite: the
absence otherwise reads as a broken repository. Both are mechanical, so the script owns them and the model
cannot omit them.

The narrative itself stays the model's, and `references/records/task.md` should carry the shape observed in
practice rather than invent one: what shipped, per track, with PR links; **outcome against the original
prediction**, including where reality diverged; and **what was routed before the dossier was deleted**,
naming each promoted learning and its destination. That last section is the routing report of Step 5,
written where someone who never reads the dossier will see it.

Three constraints. It stages **only the paths it was given** — other agents work in these repositories
concurrently, and a `git add -A` here has already swept a sibling's in-flight edits into an unrelated
commit. It supports `--dry-run`, printing every command and the breadcrumb it would produce, because
everything from step 4 on is irreversible. And the `gh` call is outward-facing, so it is skipped entirely
under `--dry-run` and reported as skipped.

Writing the breadcrumb into the source plan is new — `close-task` today puts it only in the issue. A task
that came from a plan should leave the pointer where the plan's reader will be.

## Tracks

**Track 0 — Settle the unknown.** One probe session establishing what `command_name` holds for a plugin
skill and confirming a `UserPromptExpansion` hook fires for the typed command. Only the hook half depends
on it; everything else can start in parallel.

**Track 1 — The resolver.** Write `scripts/resolve-governance.sh`; unit-test it against this repo, a repo
using root-level `tasks/`, a repo with no artifact directory, a repo with no GitHub remote, and one where
`gh` is unauthenticated. Ends with a script that answers correctly in all five shapes.

**Track 2 — Collapse to one skill.** Write `skills/new/SKILL.md` and the four
`references/records/<type>.md`. Move each divergent section out of the old skills rather than rewriting it,
and drop from both the skill and the references anything the templates' own comments already say — the
deduplication is done *during* this move, not as a later pass. Delete the four old skill folders. Verify
by creating one record of each type in a scratch repo.

**Track 3 — Wire the hook.** Add the `UserPromptExpansion` entry using what Track 0 learned, pointing at
the resolver from Track 1.

**Track 4 — Absorb the breaking change.** `AGENTS.md` skill table; README; the slash-commands screenshot
in `docs/images/`, which becomes wrong the moment the commands change; `CHANGELOG.md` with an explicit
breaking-change note naming the old commands and the new form. Anything in `repo-setup` or the other
skills that names `/vibe-ops:new-adr` and friends by string.

**Track 5 — The closure half.** The `PreToolUse` guard reading the `## Closure` box; the line in
`close-task` Step 6 that ticks it; `finalize.sh` taking a list of dossiers, with `--dry-run`, referrer
discovery and rewriting, the post-deletion link check, the two shas, and the optional `gh issue comment`.
Rehearsed with `--dry-run` against the five open dossiers in `dot-agent-spec` — the repository where the
dangling-link failure actually happened, so a correct run is one that reports the referrers the manual
closure missed.

**Track 6 — Governance and release.** The ADR recording when a hook is justified in this plugin and why
the plan-mode hook qualified. Fix the `CLAUDE_PROJECT_DIR` bug in `hooks/plan-mode-context.sh`. Update the
`AGENTS.md` layout row for `scripts/`, which now holds runtime tooling and not only the validator. Consider
a `scripts/checks/` fragment asserting no skill or reference restates its template. Bump the version and
publish — nothing above reaches any install until a release is cut.

## Success criteria

- `vibe-ops`'s share of the skill listing drops by ≥900 characters, measured the same way as the 3,839
  baseline in this plan's Context.
- Creating a record reaches its first question after exactly one shell call.
- The resolver answers correctly in all five repository shapes named in Track 1.
- `git rm` of a dossier with an unchecked Closure box is refused and the refusal names `close-task`; the
  same command succeeds once the box is checked.
- `finalize.sh --dry-run` prints a breadcrumb whose `git show` actually resolves, and reports the `gh` step
  as skipped.
- Given a batch of dossiers, `finalize.sh` lists every referring file *before* deleting any of them, and
  the link check run *after* the deletion passes — verified against the case that failed in
  `dot-agent-spec@b9f5635`.
- `bash scripts/check-agents-md.sh .` passes, including `plugin-root-paths` for every new
  `${CLAUDE_PLUGIN_ROOT}` reference.
- No reference file repeats a template comment; the combined line count of the new skill plus its four
  references is below the 485 lines the four old skills occupied.

## Verification

```bash
# resolver, across shapes
sh scripts/resolve-governance.sh task
cd /tmp/fixture-root-tasks && sh <plugin>/scripts/resolve-governance.sh task
cd /tmp/fixture-empty      && sh <plugin>/scripts/resolve-governance.sh task   # expect (none), exit 0

# closure guard, both states
echo '{"tool_name":"Bash","tool_input":{"command":"git rm project/tasks/007-x.md"}}' \
  | sh hooks/task-dossier-guard.sh          # unchecked -> deny; tick the box -> allow

# the tail, touching nothing
sh skills/close-task/finalize.sh --dry-run project/tasks/007-x.md project/plans/003-y.md

# the listing budget, before and after
# (the same python one-liner used to produce the 3,839 baseline)

PRIVATE_NAMES=... bash scripts/check-agents-md.sh .
```

End to end, against the working tree via `claude --plugin-dir`, since nothing reaches an install before a
release: create one record of each type, then close a task with `/vibe-ops:close-task` and confirm the
breadcrumb in both the issue and the plan resolves with `git show`.

---

<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->

## Progress

- [x] **Track 0 — `command_name` probe** (2026-08-03). A plugin skill arrives as the fully-qualified
      `vibe-ops:new`, not the bare `new`; `command_source=plugin`, `expansion_type=slash_command`,
      `command_args` carries everything after the command.
- [x] **Track 1 — resolver** (2026-08-03). `scripts/resolve-governance.sh`, verified against five repo
      shapes: this repo, root-level `tasks/` with 2-digit numbering, an empty repo, a custom `DA01-*`
      scheme with its own `AGENTS.md` authority, and `dot-agent-spec` for real.
- [x] **Track 2 — one `new` skill + four references** (2026-08-03). Listing dropped 3,839 → 2,779
      characters (−1,060, target was ≥900); 485 lines across four skills became 314 across one skill and
      four references.
- [x] **Track 3 — `UserPromptExpansion` hook** (2026-08-03). `hooks/new-command-context.sh`, matcher
      `^vibe-ops:new$`, reads the type from `command_args` and calls the same resolver. Silent without a
      valid type. Both jq and no-jq paths verified.
- [~] Track 4 — breaking change: `AGENTS.md`, `README.md`, ADR-0006's pointer and the hook's own text are
      updated; **`CHANGELOG.md` and the slash-commands screenshot still pending**.
- [x] **Track 5 — closure half** (2026-08-03). `hooks/task-dossier-guard.sh` verified across six cases
      (open dossier denied, closed allowed, mixed batch denied, non-deletion ignored, non-task path
      ignored, missing file ignored) and on the no-`jq` fallback path. `finalize.sh` verified end to end
      against a reproduction of the real failure: two dossiers, a plan linking to both, two commits in the
      right order, links rewritten to runnable `git show` commands, link check green *after* the deletion,
      and the breadcrumb resolving to the actual content. `close-task` Step 6 rewritten to drive it.
- [~] Track 6 — the `CLAUDE_PROJECT_DIR` fix landed early, because the resolver made it a deletion rather
      than a patch: the hook now calls `resolve-governance.sh` instead of carrying its own copy of the
      discovery loops, and reports `006` in this repo where it used to report the workspace's `012`. ADR
      and release still pending.

## Surprises & Discoveries

**Observation:** the plan-mode hook shipped earlier today resolves against the wrong repository in a
workspace whose project root contains independent repos.
**Evidence:** invoked while working in `vibe-ops`, it reported "the next plan number in this repository is
012" — 012 is the *workspace* repo's next number; `vibe-ops` is at 005. The hook anchors on
`CLAUDE_PROJECT_DIR`, which points at the umbrella repository. Fixed in Track 6; the resolver must anchor
on `git rev-parse --show-toplevel` instead.

**Observation:** the marker the closure guard needs already exists, and was written for exactly this.
**Evidence:** `project/templates/task.md` ships `- [ ] Run /vibe-ops:close-task — do not just delete this
file. Stays unchecked until closure actually runs; a dossier that looks otherwise finished but has this box
open is not done.` No new convention is needed — only a reader for it, and one line in `close-task` that
ticks it.

**Observation:** deleting a dossier breaks every document that linked to it, and the repository's own link
check does not catch it because it gets run before the deletion rather than after.
**Evidence:** `dot-agent-spec@b9f5635`, *"repoint 13 links left dangling by closing the dossiers"* —
`/vibe-ops:close-task` deleted three dossiers and nothing repointed the plan's Tracks table and Progress
list (6 links) or another document's `Depends on` row and body (7). The repair commit also records the
convention that fixes it: a closed dossier is named in **plain text plus a literal `git show <sha>:<path>`**,
never a link, and the plan gains a line saying an unlinked dossier is the normal end of a task rather than
a missing file — because the broken state *looked like a broken repository*. A first attempt used a
`<name>` placeholder, which is a template rather than something a reader can run.

**Observation:** a closure comment format already exists in practice and nobody wrote it down.
**Evidence:** the comments on `dot-agent-spec` issues #29 and #20 share a shape — what shipped per track
with PR links, an *"Outcome against the prediction"* section that states where reality diverged from the
plan, a *"What was routed before the dossiers were deleted"* section naming each promoted learning and its
destination, the lifecycle spelled out inline (`Planned → In Progress → Done → file removed, git history is
the archive`) so the missing file does not read as a mistake, and the breadcrumb as a fenced block carrying
the **full 40-character sha**. None of this is in `close-task`; all of it is in the artifacts it produced.

**Observation:** BSD `sed` does not support `\|` alternation in a BRE, and fails by matching nothing
rather than by erroring.
**Evidence:** the JSON-extraction pattern used in two hooks returned an empty string on macOS, so the hook
exited silently as though the payload had no command. A guard that fails open is worse than no guard; the
portable form stops at the first quote and is enough for extracting a path.

**Observation:** macOS ships `jq` at `/usr/bin/jq`, which turned a "runs without jq" test into a false
pass.
**Evidence:** the first fallback test ran with `PATH=/usr/bin:/bin`, which still resolves `jq` — so the
jq branch was exercised twice and the fallback never was. Proving a tool is absent requires building a
`PATH` that contains everything else and demonstrably not it, then asserting on that; the second attempt
removed `sed` along with `jq` and produced a different false result.

**Observation:** `git add` naming a path that `git rm` already staged aborts the whole invocation, and
the commit then silently never happens.
**Evidence:** the first real run of `finalize.sh` printed `fatal: pathspec 'project/tasks/007-alpha.md' did
not match any files` and stopped — the deletion commit was never created, though every earlier step had
succeeded and reported success. `git rm` already stages the removal; re-adding the same path by name is
both unnecessary and destructive to the rest of the `git add`. This is a known trap that was reintroduced
anyway, which is the argument for the script existing at all: it is now encoded once instead of being
re-derived by whoever closes the next task.

**Observation:** closures happen in batches, not one dossier at a time.
**Evidence:** `chore(tasks): close the four Track E dossiers` and `close the three finished Plan-003
dossiers` in the same repository. A finalize script that takes a single path would be used wrongly on its
first real invocation.

**Observation:** the split this plan uses — a command hook that captures, a ceremony that judges — is
already a filed toolchain fact, not a preference.
**Evidence:** `project/learnings/prompt-hooks-cannot-run-where-work-ends.md`: prompt hooks exist on only
four events, and a prompt hook's output is `{decision, reason, systemMessage}` with no tool call, so no
hook can both notice something and record it. Any "a hook notices X and writes it down" design is
unbuildable as stated.

**Observation:** the skill listing is a budget shared across all installed plugins, not a per-plugin
allowance, and this plugin takes nearly half of it.
**Evidence:** measured 3,839 characters of description across ten skills against a documented ~8,000-char
cap; the four record-creating skills are 1,436 of that. `AGENTS.md` records the cost but frames it as this
plugin's own trade-off, which is what made the four separate commands look free.

## Decision Log

**Decision:** collapse the four `new-*` skills into one `new <type>` skill, accepting the breaking change.
**Rationale:** the listing budget is shared with every other installed plugin, so 48% for one plugin is
space taken from `context-mode`, `dot-agent` and whatever comes next — not a private trade-off. Per-type
detail moves to `references/`, so the four bodies become four files read on demand rather than branches in
one file, and the four descriptions become one covering the same triggers.
**Date / Author:** 2026-08-03 / Danilo Borges

**Decision:** the resolver is a script the skills call, with the hook as a second path to the same script.
**Rationale:** `UserPromptExpansion` fires only when the command is typed. Every skill here is deliberately
model-invocable, so a hook-only design would silently not help exactly when the user asks in plain
language — the case the plugin optimised for.
**Date / Author:** 2026-08-03 / Danilo Borges

**Decision:** the closure guard denies while the box is unchecked, rather than asking.
**Rationale:** an `ask` the user approves deletes the dossier with its learnings inside; the prompt becomes
a formality and the failure it was built to prevent happens anyway. A deny that names the skill turns the
moment into a redirect.
**Date / Author:** 2026-08-03 / Danilo Borges

**Decision:** `repo-setup` does not gain the always-on line in this plan.
**Rationale:** the research shows the line is probably load-bearing, but the run that would prove it was
cancelled. Changing what is written into every repository on an unmeasured claim is the mistake this plan
exists to stop making.
**Date / Author:** 2026-08-03 / Danilo Borges

## Outcomes & Retrospective

*Not yet started.*

## Open questions

- **Merging `close-task` and `close-plan` the same way** — 739 characters between them, and the same
  argument applies. Held out of this plan only to keep one release to one breaking surface. Decide after
  Track 4 shows what absorbing the first break actually cost.
- What `command_name` holds for a plugin skill. Track 0.
- Whether a `scripts/checks/` fragment can mechanically detect a skill or reference restating its template,
  or whether Track 2's result can only be held by review.
- Whether `finalize.sh` should commit the deletion itself or stage it and stop. Committing is what produces
  a valid breadcrumb; stopping is safer. Decide in Track 5 with `--dry-run` output in hand.
