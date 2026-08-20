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

# Task: Ops entries derived from type data

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/030-the-type-unit-and-the-compositions-derived-from-it.md](../plans/030-the-type-unit-and-the-compositions-derived-from-it.md), Track 2 |

> **DRAFT — refine before execution.** Depends on the sibling dossier's unit layout being settled.
> The open design question here: whether derivation happens at composition-load time inside
> `ops-governance` or the entry list becomes a parameter `defineOps` accepts — decide with RFC-0001's
> doctrine open (the ops owns population and emission; nothing about that moves).

---

## Context

Plan-030 Track 2. `cli/packages/ops-governance/src/index.ts` hand-keeps ten per-type entries for six types
(verified count, this file, 2026-08-19: four `record-header-*` + six `template-version-*`); each new type
costs two more edits here. With type units resolvable, the pair (`record-header-<t>` with the unit's
schema, `template-version-<t>` with `<template:<t>>`) is derivable per installed type. Acceptance is
byte-identical `vibe-ops governance .` output for the shipped types before/after, plus a fixture type
gaining both entries with no edit to this repository.

## Work items

The items below are the known skeleton; the refinement pass rewrites them with verified Whys.

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Derivation point decided *(design — see banner)* | S |
| 2 | P0 | The pair generated per installed type; hand-kept block removed | M |
| 3 | P0 | Before/after diff harness for the shipped types | S |
| 4 | P1 | Fixture type gains both entries | S |

## Implementation order

- [ ] P0 — refinement pass (not delegable)
- [ ] remaining order set at refinement; the diff harness is delegable once the derivation lands

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
