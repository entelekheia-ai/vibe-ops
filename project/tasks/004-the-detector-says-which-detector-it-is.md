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

# Task: The detector says which detector it is

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-11 |
| Author | Danilo Borges |
| Issue | none — internal work, no issue opened (Plan-012 Decision Log) |
| Plan | [`plans/012-versions-travel-with-the-record.md`](../plans/012-versions-travel-with-the-record.md) — Track 4 |

---

## Context

`ModuleDefinition` and `OpsDefinition` in `cli/packages/core/src/` both require `version`.
`GateDefinition` in `cli/packages/core/src/gate.ts` does not — it declares `id`, `summary`,
`defaultPaths` and `fixable`.

The gate is the pure detector, and RFC-0001 splits gate from ops the way eita splits trait from profile.
An eita trait carries a version and every observation records it; here the version stops at the
composition, so two findings recorded under one id at different times are indistinguishable when the
detector between them changed. That is the comparison this plan exists to make possible.

The target shape already exists and already has a consumer: the shell path emits an instrument name
carrying a trailing `@1`, hand-written into one fragment. This task makes it declared instead, and extends
it to the ten gates and the seventeen fragments.

**The form is decided** (Plan-012 Decision Log): an **integer**, moving only on a break — the change a
consumer cannot absorb silently. A detector made stricter within the same vocabulary does not move it; a
detector that starts reporting a category nobody was handling does. Semver stays on the package and means
something else.

Depends on Track 3 (`project/tasks/003-the-emitted-record-reaches-eita.md`): until the emitted record
carries an instrument field, a gate version has nowhere to travel.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `GateDefinition.version`, required, integer | S |
| 2 | P0 | The ten gates declare one | M |
| 3 | P0 | The version reaches the emitted record | S |
| 4 | P1 | The seventeen shell fragments declare one | M |
| 5 | P1 | `fragment-parity` records both versions it compared | S |

### 1. `GateDefinition.version`, required, integer — P0

**What:** add the field and reject a definition without it at define time.
**Why:** an optional version is absent exactly where it matters. `defineGate` already rejects a bad id and
an inconsistent `fixable`/`fix()` pair, so failing at define time is the established precedent.
**Change:** `cli/packages/core/src/gate.ts`. Breaking for every gate — intended, and the reason this task
lands before anything depends on gate versions being meaningful.

### 2. The ten gates declare one — P0

**What:** each gate under `cli/packages/gates/` gets a version, starting at 1.
**Why:** they are the population the field exists for.
**Change:** mechanical and independent per gate — **the one item in this plan genuinely suited to parallel
execution**, one contract per gate, isolated so ten writers do not collide.

### 3. The version reaches the emitted record — P0

**What:** the gate version lands in the instrument field of the header Track 3 introduced.
**Why:** a version declared and not carried changes nothing.
**Change:** `defineOps` already knows which gate it ran; pass its version through to the emitter.

### 4. The seventeen shell fragments declare one — P1

**What:** a version declaration in each fragment under `cli/packages/module-check/sh/checks/`.
**Why:** they are the baseline `fragment-parity` compares a port against.
**Change:** replace the one hand-written instance with the declared form rather than adding a second
convention beside it.

### 5. `fragment-parity` records both versions it compared — P1

**What:** the parity result names the fragment version and the gate version it ran between.
**Why:** a parity result that does not name what it compared is not evidence the next time either side
changes — and RFC-0001 makes that comparison the precondition for removing a fragment.
**Change:** additive to the gate's existing output.

## Implementation order

**Ran before Track 3, not after it** — the emitted header's `tool` is the gate with its version, so this
track is what unblocks that one. The dossier's dependency arrow was backwards.

- [x] (2026-08-11) P0 — `GateDefinition.version`, a required whole number from 1; `defineGate` rejects an
      absent, zero or fractional one. Six tests in `core/test/gate.test.ts`
- [x] (2026-08-11) P0 — All eleven gates declare `version: 1`. Verified by the **compiler**, not a grep:
      a required field makes a missing one a type error
- [x] (2026-08-11) P0 — Carried through `defineOps` into the header's `tool`, and confirmed in a real
      artifact: `"tool":"template-version@1"`
- [x] (2026-08-11) P0 — **`loadGate` validates too**, which was not in this dossier: `defineGate`'s rules
      only ever protected gates that call it, and a hand-rolled one produced `tool: "<id>@undefined"`.
      Extracted to `assertGateDefinition` and enforced at both boundaries
- [x] (2026-08-11) P1 — What counts as a break is written on the field itself, where a gate author
      reads it: detection made stricter within one vocabulary does not move it; a new category does
- [ ] P1 — Declare a version on each of the seventeen shell fragments; retire the hand-written instance
- [ ] P1 — `fragment-parity` records both versions it compared

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
