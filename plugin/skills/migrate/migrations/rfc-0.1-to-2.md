# rfc 0.1 → 2 — the version moves into the frontmatter

## What changed in the template

| | 0.1 | 2 |
|---|---|---|
| Where the version is declared | an HTML comment above the H1 | YAML frontmatter at offset 0 |
| How it is written | `<!-- vibe-ops-template rfc@0.1 … -->` | `vibe-ops-template: rfc@2` |
| Version format | `<major>.<minor>` | a single integer |
| Sections | — | **unchanged; none added, dropped, renamed or retyped** |

The integer is the count of shapes this template has had. `0.1` stays valid for artifacts still carrying
it and is not renamed.

## What it costs an existing artifact

**No section is dropped and no content moves.**

An RFC that has reached `Implemented` is **frozen** and lives under `rfc/implemented/`. The same reading
as for an accepted ADR applies: this migration changes a machine-read marker and no substance, so it is
compatible with the freeze. Where a repository reads the freeze strictly, leave the RFC at `0.1` and
report it.

### The stamp comment is deleted and the frontmatter is added

1. **Delete** the `<!-- vibe-ops-template rfc@0.1 … -->` comment block, including its continuation line.
2. **Insert** the frontmatter as the very first bytes of the file:

   ```yaml
   ---
   vibe-ops-template: rfc@2
   ---
   ```

**The frontmatter goes at offset 0 — before whatever is currently first, not "above the licence block".**
The reader identifies frontmatter as the YAML layer starting at offset 0, so a file with *anything* ahead
of it has no frontmatter as far as every consumer is concerned, and it fails silently: the file still
renders, and the version reads as absent.

Leave one blank line after the closing `---`, then whatever the file already began with.

### The stage row stays in the header table

`Status` is what moves an RFC through `Draft → Review → Accepted → Implemented`, and it stays where the
header gate reads it. Nothing but the version moves in this jump.

## Mechanical vs. needs a decision

| Mechanical — apply it | Needs a decision — report it |
|---|---|
| Delete the stamp comment block, both lines | Whether a frozen (`Implemented`) RFC may be touched, where a repository reads the freeze strictly |
| Insert the frontmatter at offset 0 | — |
| Write the version as `rfc@2` | — |
| Leave every section, row and heading untouched | — |

## Done looks like

- The file's first three lines are `---`, `vibe-ops-template: rfc@2`, `---`.
- No `vibe-ops-template` HTML comment remains anywhere in the file.
- `git diff` shows only those two edits — no change to `Status` or to any prose.
- The line count differs from the original by at most two.
