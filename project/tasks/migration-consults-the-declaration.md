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

# Task: The declaration consulted, proven on this repository's own records

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/031-ownership-fragments-and-the-shaped-class.md](../plans/031-ownership-fragments-and-the-shaped-class.md), Track 3 — absorbs [Plan-017](../plans/017-the-plans-still-written-against-the-first-template-shape.md) |

---

## Context

Plan-031 Track 3, and the closure vehicle for Plan-017. The backlog is real and measured: this
repository's own suite reports `template-version-behind` warnings on the shipped plans (plan@0.1 against
plan@3 — visible in any `vibe-ops governance .` run here), and Plan-017 records eight plans on the first
template shape. Running `/vibe-ops:migrate` over this repository after migration consults the declaration
is simultaneously the acceptance test of `shaped` on real files and the discharge of that backlog. It is
also the one step in the three plans that rewrites permanent records — reviewed, never delegated.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Adoption consults classes before writing | M |
| 2 | P0 | The migration run over this repository's records | M |
| 3 | P0 | Verification: stamps current, content intact, gates green | S |
| 4 | P1 | Plan-017 closed via `/vibe-ops:close-plan`, its scope discharged by item 2 | S |

### 1. Adoption consults — P0

**What:** the setup skill's writing steps check the effective class of each destination, mirroring
promulgation's consult; a write into `repo` reports instead of writing.
**Why:** adoption writes the full classified set and reads the declaration nowhere (verified 2026-08-19:
no ownership read in the setup skill's steps).
**Change:** `plugin/skills/setup/SKILL.md` write steps; the scaffolder agent's contract already says it
decides nothing, so the check belongs in the instructions that drive it.

### 2. The run — P0

**What:** `/vibe-ops:migrate` over `project/` here, jump by jump per the recorded notes; a jump with no
note stops, per the skill's own rule.
**Why:** the measured backlog above; and a migration mechanism proven only on fixtures.
**Change:** no code — an execution, producing one reviewed commit whose diff shows structure edits only.

### 3. Verification — P0

**What:** `vibe-ops governance .` shows no `template-version-behind`; `git diff` of item 2's commit
reviewed section by section for content preservation; suite green.
**Why:** the plan's success criterion, verbatim.

## Implementation order

- [x] P0 — item 1 — setup Step 2 now consults `vibe-ops records handling <path>…` (which since
  Track 1 answers `ownership: <class>` for ANY path, records or not) before writing over anything the
  survey found present: `repo` reported and untouched, `seed` only-when-absent grounded in the
  declaration, `shaped` never rewritten by adoption. The check stays with the skill, never the
  scaffolder — its contract is that nothing is left for it to decide.
- [ ] P0 — item 2 (**not delegable** — permanent records, reviewed by the maintainer)
- [ ] P0 — item 3 (mechanical)
- [ ] P1 — item 4 (ceremony)

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
