# @entelekheia/governance-license

## 0.2.0

### Minor Changes

- 54a6052: A type unit may declare `scaffold` — `{ dir, files: [{ from, to }], placeholders? }` — naming every file the package writes into a repository and where each one lands (project/plans/040-\*.md Track 6). Each destination is spelled out rather than derived: a file that must arrive as `.gitignore` or `.gitkeep` is stored without its leading dot, or this repository's own tooling would apply it here instead of shipping it, and a file may be named for what it is rather than where it goes (`NOTICE.template` → `NOTICE`). The field was first shipped as a bare `"./scaffold"` string that nothing read and nothing validated; it is now refused when malformed, and a destination that leaves the target repository is refused outright.

  A unit's `lifecycle` may declare `notes`, a markdown fragment the owning package ships. `renderGovernanceRule` and `renderGovernanceDoc` build this repository's two governance documents from the activated types: the chain and everything that follows from it comes from the manifest, and the paragraphs that are genuinely prose come from that fragment, verbatim. `agents/rules/governance.md` renders whole; `GOVERNANCE.md` renders between two markers and every other line of the file is the repository's, permanently — the `shaped` half of the ownership boundary, which is what lets one document be both current with the activated types and a place someone can write.

  `facet-completeness` (now `@2`) reads scaffold entries as well as facets, so a package declaring a file it does not ship is a finding here rather than a failure in someone else's repository. It no longer skips a package that declares a scaffold and no facet — which was every scaffold entry of the package that has the most.

- e259e4a: `@entelekheia/governance-license` and `@entelekheia/governance-classification` each gain an `ownership.json` fragment (project/plans/040-\*.md Track 3) — both shipped files into a repository with no declaration naming them until now.

  `@entelekheia/governance-license` also takes over what the `license-setup` skill used to ship: `scaffold/` now carries the NOTICE and AUTHORS templates, the header-check script and its two CI workflows, and the two license-rules documents — the skill names a package root instead of a file of its own. `get-license.sh`'s `fetch` and `verify` commands become two new CLI commands, `license get <id>` (`--out <file>`) and `license verify <file>` (`--id <id>`), reading the same registry (`templates/SOURCES.tsv`) and applying the same canonical-text comparison; `license list` is added too, since the skill's own Step 1 depends on it. `pin` (adding a new SPDX id) is deliberately not ported — it stays a maintainer-only, run-from-a-checkout operation, never a consumer-facing verb.

  `vibe-ops-module-check`'s `90-license-texts.sh` fragment no longer shells out to the retired `get-license.sh`; the one comparison it used (this repository's own `LICENSE` against the Apache-2.0 pin) is inlined using the same canonical-text transform, keeping the fragment dependency-free (`CHECK_VERSION` bumped to 2).

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
