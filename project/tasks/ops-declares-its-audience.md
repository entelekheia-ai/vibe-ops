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

# Task: Every ops declares its audience

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/030-the-type-unit-and-the-compositions-derived-from-it.md](../plans/030-the-type-unit-and-the-compositions-derived-from-it.md), Track 6 |

---

## Context

Plan-030 Track 6. Measured 2026-08-14 and restated in the plan: 9 of the 17 shell fragments and several
composed entries apply only to a repository that publishes a Claude Code plugin; on a real run over a
repository that publishes none, 12 of 17 reported SKIP and the summary was indistinguishable from a full
run. Nothing today distinguishes portable detection from this-repository-only detection — the maintainer
scoped `ops-self` out of adoption verbally on 2026-08-14, and a verbal scope is exactly what this field
makes mechanical.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `audience` on `OpsDefinition` (and per-entry only if the classification pass proves the need) | S |
| 2 | P0 | Classify: `ops-self` internal; `fragment-parity` entries internal in `ops-governance` and `ops-agents-md` | M |
| 3 | P0 | The consumer side filters by audience | M |
| 4 | P1 | Fixture: portable-only composition over a plugin-less repo → no plugin-shaped SKIPs | S |

### 1. The field — P0

**What:** `audience?: "portable" | "internal"` on the definition, defaulting to portable.
**Why:** the distinction exists (measured above) and lives nowhere expressible.
**Change:** `cli/packages/core/src/ops.ts` (`OpsDefinition`, and `OpsGateEntry` only if item 2 finds an
ops that is genuinely mixed — `ops-governance` is, because of `fragment-parity`).

### 2. The classification — P0

**What:** the pass over the three ops; every `internal` carries a reason string, same doctrine as
`disabled` (a ledger entry, never a bare flag).
**Why:** `ops-self` hardcodes `<plugin>/templates/*` and `<plugin>/skills/migrate/migrations` (verified
2026-08-14 — both resolve to the repository root in a flat repo and do not exist); `fragment-parity`
answers a question only this repository has (does a port regress its fragment).
**Change:** the three `ops-*/src/index.ts` compositions.

### 3. The filter — P0

**What:** whatever composes ops into a target (the setup skill's list, the MCP default set, adoption
docs) reads the field.
**Why:** a field nobody filters by is prose with extra steps.
**Change:** locate the composition points first — `BUILTINS` in `cli/packages/cli/src/builtins.ts` is one;
the refinement at the keyboard names the rest before editing.

## Implementation order

- [ ] P0 — item 1 (small; not delegable — it sets the vocabulary)
- [ ] P0 — item 2 (not delegable per Plan-030's Decision Log: the classifications are the boundary)
- [ ] P0 — item 3 (survey delegable; the edits are small once located)
- [ ] P1 — item 4 (delegable)

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
