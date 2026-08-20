---
vibe-ops-template: adr@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0017: A composition names a location by token, not by path

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-20 |
| Deciders | Danilo Borges |

---

## Context

An ops entry declares where a gate looks. Until this decision, `ops-governance` named those locations as
literal paths: `paths: ["project/adr/*.md"]` and `options: { template: "<plugin>/templates/adr.md" }`.
Both are claims about a target repository's layout, made in this repository's source.

Two measured consequences. `<plugin>/` resolves to the target's root in a repository that ships no Claude
Code plugin, and the setup skill writes governance templates to `project/templates/` — never to a
root-level `templates/` — so every `template-version` entry looked where nothing writes, read the absence
as "this repository keeps no records of that type", and reported `SKIP`. The gate was inert in every
repository it was composed into since it was added. Separately, a repository that declares
`records.dirs.rfc` because it keeps RFCs under a differently-named directory saw both of its RFC entries
examine zero files while reporting `ok` — the configuration was honoured by the records resolver and
reached nothing that examines.

The repository already declares where its records and templates live, in `records.dirs` and
`records.templates`. The declaration simply never reached the half of the tooling that reads files.

## Decision

We will have a composition name a location by **token** — `<records:<type>>`, `<template:<type>>`,
`<plugin>/` — expanded by the ops from the target repository's own declaration and search order, and we
will expand tokens in `options` exactly as in `paths`.

A **declared** location is used even when it does not exist. The entry then examines zero files against
the name the repository chose, which is visible in the report and attributable to the declaration.

## Options considered

- **Option A — point the literals at `<plugin>/project/templates/<type>.md`.** Smallest possible edit and
  matches the layout every scaffolded repository has; rejected because it hardcodes a second layout guess
  in the same place the first one was wrong, and still ignores `records.templates` for a repository that
  declared something else.
- **Option B — move what the setup skill writes to a root-level `templates/`.** Makes the existing literal
  correct; rejected because it requires relocating `project/templates/` in every already-scaffolded
  repository, and it resolves a disagreement about layout by changing the layout rather than by asking the
  repository.
- **Option C — have the gate read the configuration itself.** Puts the answer where the file is opened;
  rejected because a gate is a pure detector that must not know which repository it is in (RFC-0001), and
  the records resolver lives in a package that depends on core, so core could not call it without a cycle.
- **Option D (chosen) — tokens expanded by the ops, from the repository's declaration.** Where a location
  is, is a fact about the target's layout, which is the ops's half of the split; the detector keeps
  receiving a plain path. Costs a token vocabulary that must be documented, and a search order that must
  exist in exactly one copy.

## Consequences

Easier: a repository that declares a non-default records directory or template path is now examined at the
place it declared, with no edit here. A type the tooling does not ship resolves by the generic convention
(`project/<type>`), which is what makes a pluggable type reachable at all — this decision is a
precondition of [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md).

Harder: two search orders would now drift invisibly, because both answers look like a path. The order
therefore exists once, in `cli/packages/core/src/files.ts`, and `cli/packages/records/src/layout.ts`
builds its candidate maps from it rather than restating them. Anyone adding a third consumer inherits that
obligation.

Accepted cost: a declared-but-absent location reports zero examined rather than failing. That diverges
deliberately from `findDir`/`findTemplate` in the records package, which throw for the same input — right
for a verb about to write, wrong for a gate, where an exception aborts a whole run over a misconfiguration.

Follow-up: the token vocabulary is documented in `cli/AGENTS.md`, and the prose describing the previous
asymmetry (`paths` expanded, `options` not) was deleted rather than amended, because the asymmetry is gone.

## Related

- [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) — the gate/ops split this
  applies: population is the composition's, detection is the gate's.
- [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) — builds on the generic fallback this
  decision introduces.
