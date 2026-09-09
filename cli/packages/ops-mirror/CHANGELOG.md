# @entelekheia/vibe-ops-mirror

## 0.2.0

### Minor Changes

- 93d04ca: `vibe-ops harness install <target>` writes the commit gate's four files — `scripts/check.sh`, `scripts/checks/_run.sh`, `.githooks/pre-commit` and the CI workflow — from the harness package itself. They arrive by their own verb rather than through `setup scaffold` because the harness is not a governance: it has no type, no records and no binding, and its files are the apparatus a repository runs the governances through.

  A destination that already exists is kept and named. The one case that gets more than that is a `pre-commit` that does not call the gate: it is kept AND reported, because silently keeping it would leave the gate uninstalled while the run said nothing — and replacing it would delete somebody's hook.

  `dogfooding-drift` retires with its last pair (`@entelekheia/vibe-ops-mirror`). It compared the five record templates and the two governance documents this repository ships against the copies its own scaffold kept; the scaffold now reads each template from the package that owns the type, and both documents are rendered, so there is no second copy left to drift from. `55-references-completeness.sh` (`@6`) reads `plugin/references/` only where one still exists — this plugin's is gone.

### Patch Changes

- e259e4a: The `dogfooding-drift` entry's `log` pair points at `governance-knowledge/templates/log.md` — the template's new home now that `@entelekheia/governance-log` retired as a package (project/plans/040-\*.md Track 3, [ADR-0020](../project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md)).
- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [c3741f0]
  - @entelekheia/vibe-ops-core@0.2.0
  - @entelekheia/vibe-ops-gates@0.2.0

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
  - @entelekheia/vibe-ops-gates@0.1.0
