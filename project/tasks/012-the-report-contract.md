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

# Task: The report contract

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-30 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/041-the-cli-grows-a-render-layer.md — Track 1 |

---

## Context

Plan-041 Track 1: `cli/packages/core/src/report.ts` gains the report shape and a guard, exported from the
core's index, describing what `runOps` and `check` already return in `data`. Nothing consumes it yet;
Track 3's report block is the first reader. Acceptance: a type exists that both producers satisfy, and a
test proves the nouns' payloads do not, so the guard cannot silently widen.

Gate: `node --test cli/packages/core/test/report.test.ts`, `npm run typecheck -w
@entelekheia/vibe-ops-core`. Files owned: `cli/packages/core/src/report.ts`,
`cli/packages/core/src/index.ts` (two export lines), `cli/packages/core/test/report.test.ts`. Carried out
in the main loop, per the plan's delegation decision.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `readReport` / `isReport` and the normalised `Report` type | S |
| 2 | P0 | A test for each way the guard can fail silently | S |

### 1. The normalised report — P0

**What:** `readReport(data)` returns `{ findings, skipped }` with every entry keyed by `id`, or
`undefined`; `isReport(data)` is its boolean.
**Why:** The report block draws from whatever passes this guard, so it is the whole of the contract.
**Change:** New file; two export lines in the core's index.

### 2. The guard's two failure directions — P0

**What:** Accept both producers' payloads; reject the nouns' and any payload with one malformed entry.
**Why:** Narrowing drops a producer to the summary line; widening draws a noun as an empty, clean report.
**Change:** `cli/packages/core/test/report.test.ts`, with the `runOps` payload typed through `satisfies`
against the core's own `OpsFinding`/`OpsSkip`/`OpsRepair`/`OpsPopulation`.

## Implementation order

- [x] P0 — `report.ts` and its exports
- [x] P0 — the test, green (5/5), and broken on purpose once: accepting `findings` without `skipped`
      failed the malformed-payload test, as it should
- [x] P0 — `npm run typecheck -w @entelekheia/vibe-ops-core` exits 0

## Surprises & Discoveries

- Observation: The two producers do not share key names. `runOps` identifies a finding by `gate` (with
  `rule`, `file`, `line`); `check` re-keys the ops' findings to `check` and folds `file` into `evidence`
  when it merges them.
  Evidence: `cli/packages/core/src/ops.ts:104` (`OpsFinding`) against the re-keying in
  `cli/packages/module-check/src/index.ts:235`.
- Ruling: The contract normalises both spellings to `id` and exposes `readReport` beside the `isReport`
  the plan names — the plan's "the same `findings` and `skipped`" is true of the field names and false of
  their entries, and a guard over one spelling would drop the other producer to the summary line — cost
  if wrong: one more accepted key in `idOf`.
- Ruling: One malformed entry rejects the whole payload rather than being dropped — a block with a
  finding silently missing reads cleaner than the run was — cost if wrong: a producer with one odd entry
  falls back to the summary line until it is fixed.
- Ruling: This run's dossiers are numbered 012–015, skipping the resolver's `008` — an unmerged branch
  already holds 008–011, the same collision that cost Plan-041 its first number — cost if wrong: a
  renumber at merge, if that branch is abandoned.

- Observation: The review of this track (range `f63f349~1..f63f349`) raised five findings, every one
  reproduced before it was acted on. The two SHOULD-FIX: `satisfies` catches a renamed or newly required
  `OpsFinding` field and misses a widened `level` or an optional `gate`; and nothing tied `check`'s own
  payload to the guard. Both are fixed in the follow-up commit — two mappings into `ReportFinding` /
  `ReportSkip`, and a `check` test asserting `isReport(result.data)` — and the eight mutation probes now
  all fail, in the test or the typecheck, where five passed green before.
  Evidence: the reviewer's `mutate.sh`, rerun after the fix; `cli/packages/module-check/test/composition.test.ts`.
- Observation: The review agent, briefed read-only, wrote a tracked file: `vibe-ops log index --json`
  writes by default, and it rewrote `project/log/README.md` while probing whether a noun passes the guard.
  Reverted before anything was committed. A verb whose query form writes is a trap for any reader that
  explores by running the nouns.
  Evidence: `git diff --stat -- project/log/README.md` showed 3 insertions; `git checkout` restored it.
- Deferred minor: `project/log/README.md` at the base does not index a tracked entry
  (`the-gate-on-path-is-not-the-gate-in-this-tree.md`); `vibe-ops log index --dry-run` shows it. Predates
  this plan and blocks nothing.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
