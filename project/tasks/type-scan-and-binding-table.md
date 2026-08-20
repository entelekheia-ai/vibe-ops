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

# Task: The type scan and the binding table

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/029-a-record-type-becomes-a-resolved-name.md](../plans/029-a-record-type-becomes-a-resolved-name.md), Track 2 |

> **DRAFT — refine before execution.** The scan's package marker (working name `vibeOps.types` in
> `package.json`; a standalone file is the alternative) is undecided, and the enumeration strategy over
> `node_modules` needs a design pass against `cli/packages/cli/src/resolve.ts`'s existing three-form
> resolution. Refine in the plan session that picks this up; the resolution *rule* below is settled by
> RFC-0003 and is not up for redesign.

---

## Context

Plan-029 Track 2. With the union open (sibling dossier `record-type-union-opens.md`), a bare type name
needs an owner. RFC-0003's rule is fixed: scan installed packages; one claimant resolves, zero reports
absence, two or more is a finding naming every claimant, and the repository breaks ties in config
(`types: { policy: "<qualified id>" }`). Two constraints carry over from shipped work: a declared binding
is used even when it does not resolve (zero examined, attributable), and ambiguity is a finding, never an
aborting error.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | The marker and the enumeration *(needs design — see banner)* | M |
| 2 | P0 | The one/none/many rule as a resolver in core | M |
| 3 | P0 | `types` in `VibeOpsConfig`, layered like every other key | S |
| 4 | P1 | Fixtures: two claimants → finding; binding resolves; unresolvable binding → zero examined | M |

### Notes for the refinement pass

- The finding's surface: where a *resolution* finding lands when no ops is running — probably the same
  channel `check` uses, but verify against how `disabled-declared` reports.
- The scan must not require packages to be importable — reading a manifest field must not execute code.
- `types` merges in the config cascade like `settings` (one level deep) or whole-key like
  `harness.applied`? Decide with the cascade's own tests open.

## Implementation order

- [ ] P0 — refinement pass producing the final item list (not delegable)
- [ ] P0 — items 2–3 after refinement (delegability decided then, per Plan-029's Decision Log split)
- [ ] P1 — item 4 fixtures (delegable once the surfaces exist)

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
