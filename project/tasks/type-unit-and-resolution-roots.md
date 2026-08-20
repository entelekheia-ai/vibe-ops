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

# Task: The type unit and its resolution roots

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/030-the-type-unit-and-the-compositions-derived-from-it.md](../plans/030-the-type-unit-and-the-compositions-derived-from-it.md), Track 1 |

> **DRAFT — refine before execution.** The unit's layout in the plan is a working sketch
> (`types/<name>/{template.md, authoring.md, migrations/, type.json}`); `type.json`'s schema is not
> designed, and the migration-note naming inside a unit (`<a>-to-<b>.md`, dropping the type prefix the
> flat directory needed) is unverified against the migrate skill's reader. The backwards-compatibility
> question — whether `plugin/templates/` keeps readable copies for artifacts predating the move — is an
> open question on the plan itself. Refine before any file moves.

---

## Context

Plan-030 Track 1. Five conventions today locate a type's data facets (the plan's Design table maps them);
the migration notes already have the target shape — found by name from the artifact's stamp, extensible by
deposit. This dossier gathers the other facets into the same shape and resolves units through a root list
(installed norm first, repository second), so a package can ship a type and a repository can override one.

## Work items

The items below are the known skeleton; the refinement pass rewrites them with verified Whys.

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Settle the unit layout and `type.json` schema *(design)* | M |
| 2 | P0 | The unit resolver over the root list | M |
| 3 | P0 | Move the four shipped types' prose facets in, with old-path reads preserved | M |
| 4 | P1 | Fixture unit in a temp root resolves end to end | S |

## Implementation order

- [ ] P0 — refinement pass (not delegable — the layout *is* the design)
- [ ] remaining order set at refinement

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
