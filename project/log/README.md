# project/log/

One entry per trap or debt, addressed by the path where someone meets it again — never a narrative of a
whole piece of work (that is `project/adr/<id>-log.md`). Grouped by `path:` prefix; a group collapses to
a single breadcrumb in `RETIRED.md` once every path under it stops existing. See
[`new-log`](../../plugin/skills/new-log/SKILL.md) for how an entry is written.

## `cli/packages/core/`

- [`adding-a-second-tree-sitter-grammar-to-core.md`](adding-a-second-tree-sitter-grammar-to-core.md) —
  two tree-sitter grammar packages declare peer ranges that do not intersect; measure the ABI before
  trusting an override.
