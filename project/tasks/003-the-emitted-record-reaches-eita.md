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

**Track 4 had to come first.** The header's `tool` is the instrument with its version, and the instrument
that produced a finding is the **gate**, not the composition. Recording the ops's version there would give
every gate in a composition the same instrument — the conflation this seam exists to remove. The dossier's
dependency arrow pointed the wrong way.

- [x] (2026-08-11) P0 — Read `gate-emit.sh` and eita's translator; the required shape is a header line
      plus one finding line **per rule with a count**, never one line per finding, and never a zero
- [x] (2026-08-11) P0 — `defineOps` aggregates findings by rule and passes population, unit, moment and
      the gate's own `id@version` into the emitter
- [x] (2026-08-11) P0 — Record rewritten; `schemaVersion` added; **one artifact per signal**
      (`<ops>.<entry>.jsonl`), because the header describes one producer over one population
- [x] (2026-08-11) P0 — **Proved end to end against eita's own translator**, in three directions: the old
      flat shape fails at line 1 (the silent failure this repository shipped with); a zero count is
      refused at line 2, so the parser is genuinely running over the new shape; and a known producer
      yields a full report carrying `"client": "…:template-version@1"` — the gate version reaching eita
- [x] (2026-08-11) P1 — Old artifacts deleted and regenerated; `cli/AGENTS.md`'s claim corrected
- [x] (2026-08-11) P1 — Header shape asserted in `core`, `ops-agents-md` and `ops-governance` tests

**Where this legitimately stops.** Our producers still do not route: eita answers
`producer "template-version-plan" has no observation this translator can route it to — add it to
PRODUCER_OBSERVATION rather than guessing at the nearest existing one`. That is the receiving side
refusing to guess, working as designed, and Plan-012's scope says in as many words that what the
framework does with an observation is not this plan's to redefine. Choosing which trait each producer
feeds is a decision in that repository, not here.

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: the emitter had never produced anything ingestible, and nothing anywhere said so — the
  failure was at line 1 of every file it ever wrote.
  Evidence: feeding eita's translator the old flat record returns `line 1 must open with
  {"kind":"gate",…}`. Meanwhile the shell path's observations are in eita's registry. Two producers wrote
  into one directory for as long as both existed, one of them readable and one not, and `cli/AGENTS.md`
  asserted they shared a shape. Nothing failed, nothing warned: emission succeeded, the file appeared,
  and the only thing missing was a reader — which is the shape of every defect in this plan.

- Observation: `defineGate`'s validation only ever protected gates that called `defineGate`.
  Evidence: `loadGate` checked that `definition` exists and `run` is a function, and nothing else. A gate
  exporting a bare object — which nothing forbids, and which every test fixture in this repository does —
  reached the emitter intact and produced `tool: "<id>@undefined"`. eita accepts that: it is a non-empty
  string. So an absent version would have become a plausible record in the registry, silently, which is
  the failure the version was added to prevent. The rules now live in `assertGateDefinition` and are
  enforced at both boundaries, because the one that matters is the one a foreign gate crosses.

- Observation: a rule that found nothing writes no line, and the population is what separates that from
  not having looked.
  Evidence: eita refuses `count: 0` outright — *"a rule that found nothing has no finding line to write,
  not one that says so"*. A clean reading is therefore a header alone, and `population.examined` is the
  only thing distinguishing it from a run that examined nothing. That is the same rule as
  `harness-pair.md`'s "zero examined is not a reading", enforced from the receiving side.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
