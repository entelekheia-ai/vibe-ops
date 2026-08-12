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

## `cli/packages/core/`

- [`adding-a-second-tree-sitter-grammar-to-core.md`](adding-a-second-tree-sitter-grammar-to-core.md) — Two
  tree-sitter grammar packages in cli/packages/core/ declare peer ranges for the tree-sitter runtime that do
  not intersect; npm install ERESOLVEs until the runtime is pinned exactly and the grammar's peer is
  overridden — measure the ABI before trusting that.

## `cli/packages/core/src/`

- [`emitting-an-observation-nothing-can-read.md`](emitting-an-observation-nothing-can-read.md) — The
  TypeScript emitter wrote a shape the receiving translator refuses at line 1, for its whole existence,
  while the shell producer beside it was ingested normally — emission succeeding says a file was written,
  never that anything can read it.

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
