# @entelekheia/governance-classification

## 0.2.0

### Minor Changes

- 47f5a8e: `records norm` gains a `policy` facet and a `--name` flag selecting which of a type's `facets` to serve (project/plans/040-\*.md Track 1). `NormFacet` stays a closed union.

  Five files that used to live under `plugin/references/` move into the governance package whose policy they are, each keeping its `vibe-ops-reference: <name>@N` stamp: `convergence-policy` and `template-shape-change` into `@entelekheia/governance-base` (served as `vibe-ops records norm --type base --facet policy --name convergence|migration`), `exposure-contract` into `@entelekheia/governance-classification` (`--type classification --facet policy --name exposure`), and `harness-model`/`harness-pair`/`ownership` into `@entelekheia/vibe-ops-harness`, served by a new verb on the `harness` noun rather than through the facet grammar — `vibe-ops harness policy --name model|pair|ownership` — because `harness` is CLI-internal and has no `type.json` of its own.

  The type-unit manifest (`type.json`) gains an optional `facets` field, a map of policy name to a relative path; a unit that declares `facets` and no record of its own is POLICY-ONLY, and its `template`/`authoring`/`migrations` become optional (every existing manifest keeps the original unconditional requirement — this is a guard, not a relaxation of what a record type already declares). `governance-base` itself is now activatable as the type `base`, bound by default alongside `adr`/`rfc`/`plan`/`task`/`log`, purely for its policy facets — it ships no record.

  `records norm` refuses `--facet policy` without `--name`, `--name` on any facet other than `policy`, `--facet policy --name <x>` where the type declares no such facet (naming what it does declare), and `--facet template` on a policy-only type (naming it as such).

  `references-completeness` (`cli/packages/module-check/sh/unported/checks/55-references-completeness.sh`, now `@5`) keeps the population it always had — the four record types' authoring rules and `plugin/references/`. The facets are read by a new gate instead, `facet-completeness`, composed into the `governance` ops: it resolves what the repository ACTIVATES rather than walking a path, so a consumer whose facets live inside installed packages is covered where a fragment reading `cli/packages/` would have examined zero files and passed. Zero examined reports SKIP, never a pass.

  The manifest relaxation is keyed on a unit carrying NO record field at all, not on it declaring `facets`: a manifest with both — `governance-classification` is one — keeps every field required.

### Patch Changes

- e259e4a: `@entelekheia/governance-license` and `@entelekheia/governance-classification` each gain an `ownership.json` fragment (project/plans/040-\*.md Track 3) — both shipped files into a repository with no declaration naming them until now.

  `@entelekheia/governance-license` also takes over what the `license-setup` skill used to ship: `scaffold/` now carries the NOTICE and AUTHORS templates, the header-check script and its two CI workflows, and the two license-rules documents — the skill names a package root instead of a file of its own. `get-license.sh`'s `fetch` and `verify` commands become two new CLI commands, `license get <id>` (`--out <file>`) and `license verify <file>` (`--id <id>`), reading the same registry (`templates/SOURCES.tsv`) and applying the same canonical-text comparison; `license list` is added too, since the skill's own Step 1 depends on it. `pin` (adding a new SPDX id) is deliberately not ported — it stays a maintainer-only, run-from-a-checkout operation, never a consumer-facing verb.

  `vibe-ops-module-check`'s `90-license-texts.sh` fragment no longer shells out to the retired `get-license.sh`; the one comparison it used (this repository's own `LICENSE` against the Apache-2.0 pin) is inlined using the same canonical-text transform, keeping the fragment dependency-free (`CHECK_VERSION` bumped to 2).

- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [c3741f0]
  - @entelekheia/governance-base@0.2.0
  - @entelekheia/vibe-ops-core@0.2.0

## 0.1.0

### Minor Changes

- 346137f: The first published version of every `vibe-ops` package.

  Until now the CLI reached its consumers as a git clone of the plugin, which meant `vibe-ops check` ran
  from whatever tree the clone happened to be pinned to. These packages make the deterministic half
  installable on its own: a repository's commit gate resolves `vibe-ops` from `PATH` and composes the ops
  its `vibeops.config` activates, with no copy of anything checked into it.

  The layout the version numbers describe: `vibe-ops-core` is the module contract every other package
  implements, `governance-*` carries one artifact type each (activated per repository, and writable by
  anyone — which is why these packages are versioned independently rather than as a locked group),
  `vibe-ops-gates` and the `ops-*` packages hold the checks, and `vibe-ops-cli` is the binary.

  Also in this release: `vibe-ops-harness` no longer declares `@entelekheia/vibe-ops-module-records` as a
  dependency. It only ever reached that package through a dynamic load by name, and declaring it closed a
  dependency cycle that npm workspaces resolve by symlink and a registry cannot. The edge now sits on
  `vibe-ops-cli`, which is what assembles an install.

  Two defects found while preparing this release, both in code that only a real install exercises:

  `vibe-ops-core` resolved gates, ops and governance packages from its own location. Node resolution walks
  up, so an executable carrying its own copies — a bundled install, a pnpm store, a consumer pinning two
  versions — was invisible to it, and a governance package reported that way is indistinguishable from a
  type nobody activated. The CLI now hands core its resolver; with none installed the previous behaviour
  is unchanged.

  `config.ops` accepts a package name or a path to a repository's own gate collection, and only the first
  was ever loaded as a module. An `ops.json` is not importable without an import attribute and a `.mjs`
  collection exports the definition rather than the plugin, so `check --self-test` answered "self-test
  could not run" and `harness catalog` skipped the ops entirely — reporting its gates as uncomposed while
  the commit gate ran them. Both now load through `loadOpsPlugin`.

### Patch Changes

- Updated dependencies [346137f]
  - @entelekheia/vibe-ops-core@0.1.0
  - @entelekheia/governance-base@0.1.0
