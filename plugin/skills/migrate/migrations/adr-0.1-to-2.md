# adr 0.1 → 2 — the version moves into the frontmatter

## What changed in the template

| | 0.1 | 2 |
|---|---|---|
| Where the version is declared | an HTML comment above the H1 | YAML frontmatter at offset 0 |
| How it is written | `<!-- vibe-ops-template adr@0.1 … -->` | `vibe-ops-template: adr@2` |
| Version format | `<major>.<minor>` | a single integer |
| Sections | — | **unchanged; none added, dropped, renamed or retyped** |

The integer is the count of shapes this template has had. `0.1` stays valid for artifacts still carrying
it and is not renamed.

## What it costs an existing artifact

**No section is dropped and no content moves.**

An ADR is **immutable once Accepted**, and this migration is the exception that proves the rule rather
than a breach of it: it changes no substance, no status and no wording of the decision. It moves a
machine-read marker. If that reading is not accepted in a given repository, the correct outcome is to
leave the ADR at `0.1` and report it — never to rewrite the decision to fit.

### The stamp comment is deleted and the frontmatter is added

1. **Delete** the `<!-- vibe-ops-template adr@0.1 … -->` comment block, including its continuation line.
2. **Insert** the frontmatter as the very first bytes of the file:

   ```yaml
   ---
   vibe-ops-template: adr@2
   ---
   ```

**The frontmatter goes at offset 0 — before whatever is currently first, not "above the licence block".**
An ADR may or may not carry a licence comment and both shapes are real in one directory. The reader
identifies frontmatter as the YAML layer starting at offset 0, so a file with *anything* ahead of it has
no frontmatter as far as every consumer is concerned, and it fails silently.

Leave one blank line after the closing `---`, then whatever the file already began with.

### `Status` and `Superseded by` stay in the header table

Neither moves into the frontmatter in this jump. An ADR's status is read by people and by the record
header gate, both of which read the table.

## Mechanical vs. needs a decision

| Mechanical — apply it | Needs a decision — report it |
|---|---|
| Delete the stamp comment block, both lines | Whether an Accepted ADR may be touched at all, where a repository reads immutability strictly |
| Insert the frontmatter at offset 0 | — |
| Write the version as `adr@2` | — |
| Leave every section, row and heading untouched | — |

## Done looks like

- The file's first three lines are `---`, `vibe-ops-template: adr@2`, `---`.
- No `vibe-ops-template` HTML comment remains anywhere in the file.
- `git diff` shows only those two edits — in particular, no change to `Status`, to the decision, or to any
  prose.
- The line count differs from the original by at most two.
