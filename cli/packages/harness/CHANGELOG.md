# @entelekheia/vibe-ops-harness

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

- 47f5a8e: `records norm` gains a `policy` facet and a `--name` flag selecting which of a type's `facets` to serve (project/plans/040-\*.md Track 1). `NormFacet` stays a closed union.

  Five files that used to live under `plugin/references/` move into the governance package whose policy they are, each keeping its `vibe-ops-reference: <name>@N` stamp: `convergence-policy` and `template-shape-change` into `@entelekheia/governance-base` (served as `vibe-ops records norm --type base --facet policy --name convergence|migration`), `exposure-contract` into `@entelekheia/governance-classification` (`--type classification --facet policy --name exposure`), and `harness-model`/`harness-pair`/`ownership` into `@entelekheia/vibe-ops-harness`, served by a new verb on the `harness` noun rather than through the facet grammar — `vibe-ops harness policy --name model|pair|ownership` — because `harness` is CLI-internal and has no `type.json` of its own.

  The type-unit manifest (`type.json`) gains an optional `facets` field, a map of policy name to a relative path; a unit that declares `facets` and no record of its own is POLICY-ONLY, and its `template`/`authoring`/`migrations` become optional (every existing manifest keeps the original unconditional requirement — this is a guard, not a relaxation of what a record type already declares). `governance-base` itself is now activatable as the type `base`, bound by default alongside `adr`/`rfc`/`plan`/`task`/`log`, purely for its policy facets — it ships no record.

  `records norm` refuses `--facet policy` without `--name`, `--name` on any facet other than `policy`, `--facet policy --name <x>` where the type declares no such facet (naming what it does declare), and `--facet template` on a policy-only type (naming it as such).

  `references-completeness` (`cli/packages/module-check/sh/unported/checks/55-references-completeness.sh`, now `@5`) keeps the population it always had — the four record types' authoring rules and `plugin/references/`. The facets are read by a new gate instead, `facet-completeness`, composed into the `governance` ops: it resolves what the repository ACTIVATES rather than walking a path, so a consumer whose facets live inside installed packages is covered where a fragment reading `cli/packages/` would have examined zero files and passed. Zero examined reports SKIP, never a pass.

  The manifest relaxation is keyed on a unit carrying NO record field at all, not on it declaring `facets`: a manifest with both — `governance-classification` is one — keeps every field required.

- 93d04ca: `vibe-ops harness install <target>` writes the commit gate's four files — `scripts/check.sh`, `scripts/checks/_run.sh`, `.githooks/pre-commit` and the CI workflow — from the harness package itself. They arrive by their own verb rather than through `setup scaffold` because the harness is not a governance: it has no type, no records and no binding, and its files are the apparatus a repository runs the governances through.

  A destination that already exists is kept and named. The one case that gets more than that is a `pre-commit` that does not call the gate: it is kept AND reported, because silently keeping it would leave the gate uninstalled while the run said nothing — and replacing it would delete somebody's hook.

  `dogfooding-drift` retires with its last pair (`@entelekheia/vibe-ops-mirror`). It compared the five record templates and the two governance documents this repository ships against the copies its own scaffold kept; the scaffold now reads each template from the package that owns the type, and both documents are rendered, so there is no second copy left to drift from. `55-references-completeness.sh` (`@6`) reads `plugin/references/` only where one still exists — this plugin's is gone.

### Patch Changes

- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [e259e4a]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [93d04ca]
- Updated dependencies [c3741f0]
  - @entelekheia/governance-base@0.2.0
  - @entelekheia/vibe-ops-core@0.2.0
  - @entelekheia/vibe-ops-gates@0.2.0
  - @entelekheia/vibe-ops-module-check@0.1.2
  - @entelekheia/vibe-ops-governance@0.2.0
  - @entelekheia/vibe-ops-agents-md@0.1.1
  - @entelekheia/vibe-ops-for-vibe-ops@0.1.1

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
  - @entelekheia/vibe-ops-gates@0.1.0
  - @entelekheia/vibe-ops-agents-md@0.1.0
  - @entelekheia/vibe-ops-governance@0.1.0
  - @entelekheia/vibe-ops-for-vibe-ops@0.1.0
  - @entelekheia/vibe-ops-module-check@0.1.0
