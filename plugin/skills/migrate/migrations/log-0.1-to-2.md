# log 0.1 → 2 — the version joins the frontmatter that is already there

## What changed in the template

| | 0.1 | 2 |
|---|---|---|
| Where the version is declared | an HTML comment below the guidance block | the **existing** frontmatter |
| How it is written | `<!-- vibe-ops-template log@0.1 … -->` | `vibe-ops-template: log@2`, as the first key |
| Version format | `<major>.<minor>` | a single integer |
| Frontmatter | already present (`name`, `description`, `kind`, `path`, `attempted`, `source`) | the same keys, plus the version |
| Sections | — | **unchanged; none added, dropped, renamed or retyped** |

The integer is the count of shapes this template has had. `0.1` stays valid for artifacts still carrying
it and is not renamed.

## What it costs an existing artifact

**No section is dropped and no content moves.**

### This jump is NOT the same operation as the other four types

Every other record type gains a frontmatter block it did not have. **A log entry already has one**, and
that difference is the whole risk in this note:

- **Do not insert a new `---` block at offset 0.** A second frontmatter block does not merge with the
  first — it produces a document whose YAML layer at offset 0 contains only the version, with the entry's
  real metadata (`name`, `description`, `path`, …) stranded below in what is now body text. The index
  regenerates with an empty row, the hook injects nothing, and none of it errors.
- **Add the key to the block that exists**, as the first key, above `name`.

Two operations on one file:

1. **Add** `vibe-ops-template: log@2` as the first line inside the existing frontmatter.
2. **Delete** the `<!-- vibe-ops-template log@0.1 … -->` comment block, including its continuation line.
   It sits **below the guidance comment**, not above the H1 — do not search for it in the same place as
   the other four types.

### The other keys keep their order and their values

`name` must still match the filename, `kind` is still `trap` or `debt`, `path` is still a sequence, and
`attempted` is still a real date. `vibe-ops-template` is additive and the lint that reads the others is
unaffected — but it now sees one more key, so a lint asserting an exact key set needs the version added
to its allowed list in the same change.

## Mechanical vs. needs a decision

| Mechanical — apply it | Needs a decision — report it |
|---|---|
| Add `vibe-ops-template: log@2` as the first frontmatter key | — |
| Delete the stamp comment block, both lines, from below the guidance | — |
| Leave every other key, its order and its value untouched | — |
| Leave every section and heading untouched | — |

No needs-a-decision column, provided the entry actually has frontmatter. **An entry with none is not a
`0.1` log entry that lost it** — it never passed the lint, and it is reported rather than repaired here.

## Done looks like

- The entry's frontmatter opens with `vibe-ops-template: log@2`, and there is exactly **one** `---` block
  at the top of the file.
- `name`, `description`, `kind`, `path`, `attempted` and `source` are byte-identical to before.
- No `vibe-ops-template` HTML comment remains anywhere in the file.
- `vibe-ops log lint` passes, and `vibe-ops log index` regenerates a row identical to the previous one.
