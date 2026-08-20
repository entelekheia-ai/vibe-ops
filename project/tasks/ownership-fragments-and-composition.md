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

# Task: Ownership fragments, composed with origin

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/031-ownership-fragments-and-the-shaped-class.md](../plans/031-ownership-fragments-and-the-shaped-class.md), Track 2 |

> **DRAFT — refine before execution.** The composition rules are settled by RFC-0003 (peers, double-claim
> is a finding, origin kept per path, narrowing last and refused when widening). Undesigned: where the
> repository's hand-written narrowing lives in `VibeOpsConfig` (a `harness.ownership` key? its own
> top-level?), and how fragment enumeration composes with Plan-029's type scan — one walk or two. Refine
> with both files open.

---

## Context

Plan-031 Track 2. `readOwnership(sourceRoot)` in `cli/packages/module-harness/src/ownership.ts` reads
exactly one file today (verified 2026-08-19); RFC-0003 makes that file the first *fragment* and the CLI
the composer. The consent asymmetry already in the code (`widens` — only a widening needs consent) is what
makes the narrowing safe to apply without ceremony.

## Work items

The items below are the known skeleton; the refinement pass rewrites them with verified Whys.

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Narrowing's home in config decided *(design — see banner)* | S |
| 2 | P0 | Fragment enumeration + composition with per-path origin | M |
| 3 | P0 | Double-claim finding; narrowing applied last, widening refused naming the fragment | M |
| 4 | P1 | Fixtures for the three scenarios in the plan's success criteria | M |

## Implementation order

- [ ] P0 — refinement pass (not delegable)
- [ ] remaining order set at refinement

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
