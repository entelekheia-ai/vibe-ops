# @entelekheia/governance-knowledge

## 0.2.0

### Minor Changes

- e259e4a: `@entelekheia/governance-log` retires as a package (project/plans/040-\*.md Track 3, [ADR-0020](https://github.com/entelekheia-ai/vibe-ops/blob/main/project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md)). `@entelekheia/governance-knowledge` takes its place, moved whole — same source history, same `type.json` data — and ships **two units** from one manifest: `log` (`project/log/`, unchanged in every observable way: type name, noun, MCP tool, settings key, ownership fragment's globs, template, migrations) and `learning` (`project/learnings/`, a fact that holds beyond one repository, pure sugar today — `resolve` only).

  `DEFAULT_GOVERNANCE_BINDINGS.log` now points at `@entelekheia/governance-knowledge` (no `#fragment` needed — `log` is the package's default-exported unit, from the `.` export); a repository that declares nothing about `log` sees no change. `learning` is **not** in the default bindings — a repository binds it only when it has learnings of its own to keep.

  Both units share one policy facet, `lifecycle` (`policy/lifecycle.md`, moved from `plugin/references/knowledge-lifecycle.md` with its `vibe-ops-reference: knowledge-lifecycle@1` stamp byte-identical): the promotion test that decides which of the two a fact becomes is one document, and both units can serve it.

  **Finding, not fixed here:** the CLI's bare-noun dispatch (`loadModule` in `cli/packages/cli/src/resolve.ts`) resolves a governance binding's `packageName` only, never its `#type` fragment — so `vibe-ops learning <verb>` with `types.learning` declared currently loads and runs the **same module** as `vibe-ops log <verb>` (the package's `.` export), silently. `activateGovernance` (used by `records norm`, ownership globs and template resolution) is unaffected, because a multi-unit package's `units` array carries every unit's DATA regardless of which entry module happened to load. Only the terminal/MCP verb dispatch for a _second_ noun sharing a package is affected, and only once a repository actually binds one. [ADR-0020](https://github.com/entelekheia-ai/vibe-ops/blob/main/project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md) flagged this as deferred; this release is what makes it observable.

### Patch Changes

- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [c3741f0]
  - @entelekheia/governance-base@0.2.0
  - @entelekheia/vibe-ops-core@0.2.0

<!-- Published as @entelekheia/governance-log through 0.1.0 below; renamed by Plan-040 Track 3
     (ADR-0020) when `log` moved into this multi-unit package whole, history kept rather than reset. -->

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
