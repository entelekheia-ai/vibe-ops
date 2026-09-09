# @entelekheia/vibe-ops-cli

## 0.2.0

### Minor Changes

- c7d4e3c: A new package, `@entelekheia/governance-instructions`, owns the instruction surface — `AGENTS.md`'s
  `CLAUDE.md` import, the `.agents/` ↔ `.claude/` bridge, and `repo-guardrails.md` (project/plans/040-\*.md
  Track 5, RFC-0005 §2). It ships no record and no gate — it is policy-only, the same shape
  `@entelekheia/governance-base` uses, with `numbered: false` and no `template`/`authoring`/`migrations` in
  its `type.json` — and gates keep resolving from `@entelekheia/vibe-ops-gates` alone (RFC-0001); the
  `agents-md` ops is unchanged.

  `instruction-surfaces.md` moves from `plugin/references/` into the package as a `policy` facet, keeping its
  `vibe-ops-reference: instruction-surfaces@1` stamp byte-identical: `vibe-ops records norm --type
instructions --facet policy --name surfaces --print`. Every skill and gate that read it by path now names
  that command instead.

  Three files move out of `plugin/skills/setup/templates/` into the package's own `scaffold/` directory,
  mirroring their destination-relative shape (`scaffold/root/CLAUDE.md`, `scaffold/agents/rules/repo-
guardrails.md`, `scaffold/agents/skills/gitkeep`) and declared under a new `scaffold` key in `type.json` —
  inert until Plan-040 Track 6 builds the `setup scaffold` composition that reads it, the same "declare now,
  wire later" precedent Track 2 set for `lifecycle`. The package's own `ownership.json` fragment classifies
  `CLAUDE.md` as `norm` and `.agents/rules/repo-guardrails.md` / `.agents/skills/.gitkeep` as `seed` — the
  guardrails file ships with a `TODO` placeholder for the operator, which is why it is `seed` rather than
  `norm`. The three matching entries move out of `@entelekheia/vibe-ops-harness`'s own base `ownership.json`
  fragment, which no longer needs to carry paths a single package now owns; this changes no repository's
  composed classification for any of the three, because `instructions` joins `DEFAULT_GOVERNANCE_BINDINGS`
  in the same commit.

  `instructions: "@entelekheia/governance-instructions"` joins `DEFAULT_GOVERNANCE_BINDINGS` in
  `@entelekheia/vibe-ops-core`, alongside `base` — bound by default, like `base`, because the instruction
  surface is universal rather than opt-in the way `license`/`classification` are.

- e259e4a: `@entelekheia/governance-log` retires as a package (project/plans/040-\*.md Track 3, [ADR-0020](https://github.com/entelekheia-ai/vibe-ops/blob/main/project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md)). `@entelekheia/governance-knowledge` takes its place, moved whole — same source history, same `type.json` data — and ships **two units** from one manifest: `log` (`project/log/`, unchanged in every observable way: type name, noun, MCP tool, settings key, ownership fragment's globs, template, migrations) and `learning` (`project/learnings/`, a fact that holds beyond one repository, pure sugar today — `resolve` only).

  `DEFAULT_GOVERNANCE_BINDINGS.log` now points at `@entelekheia/governance-knowledge` (no `#fragment` needed — `log` is the package's default-exported unit, from the `.` export); a repository that declares nothing about `log` sees no change. `learning` is **not** in the default bindings — a repository binds it only when it has learnings of its own to keep.

  Both units share one policy facet, `lifecycle` (`policy/lifecycle.md`, moved from `plugin/references/knowledge-lifecycle.md` with its `vibe-ops-reference: knowledge-lifecycle@1` stamp byte-identical): the promotion test that decides which of the two a fact becomes is one document, and both units can serve it.

  **Finding, not fixed here:** the CLI's bare-noun dispatch (`loadModule` in `cli/packages/cli/src/resolve.ts`) resolves a governance binding's `packageName` only, never its `#type` fragment — so `vibe-ops learning <verb>` with `types.learning` declared currently loads and runs the **same module** as `vibe-ops log <verb>` (the package's `.` export), silently. `activateGovernance` (used by `records norm`, ownership globs and template resolution) is unaffected, because a multi-unit package's `units` array carries every unit's DATA regardless of which entry module happened to load. Only the terminal/MCP verb dispatch for a _second_ noun sharing a package is affected, and only once a repository actually binds one. [ADR-0020](https://github.com/entelekheia-ai/vibe-ops/blob/main/project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md) flagged this as deferred; this release is what makes it observable.

- 01bf2db: Two more `plugin/hooks/*.sh` scripts become CLI hook surfaces (project/plans/040-\*.md Track 7): `vibe-ops hook plan-progress` replaces `plan-progress-nudge.sh`, and `vibe-ops hook session-cleanup` replaces `session-state-cleanup.sh`. The nudge's decision logic — which plan, if any, this turn should be asked about — is now `planProgressNudge`, exported by `@entelekheia/governance-plan`; the transcript-reading helper that used to be `plugin/scripts/session-touched-repos.sh` is now a CLI-internal function (`touchedRepos`). Both new surfaces take `--state-dir`, supplied by `hooks.json`'s own `${CLAUDE_PLUGIN_DATA}` expansion, instead of reading that (or any other host) environment variable themselves. Behaviour is the scripts' behaviour in every case a test covers, and differs in four measured ways, all of them narrowing what the hook says: the status row is read through the same header-table reader every other plan verb uses rather than by grepping any matching line, so a plan whose `Shipped` header disagrees with a stray row in its body is no longer named; the plan-was-written test is an exact path match rather than a substring, so writing `001-plan.md.bak` no longer silences the plan itself; the scan reads the live plans directory only, never an archival subdirectory; and the once-per-day log's timestamp now carries milliseconds.
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

- c3741f0: `vibe-ops setup plan|scaffold <target> [NAME=value …]` — the scaffold as a composition of what the target activates, never a template directory of its own (project/plans/040-\*.md Track 6). Every file comes from a package that declares it in its own `scaffold`, each record template is read from the package that owns the type rather than from a second copy, each type's records directory comes from its `dirs`, and the two governance documents are rendered from the activated types.

  `plan` and `scaffold` are the same traversal, and `plan` writes nothing: a dry run implemented separately is a second implementation, and what it would drift about is what a tool is about to write into somebody's repository.

  Three properties worth naming, each covered by a test. A destination that already exists is kept and reported, not overwritten — this is the FIRST write into a repository, where the honest default is that anything already there was put there by someone; `--force <path>` names an exception. `GOVERNANCE.md` is `shaped`: a second run re-renders the lifecycles and leaves every other line of the file alone. And a placeholder nobody answered is left standing rather than emptied, because `{{PKG_NAME}}` in a written file is visible and greppable while an empty string where a name belongs is a file that looks finished and is not.

### Patch Changes

- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [e259e4a]
- Updated dependencies [e259e4a]
- Updated dependencies [01bf2db]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [93d04ca]
- Updated dependencies [c3741f0]
  - @entelekheia/governance-base@0.2.0
  - @entelekheia/vibe-ops-core@0.2.0
  - @entelekheia/vibe-ops-gates@0.2.0
  - @entelekheia/governance-instructions@0.2.0
  - @entelekheia/governance-license@0.2.0
  - @entelekheia/governance-plan@0.2.0
  - @entelekheia/vibe-ops-harness@0.2.0
  - @entelekheia/governance-knowledge@0.2.0
  - @entelekheia/governance-classification@0.2.0
  - @entelekheia/vibe-ops-module-check@0.1.2
  - @entelekheia/vibe-ops-mirror@0.2.0
  - @entelekheia/vibe-ops-module-records@0.2.0
  - @entelekheia/vibe-ops-governance@0.2.0
  - @entelekheia/governance-style@0.2.0
  - @entelekheia/vibe-ops-module-setup@0.2.0
  - @entelekheia/governance-adr@0.1.1
  - @entelekheia/governance-rfc@0.1.1
  - @entelekheia/governance-task@0.1.1
  - @entelekheia/vibe-ops-module-config@0.1.1
  - @entelekheia/vibe-ops-module-ownership@0.1.1
  - @entelekheia/vibe-ops-agents-md@0.1.1
  - @entelekheia/vibe-ops-exposure@0.1.1
  - @entelekheia/vibe-ops-for-vibe-ops@0.1.1

## 0.1.1

### Patch Changes

- No package is bundled any more, because a bundled default is not opt-in

  `bundleDependencies` is gone from the CLI, and the eighteen packages that travelled inside its tarball
  are published in their own right. It was wrong twice over. It broke `npm i -g` outright: a global
  install cannot hoist, so `@entelekheia/vibe-ops-core` and `@entelekheia/governance-base` had to land in
  the same `node_modules/@entelekheia/` the bundle already occupied, npm extracted neither, and every
  command died on `Cannot find package '@entelekheia/vibe-ops-core'`. And it contradicted what
  `config.types` is for: a record type bound to `@acme/jira-plan` still had `@entelekheia/governance-plan`
  sitting in the install, present because the CLI carried it rather than because anyone asked for it.

  Nothing about installing changes for someone who wants the defaults — `npm i -g @entelekheia/vibe-ops-cli`
  still resolves the closure in one command.

- The gate's refusal names the registry install, not a checkout

  `check.sh` refuses with `npm i -g @entelekheia/vibe-ops-cli` first, and offers `npm link -w` second as
  the path for someone working on this repository. Until the CLI was published there was only the second,
  so a machine without `vibe-ops` was told to clone a repository before it could commit — advice that was
  correct for a contributor to vibe-ops and useless to everyone else the gate refuses.

- Updated dependencies
  - @entelekheia/vibe-ops-module-check@0.1.1

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
  - @entelekheia/governance-adr@0.1.0
  - @entelekheia/governance-classification@0.1.0
  - @entelekheia/governance-license@0.1.0
  - @entelekheia/governance-log@0.1.0
  - @entelekheia/governance-plan@0.1.0
  - @entelekheia/governance-rfc@0.1.0
  - @entelekheia/governance-task@0.1.0
  - @entelekheia/vibe-ops-gates@0.1.0
  - @entelekheia/vibe-ops-agents-md@0.1.0
  - @entelekheia/vibe-ops-governance@0.1.0
  - @entelekheia/vibe-ops-for-vibe-ops@0.1.0
  - @entelekheia/vibe-ops-module-check@0.1.0
  - @entelekheia/vibe-ops-harness@0.1.0
  - @entelekheia/vibe-ops-module-records@0.1.0
  - @entelekheia/vibe-ops-exposure@0.1.0
  - @entelekheia/vibe-ops-mirror@0.1.0
  - @entelekheia/vibe-ops-module-config@0.1.0
  - @entelekheia/vibe-ops-module-ownership@0.1.0
