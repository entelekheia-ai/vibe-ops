# @entelekheia/vibe-ops-module-records

## 0.3.0

### Minor Changes

- b542c32: A style package's fragments are read from `<package>/style/`, not from the package root

  `general.md` and `<target>.md` now resolve as `style/general.md` and `style/<target>.md`, through a
  case-exact directory read rather than `existsSync`. At the root, `readme.md` occupied `README.md` on any
  case-insensitive filesystem (APFS, NTFS), so a package targeting `readme` could not document itself — and
  the existence test answered true for either spelling, serving a package's own README as its `readme`
  fragment. See ADR-0022.

  **Breaking for style packages.** A package still shipping fragments at its root contributes nothing;
  there is no fallback, because the layout it would fall back to is the one that cannot be trusted. Move
  `general.md` and each `<target>.md` into `style/`, and add `"style"` to the package's `files`.

  `@entelekheia/governance-style` is migrated and now ships a README of its own.

  `vibe-ops-cli` and `module-records` take the same bump rather than the patch a dependency rewrite would
  give them: the CLI is the globally installed surface, and a user reading a patch bump would take it and
  silently lose an externally authored style layer.

  A layer with no readable `style/` is now reported as a warning, so an unmigrated package says so instead
  of composing nothing. The warning arrives with the new CLI, so a package migrated before that CLI is
  installed loses its layer in the meantime, quietly — migrate the reader first.

### Patch Changes

- Updated dependencies [b542c32]
  - @entelekheia/governance-base@0.3.0
  - @entelekheia/vibe-ops-harness@0.2.1

## 0.2.0

### Minor Changes

- 47f5a8e: `records norm` gains a `policy` facet and a `--name` flag selecting which of a type's `facets` to serve (project/plans/040-\*.md Track 1). `NormFacet` stays a closed union.

  Five files that used to live under `plugin/references/` move into the governance package whose policy they are, each keeping its `vibe-ops-reference: <name>@N` stamp: `convergence-policy` and `template-shape-change` into `@entelekheia/governance-base` (served as `vibe-ops records norm --type base --facet policy --name convergence|migration`), `exposure-contract` into `@entelekheia/governance-classification` (`--type classification --facet policy --name exposure`), and `harness-model`/`harness-pair`/`ownership` into `@entelekheia/vibe-ops-harness`, served by a new verb on the `harness` noun rather than through the facet grammar — `vibe-ops harness policy --name model|pair|ownership` — because `harness` is CLI-internal and has no `type.json` of its own.

  The type-unit manifest (`type.json`) gains an optional `facets` field, a map of policy name to a relative path; a unit that declares `facets` and no record of its own is POLICY-ONLY, and its `template`/`authoring`/`migrations` become optional (every existing manifest keeps the original unconditional requirement — this is a guard, not a relaxation of what a record type already declares). `governance-base` itself is now activatable as the type `base`, bound by default alongside `adr`/`rfc`/`plan`/`task`/`log`, purely for its policy facets — it ships no record.

  `records norm` refuses `--facet policy` without `--name`, `--name` on any facet other than `policy`, `--facet policy --name <x>` where the type declares no such facet (naming what it does declare), and `--facet template` on a policy-only type (naming it as such).

  `references-completeness` (`cli/packages/module-check/sh/unported/checks/55-references-completeness.sh`, now `@5`) keeps the population it always had — the four record types' authoring rules and `plugin/references/`. The facets are read by a new gate instead, `facet-completeness`, composed into the `governance` ops: it resolves what the repository ACTIVATES rather than walking a path, so a consumer whose facets live inside installed packages is covered where a fragment reading `cli/packages/` would have examined zero files and passed. Zero examined reports SKIP, never a pass.

  The manifest relaxation is keyed on a unit carrying NO record field at all, not on it declaring `facets`: a manifest with both — `governance-classification` is one — keeps every field required.

- cd42823: `style` is the one type whose `types.<name>` binding is a stack, not a single package — RFC-0005 §2.1,
  Plan-040 Track 4. `@entelekheia/governance-style` ships the default layer: `general.md` (moved
  byte-identical from `plugin/references/authoring-style.md`, keeping its `authoring-style@2` stamp) plus a
  `readme.md` and an `agents-md.md` fragment for the two targets it documents.

  `types.style` takes either spelling from the RFC: a short-form array of layers (`"@pkg"`, `"@pkg/{a,b}"`
  an include scope, `"@pkg{^a,b}"` an exclude scope) or the long form `{ layers: [...], onCollision }` for a
  layer that also needs `on: "append"` or a per-key `rules` map. `core`'s `TypesConfig` widens to admit a
  `StyleBinding` under this one key; `effectiveGovernanceBindings` skips it explicitly rather than trying to
  parse it as a package name, and the new `activateGovernancePackage` primitive lets a stack layer activate
  a package directly, by name, with no `types.<name>` binding to look up.

  `@entelekheia/governance-base`'s new `composeStylePolicy` is the whole of the composition: it merges by
  SECTION (keyed by heading slug, or an explicit `<!-- key: … -->` marker), a repeated key replaces and a new
  key appends, `on`/`rules` are read from the binding and never the package, and a `<target>.md` overriding
  its own package's `general.md` is never a collision. `onCollision` (`"error" | "warn" | "off"`, default
  `"warn"`) never aborts the composer itself — only the CLI turns `"error"` into a non-zero exit.

  `records norm --type style --facet policy [--for <target>] [--explain]` serves it:
  `--for` names the artefact (absent serves the unscoped layers alone), `--explain` prints each section's
  origin package and file. `--name` is refused on `style` — its binding is a stack, not one named facet.

  The four authoring skills (`authoring-agents-md`, `authoring-readme`, `new`, `new-migration`) now read the
  style stack through this verb instead of a path under the plugin's own `references/` directory, each
  naming the target it writes; every other reader of that path (`new-signal`, `governance-plan`'s own
  authoring rules, ADR-0004) repoints the same way.

### Patch Changes

- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [93d04ca]
- Updated dependencies [c3741f0]
  - @entelekheia/governance-base@0.2.0
  - @entelekheia/vibe-ops-core@0.2.0
  - @entelekheia/vibe-ops-harness@0.2.0

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
  - @entelekheia/vibe-ops-harness@0.1.0
