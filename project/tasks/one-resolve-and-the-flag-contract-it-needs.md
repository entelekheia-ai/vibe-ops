---
vibe-ops-template: task@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: One resolve, and the flag contract it needs

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-14 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/027-one-resolve-and-a-schema-that-tells-the-truth.md](../plans/027-one-resolve-and-a-schema-that-tells-the-truth.md), Track 1 |

---

## Context

Plan-027 Track 1 opens with a decision rather than with work: four verbs named `resolve` share one
implementation and have diverged, and which direction to converge them is not obvious from the code.

**The decision is taken: the noun is the spelling.** `vibe-ops plan resolve` and `vibe-ops task resolve`
stay; `records resolve` narrows its `--type` domain to `adr` and `rfc`, the two record types with no noun
of their own. One spelling per type, and the required flag survives only where there is no alternative.

Surveying the code first changed what this track is. Plan-027's divergence table describes the verb layer,
but the per-type extras it lists — `PLAN_ACTIVE`/`PLAN_TERMINAL`/`LIVING` and `GH_REMOTE`/`GH_AUTH` — are
attached by `resolveRecord` keyed on its own `type` argument, not by whichever module called it
(`cli/packages/records/src/resolve.ts`). The library underneath is already single-homed. What is actually
divergent is narrower in one place and wider in another: `plan` and `task` are each reachable by two names,
and `log resolve` does not use the library at all.

The direction also decides a contract question that has been deferred twice. `--type` is required, and
`ModuleFlag` has no way to say so, so the requirement is a hand-written `if` — copied verbatim into two
verbs. That contract gap is what the following track (a schema that tells the truth) needs first, so it
lands here, with the verb that proves it.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `ModuleFlag` gains `required` and `choices` | M |
| 2 | P0 | `records resolve` answers for `adr` and `rfc` only | S |
| 3 | P0 | One `--type` gate, not two copies | S |
| 4 | P0 | `log resolve` prints through the shared formatter | M |
| 5 | P1 | `records` declares `json` once | S |
| 6 | P0 | The consumers that name a spelling being removed | M |
| 7 | P0 | The test that the removed spelling is gone | S |

### 1. `ModuleFlag` gains `required` and `choices` — P0

**What:** Two optional fields on `ModuleFlag` in `cli/packages/core/src/module.ts`, validated in
`defineModule`: `required?: boolean` and `choices?: readonly string[]`.

**Why:** `--type` is required and has a closed domain, and the contract can express neither, so both live
in a runtime `if` inside the module. Measured: that `if` is byte-identical in `records list` and
`records resolve` in `cli/packages/module-records/src/index.ts`, and a missing flag produces the same
message as a misspelt one (`got undefined`). A rule enforced by a copied conditional is a rule that
diverges the next time only one copy is edited.

**Change:** Add both fields with their doc comments. `defineModule` rejects `choices` on a non-string
flag and rejects an empty `choices` array. Nothing consumes `required` for enforcement in this item —
enforcement is the next track's, in `runModule`, which is the one place both surfaces pass through. What
this item delivers is the declaration those two consumers read.

### 2. `records resolve` answers for `adr` and `rfc` only — P0

**What:** The `resolve` verb's `--type` accepts `adr|rfc`. `list`, `show` and `census` keep all four.

**Why:** `records resolve --type plan` and `vibe-ops plan resolve` resolve the same thing under two names
today, which is the duplication Plan-027 Track 1 exists to remove. `list`, `show` and `census` have no
counterpart on any noun, so narrowing them would remove the only way to ask their question.

**Change:** A `RESOLVE_TYPES` constant beside `TYPES`. The refusal names the replacement rather than only
the valid set, so someone who typed the old spelling is told the new one:
`--type must be one of adr, rfc — plan and task resolve under their own nouns (vibe-ops plan resolve)`.

### 3. One `--type` gate, not two copies — P0

**What:** Extract the gate into one helper parameterised by its allowed domain, consumed by `list` and
`resolve`.

**Why:** Two verbatim copies exist today. Item 2 makes their domains differ, which is exactly when two
copies stop being harmless.

**Change:** One function returning either the validated `RecordType` or the failure result, declared from
the flag's own `choices` so the message and the contract cannot disagree.

### 4. `log resolve` prints through the shared formatter — P0

**What:** `cli/packages/module-log/src/index.ts` stops hand-rolling its single `DIR=` line and its own
data shape, and goes through one formatter in `cli/packages/records/src/format.ts`.

**Why:** Measured: `module-log` imports neither `resolveRecord` nor `formatResolved` — Plan-027's table
records this as "no numbering", which understates it. The result is a third shape for the same question
and a second place that decides how a resolved location prints.

**Change:** The formatter accepts the narrower shape and emits only the keys that apply. `log` stays out
of `RecordType`, deliberately: every one of those is numbered, and a trap is addressed by the path where
it recurs. That exception is already argued in the module's own header and stays there — this item makes
it an exception in one dimension instead of three.

### 5. `records` declares `json` once — P1

**What:** Remove `JSON_FLAG` from the `resolve` verb's own `flags`; the module-level declaration stays.

**Why:** It is declared in both places. The comment beside the module-level declaration already says the
per-verb copies were consolidated away; `resolve`'s survived. `shapeFor` in `cli/packages/cli/src/mcp.ts`
de-duplicates by name and keeps the first description, so the second is discarded in silence.

**Change:** Delete the line. Also worth an item in the next track: `defineModule` accepts a flag declared
at both levels without complaint, which is how this survived.

### 6. The consumers that name a spelling being removed — P0

**What:** Update every surface that spells `records resolve --type plan|task`.

**Why:** The removal is a rename, and a rename that leaves its callers behind is a break. The precedent is
in this repository's own changelog: `records resolve --type <t>` already replaced a bare
`records --type <t>` once, and the cost was four lines in four skill files.

**Change:** `plugin/skills/new/SKILL.md` Step 0 and the line saying either spelling is correct;
`cli/README.md`; `cli/packages/cli/test/mcp-nouns.test.ts`;
`cli/packages/module-records/test/module.test.ts` (the error-domain assertion); the `[Unreleased]`
changelog; and `project/plans/023-four-answers-the-tooling-has-not-earned.md`, whose Track 1 is unshipped
and specified against `records resolve --type task`.

**What must not change, and whose stillness is this item's acceptance:**
`plugin/hooks/plan-progress-nudge.sh`, which shells `vibe-ops plan resolve` and parses five key names out
of its output; `cli/packages/cli/src/new-context.ts`, which puts the same block into a prompt expansion;
and the `resolve` step in both close skills.

### 7. The test that the removed spelling is gone — P0

**What:** `records resolve --type plan` exits 2 with a summary naming `vibe-ops plan resolve`.

**Why:** Plan-027's success criterion is that a test asserts the four former spellings do not all still
exist. Asserting the refusal *and* that it names the replacement is what makes the removal a rename.

**Change:** One case in `cli/packages/module-records/test/module.test.ts`, plus the MCP path in
`cli/packages/cli/test/mcp-nouns.test.ts`.

## Implementation order

<!-- Delegation: none of the items below is delegated. Item 1 is a contract change, items 2–4 are the
     convergence the plan's decision turns on, and item 6 is a judgement about which callers are load-
     bearing — the split agreed for this plan sends discovery and mechanical porting to a subagent and
     keeps design judgement here, and every item is on the second side of that line. -->

- [x] P0 — Item 1: `required` and `choices` on `ModuleFlag`, validated in `defineModule`
- [x] P0 — Item 3 then Item 2: the shared gate first, then narrow `resolve`'s domain through it
- [x] P1 — Item 5: drop the duplicate `json` declaration
- [x] P0 — Item 4: the shared formatter, and `log resolve` routed through it
- [x] P0 — Item 6: the consumers, and a check that the four that must not move did not
- [x] P0 — Item 7: the tests
- [x] P0 — `npm run build && npm run typecheck && npm test`, then `vibe-ops check .`
      (done: build and typecheck green, gate green at 17 checks / 0 failed, 434 of 435 tests pass;
      remaining: one failure that predates this work — see the third Surprises entry)
- [x] P0 — Write the direction decision into Plan-027's `Decision Log`, with the option not taken

## Surprises & Discoveries

- Observation: The per-type extras Plan-027 attributes to the verbs are already converged in the library.
  Evidence: `resolveRecord` in `cli/packages/records/src/resolve.ts` branches on its own `type` argument
  to attach the plan and task blocks, so `records resolve --type plan` has always returned `PLAN_ACTIVE`
  and `LIVING`. The verb layer is the only place anything diverged.
- Observation: `log resolve` diverges further than the plan's table says — it does not call the record
  library at all.
  Evidence: `cli/packages/module-log/src/index.ts` imports neither `resolveRecord` nor `formatResolved`,
  and returns a data shape with no `template`, `authority`, `pad`, `existing` or `next`.
- Observation: `npm run typecheck` was red in three packages before this work started, and nothing gates
  it — the commit gate composes seventeen shell fragments and runs neither `typecheck` nor `npm test`.
  Evidence: `cli/packages/core/test/config.test.ts`, `cli/packages/module-records/test/handling.test.ts`
  and `cli/packages/ops-self/test/ops.test.ts` produced nine errors, every one a missing non-null
  assertion or an over-wide parameter type in a test file, none in shipped code. All nine were repaired
  here so this work could be verified at all; the absence of a sensor is the finding, not the errors.
- Observation: `npm test` was also red before this work, on the ops-governance test that runs this
  repository's own composition against itself.
  Evidence: `template-version-undeclared` fails on
  `project/tasks/template-version-gate-resolves-wrong-templates-path.md`, a committed dossier that
  declares no `vibe-ops-template` line — `git show HEAD:<that path> | head -3` shows the H1 at offset 0
  at HEAD too, and nothing under `packages/gates/` or `packages/ops-governance/` was touched here. Left
  as found: it is another dossier's header, and that dossier is open.

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
