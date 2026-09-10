# @entelekheia/governance-plan

## 0.2.2

### Patch Changes

- Updated dependencies [b542c32]
  - @entelekheia/governance-base@0.3.0

## 0.2.1

### Patch Changes

- 0b2aeb1: Six packages declared paths their tarballs did not carry, so an npm install received a manifest pointing
  at files that were not there.

  `governance-base` omitted `scaffold/` — the fifteen files `setup scaffold` writes, and the two prose
  fragments both governance documents are framed by. From a published install the verb wrote a fraction of
  a repository, and neither `GOVERNANCE.md` nor `.agents/rules/governance.md` was written at all.

  Five type packages omitted `lifecycle-notes.md`, the prose half of every rendered lifecycle section. Each
  section rendered as its heading plus the sentence saying the fragment was missing.

  Found by `facet-completeness@3` running from the global install — the artifact this repository never
  checks, because here every declared path resolves from the workspace whether or not it is published.

- Updated dependencies [0b2aeb1]
  - @entelekheia/governance-base@0.2.1

## 0.2.0

### Minor Changes

- adb3c7a: A type manifest may declare `units`, an array of full type units, so one package can serve more than one artifact (project/plans/040-\*.md Track 2, [ADR-0020](https://github.com/entelekheia-ai/vibe-ops/blob/main/project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md)). A binding picks which through the `#type` fragment RFC-0003 already defined, and the activation cache is keyed by `<package>#<type>` rather than by package name — keyed by package alone, a second binding to the same package was handed whatever the first had resolved, which is the same unit under a different name and reports no error. A manifest declaring both a top-level `type` and `units` is refused, as are two units naming the same type and an empty array.

  `defineGovernance` takes `type` to say which unit a module serves; it is required when the manifest declares several and refused when it declares one, both at load rather than at dispatch.

  A unit may declare `lifecycle` — the status `chain` in order, plus `active`, `terminal`, `living`, `archive` and `immutableFrom`, each validated against that chain. Where a type declares one, it is what `resolve` answers with; where it does not, every field is still derived from the template's own prose exactly as before. `governance-plan` declares its own, so `PLAN_ACTIVE`, `PLAN_TERMINAL` and `LIVING` now come from data instead of from parsing a template comment. A unit may also declare `targets`, the advisory artefact list a style package documents.

- 01bf2db: Two more `plugin/hooks/*.sh` scripts become CLI hook surfaces (project/plans/040-\*.md Track 7): `vibe-ops hook plan-progress` replaces `plan-progress-nudge.sh`, and `vibe-ops hook session-cleanup` replaces `session-state-cleanup.sh`. The nudge's decision logic — which plan, if any, this turn should be asked about — is now `planProgressNudge`, exported by `@entelekheia/governance-plan`; the transcript-reading helper that used to be `plugin/scripts/session-touched-repos.sh` is now a CLI-internal function (`touchedRepos`). Both new surfaces take `--state-dir`, supplied by `hooks.json`'s own `${CLAUDE_PLUGIN_DATA}` expansion, instead of reading that (or any other host) environment variable themselves. Behaviour is the scripts' behaviour in every case a test covers, and differs in four measured ways, all of them narrowing what the hook says: the status row is read through the same header-table reader every other plan verb uses rather than by grepping any matching line, so a plan whose `Shipped` header disagrees with a stray row in its body is no longer named; the plan-was-written test is an exact path match rather than a substring, so writing `001-plan.md.bak` no longer silences the plan itself; the scan reads the live plans directory only, never an archival subdirectory; and the once-per-day log's timestamp now carries milliseconds.

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
