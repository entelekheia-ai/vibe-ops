---
vibe-ops-template: plan@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-034: The ops become data, and the governances feed them

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-22 |
| Author | Danilo Borges |
| Depends on | [Plan-033](./shipped/033-one-artifact-one-governance.md) |
| Related | [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) · [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md) |

---

## Summary

Two directions decided during Plan-033 and deferred to their own plan, joined here because they touch
the same object. **The per-type entries of `ops-governance` are still hand-written**: four
`record-header`, one `record-frontmatter` and six `template-version` entries carrying `required` lists
copied from the governance packages' own `type.json`, held in step by a guard test — the duplication
window Plan-030 Track 2 opened "until Track 4", which Plan-033 superseded without closing. And **the ops'
canonical form becomes `.json`** — measured 2026-08-22: the three ops' entry lists contain zero
functions, fixtures included, so the collection is already data that happens to be spelled in
TypeScript. Deriving and serialising are one design problem: a static `ops.json` cannot hold per-type
entries, so the data form must carry the derivation as a *rule* ("for each activated governance, emit
the entry its carrier calls for"), not as a longer list.

## Goals

- `ops-governance`'s per-type entries are derived from the activated governances, keyed by
  `schema.carrier` (`table` → `record-header`, `frontmatter` → `record-frontmatter`) plus a
  `template-version` entry each. The `required` literals and the manifest-agreement guard test are
  deleted together — the derivation supersedes both.
- The `template-version-research` entry is deleted rather than derived (the type entered by mistake;
  Plan-030's Decision Log carries the rationale). The one declared output difference of this plan.
- An ops' collection has a canonical `.json` form loadable by `defineOps`; the three shipped ops move to
  it, keeping their TS packages as typing sugar over the same data.
- A fixture governance package, bound in a fixture repository's `types`, gains its entries with **zero
  edits to this repository** — the acceptance Plan-030 Track 4 promised.

## Scope

### In scope

The derivation rule and its `.json` spelling; the structural change it needs — `OpsDefinition.gates` is
a static array read once at `defineOps` time, and a per-repository entry list needs it computable from
the repository being run against; the literals' and guard's deletion; the research entry's deletion.

### Out of scope

- The audience boundary (`portable`/`internal`) — [Plan-035](035-the-audience-boundary.md).
- A governance package shipping its own *gate* (executable code) — still deferred by RFC-0003.
- npm publication of the packages (raised in Open questions; owned by the release train, not here).

## Design

*To refine at execution start; the fixed points:* RFC-0001's doctrine is unchanged — the ops owns
population and emission; only where the entry list comes from changes. Labels and rules stay
`<gate>-<type>` so `ignore`/`disabled`/`level` keys keep binding. The derivation reads the activated
governances through the same map every other reader uses (ADR-0019); a bound-but-uninstalled type
yields a finding, never a silent gap.

## Read these first

Written 2026-08-22 at closure of Plan-033, so a session starting cold does not re-derive coordinates.

1. **`cli/packages/ops-governance/src/index.ts`** — `RESTATED_TYPE_ENTRIES` is the block to delete: four
   `record-header` entries plus `record-frontmatter-log`, each carrying a literal `required` copied from
   a `type.json`. The six `template-version` entries follow it, each with `options.template:
   "<template:<t>>"`. `template-version-research` is the one to delete outright — it sits disabled in
   `vibeops.config.ts` with its reason.
2. **`cli/packages/ops-governance/test/ops.test.ts`**, test *"every entry's required list still agrees
   with the type unit it restates"* — the guard holding the literals to
   `cli/packages/governance-<type>/type.json`. It dies with them, in the same change.
3. **`cli/packages/core/src/governance-map.ts`** — `effectiveGovernanceBindings` and
   `activateGovernance` are the readers to derive from; `activatedTemplatePaths` shows the pattern of
   walking every bound type once per run. Activation is cached per process.
4. **`cli/packages/core/src/ops.ts`** — `OpsDefinition.gates` is a static array read at `defineOps`
   time (the emit-id check) **and** iterated per run. Making the list a function of the repository
   touches both readers; that is the one structural change this plan cannot avoid.
5. **`cli/packages/core/src/module.ts`**, `defineModule`'s validation — the precedent for "a definition
   that describes itself wrongly fails at load", which the `.json` loader must keep.

**Measured, do not re-measure:** the three ops' entry lists contain zero functions — fixtures are string
maps — so the collection is already data. Verified 2026-08-22 by reading all three sources.

## Tracks

- [ ] **Track 1 — Entries derived from the activated governances.** `OpsDefinition.gates` becomes
  computable; the ten literals and the guard test go. Acceptance: `vibe-ops governance .` diffed
  before/after differs only by the removed `research` entry; the fixture-package case.
- [ ] **Track 2 — The canonical `.json` collection.** `defineOps` loads it; the three ops move; TS
  stays as sugar. Acceptance: byte-identical `--list` and run output for all three ops.
- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the file kept.

## Success criteria

- No gate and no ops entry in this repository restates a field list a `type.json` declares.
- A repository binding a sixth governance package sees `record-header-<t>` (or `-frontmatter-`) and
  `template-version-<t>` entries appear with no edit here.
- `vibe-ops governance .` on this repository: identical to today except `template-version-research`
  gone.

---

## Decision Log

- Decision: derivation and serialisation land in one plan.
  Rationale: a static `.json` with hand-written per-type entries would re-open the duplication the
  derivation closes; the data form must carry the rule, so the two designs constrain each other.
  Date / Author: 2026-08-22 / Danilo Borges

## Outcomes & Retrospective

(No outcomes yet.)

---

## Open questions

- **The packages are unpublished.** Every `@entelekheia/*` package is version `0.0.1` and only exists in
  this workspace; the npm-only story is real outside it only after a publish. The release train owns
  when; this plan's fixture acceptance must not depend on the registry either way.

## Related

- Plan-030 Track 4's dossier, closed at the supersession:
  `git show f0ffb6995888ad41171ee142dc5ec4653a57486e:project/tasks/ops-entries-derived-from-type-data.md`
