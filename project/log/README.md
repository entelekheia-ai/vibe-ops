# project/log/

One entry per trap or debt, addressed by the path where someone meets it again — never a narrative of a
whole piece of work (that is `project/adr/<id>-log.md`). Grouped by `path:` prefix; a group collapses to
a single breadcrumb in `RETIRED.md` once every path under it stops existing. See
[`new-log`](../../plugin/skills/new-log/SKILL.md) for how an entry is written.

## `cli/packages/core/`

- [`adding-a-second-tree-sitter-grammar-to-core.md`](adding-a-second-tree-sitter-grammar-to-core.md) — Two
  tree-sitter grammar packages in cli/packages/core/ declare peer ranges for the tree-sitter runtime that do
  not intersect; npm install ERESOLVEs until the runtime is pinned exactly and the grammar's peer is
  overridden — measure the ABI before trusting that.
