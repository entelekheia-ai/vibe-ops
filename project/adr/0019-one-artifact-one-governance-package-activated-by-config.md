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

# ADR-0019: One artifact, one governance package — activated by config

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-22 |
| Deciders | Danilo Borges |

<!-- Status lifecycle: Proposed → Accepted → (Deprecated | Superseded by ADR-XXXX) -->

---

## Context

RFC-0003 settled that a governance type resolves through npm and that its identity is the package
shipping it. Two shapes were then built in quick succession and both are corrected here. Plan-030
Tracks 1–2 put the type units in the Claude plugin tree, which an npm-only install does not have.
The first cut of Track 3 moved them into **one** package holding all five types — which coupled five
types' evolution into one version stream, and left the module/data split standing: `module-plan` served
the plan artifact while a data package elsewhere carried its template.

Separately, ADR-0018 had decided how installed packages *declare* types: a `vibeOps` manifest marker
naming a directory, found by scanning `node_modules`. The scan answers "who **could** serve this type".
Once a repository states who **does**, that question is moot — and the maintainer's direction is
exactly that: the repository's config is the registry.

## Decision

**One artifact, one governance package**, in three layers:

```
cli base:   core · cli · harness (internal module, no governance) · module-check · gates · ops-* · module-records
base:       governance-base — reusable record primitives + the defineGovernance sugar
governance: governance-adr · governance-rfc · governance-plan · governance-task · governance-log · (future: freeze-status, …)
```

- A governance package is **self-contained**: `type.json` at its root, `templates/<t>.md`,
  `migrations/`, `authoring.md`, an `ownership.json` **fragment** covering only its artifact, and the
  TypeScript coupled to its format. Behaviour equal across types lives once, in `governance-base`, and
  is *sugared* per type (`defineGovernance`); adr and rfc are pure sugar.
- **Activation is the repository's `vibeops.config`**: shipped defaults
  (`{adr,rfc,plan,task,log} → @entelekheia/governance-<t>`) overlaid per key by `config.types`. Values
  use RFC-0003's id format — a package name, with `#<type>` when the package's type name differs from
  the local key. The CLI routes nouns and resolves facets through this map, importing the bound
  package; `defineGovernance` stamps the package's root and parsed unit onto the plugin it returns, so
  one import answers verbs and data.
- A facet resolves: repository's own `types/` → the activated package → pinned tree
  (`harness.source` → `--source` → `CLAUDE_PLUGIN_ROOT`, now a legacy pin).
- **This supersedes ADR-0018.** The manifest marker and the `node_modules` scan leave the resolution
  path. Importing an activated package is acceptable where importing a merely-scanned one was not: a
  config binding is the repository's explicit trust declaration.

## Options considered

- **Option A — one package shipping all five types** (the first Track 3 cut) — matches RFC-0003's
  plural example identifier and is one dependency. Rejected: five types version as one; a consumer
  wanting only `plan` carries all; and the module/data split survives, so every artifact still has two
  homes.
- **Option B — scan-based discovery, ADR-0018 as built** — zero configuration, and an installed package
  is found with no declaration. Rejected as the *resolution* path: it answers a question activation
  makes moot, its ambiguity case (two claimants) exists only because nothing states who governs, and it
  forbids importing — which blocks the package from carrying the code coupled to its data.
- **Option C (chosen) — one package per artifact, activated by config** — each artifact has exactly one
  home for data *and* behaviour; a new type is a published package plus one config key in the consuming
  repository; the ambiguity case cannot arise. The cost is a config key per non-default binding and a
  dynamic import per activated noun.

## Consequences

**Easier.** Adding a type touches no existing package. A consumer takes only the governances it uses.
The Claude plugin holds no norm data and reads through CLI verbs — the CLI becomes the proxy between
the plugin and the modular governance, which is the stated end-state. Version marks stay per-type by
construction: the package's semver and the template's `<type>@<n>` never collapse.

**Harder.** Ten packages where four stood (five governances, the base, harness renamed); the workspace
build order must keep `governance-base` in the foundation pass. The composed norm (promulgation,
harness status) is assembled from several packages plus a base fragment instead of read from one tree.

**Accepted risk.** The shipped-defaults map is a hardcoded list in the CLI — the one place a new
*default* type still requires an edit. Deliberate: defaults are a product statement, not discovery.

## Related

- [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) — the protocol this implements.
- [ADR-0018](0018-a-package-declares-its-types-by-pointing-at-a-directory.md) — **superseded by this
  ADR**: the marker and the scan leave the resolution path.
- [Plan-033](../plans/033-one-artifact-one-governance.md) — the execution.
- [Plan-029](../plans/shipped/029-a-record-type-becomes-a-resolved-name.md) — the open type union and
  the `types` binding table this activation reuses.
