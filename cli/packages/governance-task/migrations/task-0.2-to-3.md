# task 0.2 → 3 — the version moves into the frontmatter

## What changed in the template

| | 0.2 | 3 |
|---|---|---|
| Where the version is declared | an HTML comment above the H1 | YAML frontmatter at offset 0 |
| How it is written | `<!-- vibe-ops-template task@0.2 … -->` | `vibe-ops-template: task@3` |
| Version format | `<major>.<minor>` | a single integer |
| Sections | — | **unchanged; none added, dropped, renamed or retyped** |

The integer is the count of shapes this template has had, so the `0.1` and `0.2` labels stay valid for
artifacts still carrying them and are not renamed.

## What it costs an existing artifact

**No section is dropped and no content moves.** This migration touches the version declaration and
nothing else. A dossier's `Surprises & Discoveries` entries are untouched and are still routed by
`/vibe-ops:close-task`, not by this migration.

### The stamp comment is deleted and the frontmatter is added

1. **Delete** the `<!-- vibe-ops-template task@0.2 … -->` comment block, including its continuation line.
2. **Insert** the frontmatter as the very first bytes of the file:

   ```yaml
   ---
   vibe-ops-template: task@3
   ---
   ```

**The frontmatter goes at offset 0 — before whatever is currently first, not "above the licence block".**
A dossier may or may not carry a licence comment, and both shapes are real. The reader identifies
frontmatter as the YAML layer starting at offset 0, so a file with *anything* ahead of it has no
frontmatter as far as every consumer is concerned — and it fails silently: the file still renders, and
the version reads as absent.

Leave one blank line after the closing `---`, then whatever the file already began with.

### The `Issue` and `Plan` rows stay in the header table

Nothing moves into the frontmatter in this jump beyond the version itself. A dossier is short-lived and
its rows are read by people, not by the resolver.

## Mechanical vs. needs a decision

| Mechanical — apply it | Needs a decision — report it |
|---|---|
| Delete the stamp comment block, both lines | — |
| Insert the frontmatter at offset 0 | — |
| Write the version as `task@3` | — |
| Leave every section, row and heading untouched | — |

No needs-a-decision column for this jump, which is why it is safe to run unattended across a directory.

## Done looks like

- The file's first three lines are `---`, `vibe-ops-template: task@3`, `---`.
- No `vibe-ops-template` HTML comment remains anywhere in the file.
- `git diff` shows only those two edits.
- The line count differs from the original by at most two.
