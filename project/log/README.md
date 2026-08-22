# project/log/

One entry per trap or debt, addressed by the path where someone meets it again — never a narrative of a
whole piece of work (that is `project/adr/<id>-log.md`). Grouped by `path:` prefix; a group collapses to
a single breadcrumb in `RETIRED.md` once every path under it stops existing. See
[`new-log`](../../plugin/skills/new-log/SKILL.md) for how an entry is written.

## `(repository root)`

- [`adding-a-second-foundation-package-to-the-cli-workspace.md`](adding-a-second-foundation-package-to-the-cli-workspace.md) —
  A workspace package that other packages import but that sorts after them alphabetically is built against
  its stale dist/ by `npm run build --workspaces`, which typechecks and reports success; the fix is a line
  in build:foundation, and nothing detects the next one.
- [`composing-a-gate-over-a-population-the-ops-already-ignores.md`](composing-a-gate-over-a-population-the-ops-already-ignores.md) —
  A gate added to an ops whose `ignore` blankets its population under `"*"` reports `0 examined` and passes;
  the exclusion belongs to the entry that needs it, not to the ops.

## `cli/packages/cli/src/`

- [`harness-status-plugin-root-fallback-unverified.md`](harness-status-plugin-root-fallback-unverified.md) —
  CLAUDE_PLUGIN_ROOT as an env-var fallback for the source/target seam is unverified for a Claude Code hook
  subprocess specifically — do not drop the explicit --plugin/--source flag on the strength of it alone.

## `cli/packages/core/`

- [`adding-a-second-tree-sitter-grammar-to-core.md`](adding-a-second-tree-sitter-grammar-to-core.md) — Two
  tree-sitter grammar packages in cli/packages/core/ declare peer ranges for the tree-sitter runtime that do
  not intersect; npm install ERESOLVEs until the runtime is pinned exactly and the grammar's peer is
  overridden — measure the ABI before trusting that.

## `cli/packages/core/src/`

- [`a-stray-config-under-tmp-reaches-every-fixture-repository.md`](a-stray-config-under-tmp-reaches-every-fixture-repository.md) —
  A leaked vibeops.config.local.mjs sitting in /private/tmp was picked up by the config cascade of every
  temp-dir fixture repository below it — a virgin scratch install reported harness.applied it never had, and
  nothing looked wrong from inside the repo.
- [`asking-resolveplugindir-where-the-tool-keeps-its-own-files.md`](asking-resolveplugindir-where-the-tool-keeps-its-own-files.md) —
  `resolvePluginDir` answers "where is the TARGET's plugin surface", so using it to locate files the tooling
  ships — templates, migration notes — resolves to the target's root in a flat repo, where nothing writes;
  the failure is a silent SKIP or a blocking `unhandled`, never an error.
- [`emitting-an-observation-nothing-can-read.md`](emitting-an-observation-nothing-can-read.md) — The
  TypeScript emitter wrote a shape the receiving translator refuses at line 1, for its whole existence,
  while the shell producer beside it was ingested normally — emission succeeding says a file was written,
  never that anything can read it.

## `cli/packages/gates/test/`

- [`gate-fixture-population-check-outside-reporoot.md`](gate-fixture-population-check-outside-reporoot.md) —
  A gate test whose fixture needs a path OUTSIDE repoRoot (e.g. repoRoot/..) must nest repoRoot inside its
  own mkdtemp workspace, or parallel test files silently share the same parent directory and pollute each
  other's fixtures.

## `cli/packages/records/src/`

- [`moving-a-declaration-to-offset-zero.md`](moving-a-declaration-to-offset-zero.md) — Frontmatter is found
  as the YAML layer at offset 0 and a leading copyright comment was found at NR == 1, so putting frontmatter
  first silently disabled the drift gate — moving anything to the top of a file breaks every parser anchored
  there at once, and all of them fail quietly.

## `plugin/skills/setup/templates/harness/checks/`

- [`scaffolding-a-repo-gate-after-the-scripts-split.md`](scaffolding-a-repo-gate-after-the-scripts-split.md) —
  The harness runner this repository ships still resolves a sibling vibe-ops checkout at
  ../vibe-ops/scripts/check-agents-md.sh, which moved to cli/packages/module-check/sh/ — so a repo
  scaffolded today gets a gate that refuses every commit, and the third fallback via CLAUDE_PLUGIN_ROOT can
  no longer reach the runner at all.

## `plugin/templates/`

- [`dropping-a-section-from-a-template.md`](dropping-a-section-from-a-template.md) — Removing two living
  sections from the plan template left four prose descriptions of the old shape standing — the template is
  the only copy a gate compares, so every sentence that describes it elsewhere goes stale silently and keeps
  being read as authority.
