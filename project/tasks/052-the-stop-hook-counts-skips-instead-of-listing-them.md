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

# Task: The Stop hook counts skips instead of listing them

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-10-01 |
| Author | Danilo Borges |
| Issue | [#52](https://github.com/entelekheia-ai/vibe-ops/issues/52) |
| Plan | [Plan-028](../plans/028-the-debounced-channel-for-opportunistic-verification.md), Track 2 — the report's shape only; the move off `Stop` stays with the track |

---

## Context

`vibe-ops hook check-global` reports through `additionalContext` on `Stop`, which continues the
conversation, so every line it writes is read by the model at the end of every turn. It wrote one `SKIP`
line per check declared off, with its reason: eleven of them on this repository, identical on every turn,
beside two findings. A skip is a declaration the repository already made; the model has nothing to do
with it, and the terminal surface already hides it outside `--verbose` (`module-check/src/index.ts`, the
`interesting` filter keeps only `FAIL` and `WARN` lines).

Plan-028 Track 2 moves this hook off `Stop` onto a debounced channel. That changes **when** it speaks;
this task changes **what** it says, which holds on either surface and does not wait for the channel.

Warnings were considered and deliberately left as they are. A warn-only run still opens with "findings
below" and still costs a turn continuation; the maintainer keeps that behaviour while observing how warns
are handled in practice, because the report reaches the maintainer directly in the terminal client and
only reaches the model in an IDE client, so the trade-off differs per client.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Skips become a count on the summary line | S |

### 1. Skips become a count on the summary line — P0

**What:** drop the `SKIP  [id] reason` lines from the hook's report; append `, N skipped` after
`M failed` on the summary line when N > 0.
**Why:** measured on this repository, eleven unchanging lines per turn enter the conversation and carry
nothing the model can act on.
**Change:** `cli/packages/cli/src/check-global.ts` builds the summary itself, since the `check` module's
summary never carries a skip count (its shape, `N checks, M failed`, is a contract consumers grep). The
count is inserted after `M failed` rather than appended, because the summary may carry trailing clauses.
Test in `cli/packages/cli/test/hook.test.ts`; patch changeset for `@entelekheia/vibe-ops-cli`.

## Implementation order

- [x] P0 — red test: a declared config whose config-cascade gates skip produces a count and no `SKIP` line
- [x] P0 — `check-global.ts`: count instead of list; header comment updated to match
- [x] P0 — changeset
- [x] P1 — issue opened (#52), dossier renamed to its number
- [ ] P0 — commit, pull request, merge

## Surprises & Discoveries

- Observation: the `check` module's summary never carries a skip count, so the count has to be built by
  the hook; a proposal written as if it did was read as real output.
  Evidence: `module-check/src/index.ts`, `totals` is `N checks, M failed` and nothing else.
- Observation: `npm test` fails two exposure tests when `VIBE_OPS_DENYLIST` is set in the shell; both pass
  with it unset. The tests assume an environment without a deny-list.
  Evidence: `classification.test.ts:38` and `ops-exposure/test/ops.test.ts:72`; `env -u VIBE_OPS_DENYLIST`
  run passes 21/21.
- Observation: the gate's `check` data flattens a finding's `file` into its `evidence` string, so a
  consumer of `data.findings` cannot filter by file without parsing text.
  Evidence: `module-check/src/index.ts`, the `findings.map` in the ops runs.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
