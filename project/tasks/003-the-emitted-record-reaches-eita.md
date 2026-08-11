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

# Task: The emitted record reaches eita

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-11 |
| Author | Danilo Borges |
| Issue | none — internal work, no issue opened (Plan-012 Decision Log) |
| Plan | [`plans/012-versions-travel-with-the-record.md`](../plans/012-versions-travel-with-the-record.md) — Track 3 |

---

## Context

**The destination is eita.** An artifact this repository emits is not a local log — it is an observation
that lands in eita's registry through eita's own translator, and everything below follows from that being
the actual reader rather than a future one.

Two emission paths exist and they write different shapes into the same directory.

`cli/packages/module-check/sh/gate-emit.sh` writes a header line declaring `kind:"gate"`, the producer,
the instrument as `<name>@<version>`, the moment and `population.examined`, followed by `kind:"finding"`
lines. eita's translator validates that header and **refuses** a file that does not open with it.

`cli/packages/core/src/emit.ts` writes one flat object per observation —
`{observedAt, producer, repo, id, subject, value, tags}` — with no `kind`, no instrument-with-version, no
moment and no population.

Verified 2026-08-11: the shell path is ingested and its observations are in eita's registry; nothing the
TypeScript emitter has ever written can be. Fifty-seven lines sit in `.git/gate-artifacts/` that no
consumer can read. `cli/AGENTS.md` states the two producers land in one registry, which is not true today.

Plan-012 decided the direction: the emitter converges on the shape eita already accepts, rather than eita
growing a branch per producer shape.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `emit.ts` writes the header-plus-findings shape | M |
| 2 | P0 | The record carries its own schema version | S |
| 3 | P0 | Population and moment reach the emitter | M |
| 4 | P0 | Prove ingestion end to end, not shape conformance | S |
| 5 | P1 | Delete the unreadable artifacts; correct the `cli/AGENTS.md` claim | S |

### 1. `emit.ts` writes the header-plus-findings shape — P0

**What:** `createEmitter` opens an artifact with the header line and appends findings under it.
**Why:** it is the only shape with a reader.
**Change:** read `gate-emit.sh` and eita's translator for the exact field set before writing anything —
between them they are the specification, and the translator validates field by field.

### 2. The record carries its own schema version — P0

**What:** a `schemaVersion` on the header line, as the integer form Plan-012 decided for instrument
versions.
**Why:** two producers already write into one directory, and after this task there will have been two
TypeScript shapes as well. A consumer with no version has no way to tell which it is reading.
**Change:** one field, from a constant in `cli/packages/core/src/emit.ts`.

### 3. Population and moment reach the emitter — P0

**What:** `examined` and the moment are knowable only to the composition, per RFC-0001.
**Why:** the header requires them, and `plugin/references/harness-pair.md` says zero examined is not a
reading.
**Change:** `defineOps` already builds the emitter and already knows the population; pass it through
`EmitterOptions` rather than letting a gate supply it.

### 4. Prove ingestion end to end — P0

**What:** run an ops, put its artifact through eita's translator, confirm it lands.
**Why:** a shape that matches a spec on paper and is refused in practice is the failure this task is
fixing. Conformance to a written field list is not the acceptance; being ingested is.
**Change:** the shell path is the working reference — compare against what it actually produces, not
against the documentation of what it produces.

### 5. Delete the unreadable artifacts, correct the claim — P1

**What:** remove `.git/gate-artifacts/*.jsonl`; fix the `cli/AGENTS.md` line asserting a shared shape.
**Why:** they are unreadable, a day old, and outside version control — Plan-012 decided against converting
them. The AGENTS.md line is a false statement about the tree.

## Implementation order

- [ ] P0 — Read `gate-emit.sh` and eita's translator; write down the exact required fields
- [ ] P0 — Thread `examined` and moment through `EmitterOptions` from `defineOps`
- [ ] P0 — Rewrite the record shape; add `schemaVersion`
- [ ] P0 — Run an ops and put the artifact through the translator; confirm it lands in the registry
- [ ] P1 — Delete the old artifacts; correct `cli/AGENTS.md`
- [ ] P1 — A test asserting the header shape, so the two producers cannot silently diverge again

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
