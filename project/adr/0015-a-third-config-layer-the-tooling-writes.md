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

# ADR-0015: A third configuration layer, written by the tooling rather than by a person

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-14 |
| Deciders | Danilo Borges |
| Related | [ADR-0014](0014-clone-local-configuration-layers-rather-than-replaces.md) |

---

> **Amended by [RFC-0004](../rfc/implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md) (2026-09-03):** the
> third layer this ADR added, `vibeops.config.local.json`, is retired; the tooling's layer is the committed
> `vibeops.config.json`, read at the repository toplevel and written inside the promulgation commit.

## Context

[ADR-0014](0014-clone-local-configuration-layers-rather-than-replaces.md) established that each directory
on the configuration cascade holds a **pair** of files — a committed one and a clone-local one — and that
the local file *layers over* the committed one rather than replacing it. Both are authored by people.

Promulgation introduces a writer. `vibe-ops harness sync` has to record which version of the norm it put
into a clone, or the question the whole mechanism exists to answer — *which repositories are on version
N?* — stays unanswered by the act that should answer it. The ownership declaration classes
`vibeops.config.local.*` as belonging to the repository precisely so that promulgation updates its own key
through the module that owns it rather than rewriting a file it does not own.

Two facts constrain where that key can live. All three existing local filenames are **executable** —
`.ts`, `.mjs`, `.js` — and a program editing someone's TypeScript to change one key is a failure mode this
repository does not need. And `loadOne()` takes the **first match within each half** of the filename list,
so a fourth name in the local half is not additive: a clone holding both it and a `vibeops.config.local.ts`
would load exactly one of them, silently, whichever the ordering put first.

## Decision

We will add `vibeops.config.local.json` as a **third layer** of the cascade — not a fourth filename in its
local half — ranked nearest, parsed rather than imported, and written only by `writeHarnessState`.

We will also narrow ADR-0014's whole-key merge. `harness.applied` continues to merge nearest-wins **whole**;
`harness.boundary` and `harness.source` layer per key like every other setting.

## Options considered

- **Option A — a fourth filename in the local half.** No new concept, and the file sits where a reader
  would look for it. Rejected on measurement: first-match-per-half means it and an operator's
  `vibeops.config.local.ts` are mutually exclusive, and losing either the machine's state or the
  operator's overrides would happen silently.
- **Option B — edit `vibeops.config.local.ts` in place, updating one key.** Keeps the file count where it
  is. Rejected: it means a program parsing and rewriting TypeScript that a person owns, and the failure
  mode of getting that wrong is someone else's configuration.
- **Option C — a state file outside the cascade entirely**, read directly by the harness module. Clean
  separation of machine state from human configuration. Rejected because the reading half already
  shipped against `config.harness.applied`, and moving the storage would have meant two ways to answer
  one question during the transition.
- **Option D (chosen) — a third layer, machine-owned, JSON.** The operator keeps declaring preferences in
  a file they own; this one carries only what was promulgated; neither shadows the other.

## Consequences

**Easier.** A program can record state without touching a human's file, and an operator can keep
declaring `harness.source` in the file they already use. Both compose without either party knowing about
the other's file.

**Harder.** There are now three files per directory rather than two, and the reason the third exists is
not visible from its name — which is why `cli/AGENTS.md` states the first-match-per-half constraint
explicitly rather than leaving it to be rediscovered.

**A new obligation.** `vibeops.config.local.json` must be gitignored wherever it can appear. Tracking it
would turn every promulgation into a diff in a file the repository owns, which is the outcome this whole
design exists to avoid. It is ignored in this repository and in the scaffold `/vibe-ops:setup repo`
writes; a repository that predates that entry will need it added.

**Amended, not superseded.** ADR-0014's rule stands for the pair it was written about. What changed is
that the whole-key merge it implied for `harness` applies to the `applied` map alone — a rule about the
map, not about the key it lives under, and the two stopped being the same thing the moment a
machine-written file could rank nearer than the one an operator declares `source` in.

## Related

- [Plan-025](../plans/shipped/025-the-harness-module-and-the-norm-it-promulgates.md) — the plan whose Track 5
  produced this, and whose Decision Log records the reasoning as it was made.
- [ADR-0014](0014-clone-local-configuration-layers-rather-than-replaces.md) — the layering rule this
  extends.
