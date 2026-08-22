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
| Status | Done |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/031-ownership-fragments-and-the-shaped-class.md](../plans/031-ownership-fragments-and-the-shaped-class.md), Track 2 |

> **Refined 2026-08-22, at execution.** The two open questions closed: the narrowing lives in a
> top-level `ownership` key of `VibeOpsConfig` (four actors read the boundary and promulgation is only
> one — the same argument that makes Plan-032's verb its own noun; `harness.*` would tie it to one
> reader), hand-written, `{match, class, reason}`, concatenated further-then-nearer across the cascade
> so the nearer file's entry prevails under last-match-wins. And enumeration is ONE walk: the activated
> bindings (ADR-0019) — Plan-029's scan left the resolution path before this track started.

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

- [x] P0 — refinement pass (not delegable)
- [x] P0 — item 1: top-level `ownership` key (see banner)
- [x] P0 — item 2: `composedOwnership` → `ComposedBoundary` (origin per entry; version = max)
- [x] P0 — item 3: conflicts on identical matches with differing classes; narrowing applied last,
  refused when it would widen past the highest-authority identical-match claimant (naming that
  fragment), when the class is unknown, or when the reason is missing; `sync` refuses a conflicted
  path naming both claimants — last-match-wins would be silent precedence between peers
- [x] P1 — item 4: fixtures — `cli/packages/harness/test/ownership.test.ts`, the plan's three success
  scenarios plus the bare-class/unknown-class refusals (delegated under a closed contract; verified)

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
