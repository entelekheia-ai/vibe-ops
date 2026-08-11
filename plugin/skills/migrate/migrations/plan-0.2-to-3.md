# plan 0.2 → 3 — the version moves into the frontmatter

## What changed in the template

| | 0.2 | 3 |
|---|---|---|
| Where the version is declared | an HTML comment above the H1 | YAML frontmatter at offset 0 |
| How it is written | `<!-- vibe-ops-template plan@0.2 … -->` | `vibe-ops-template: plan@3` |
| Version format | `<major>.<minor>` | a single integer |
| Sections | — | **unchanged; none added, dropped, renamed or retyped** |

The version number also changes shape, from `0.2` to `3`. The integer is the count of shapes this template
has had, so the `0.1` and `0.2` labels stay valid for artifacts still carrying them and are not renamed.

## What it costs an existing artifact

**No section is dropped and no content moves.** This migration touches the version declaration and
nothing else — there is no `Surprises & Discoveries` case here, no routing, and no per-entry decision.
Every step below is mechanical.

### The stamp comment is deleted and the frontmatter is added

Two operations on one file:

1. **Delete** the `<!-- vibe-ops-template plan@0.2 … -->` comment block, including its continuation line.
2. **Insert** the frontmatter as the very first bytes of the file:

   ```yaml
   ---
   vibe-ops-template: plan@3
   ---
   ```

**The frontmatter goes at offset 0 — before whatever is currently first, not "above the license block".**
This is the step that goes wrong, because an existing plan may or may not carry a licence comment and both
shapes are real in the same directory. The reader identifies frontmatter as the YAML layer starting at
offset 0, so a file with *anything* ahead of it — a licence block, a blank line, a stray comment — has no
frontmatter as far as every consumer is concerned, and it fails silently: the file still renders, and the
version simply reads as absent.

Leave one blank line after the closing `---`, then whatever the file already began with.

### A `Status` row in the header table stays where it is

The header table is a presentation layer from `3` onward, not a source of truth, but nothing about it
changes in this jump. Do not move `Status`, `Created` or any other row into the frontmatter as part of
this migration — a row lifted here is a row two consumers then disagree about.

## Mechanical vs. needs a decision

| Mechanical — apply it | Needs a decision — report it |
|---|---|
| Delete the stamp comment block, both lines | — |
| Insert the frontmatter at offset 0 | — |
| Write the version as `plan@3` | — |
| Leave every section, row and heading untouched | — |

There is no needs-a-decision column for this jump, and that is the reason it is safe to run unattended
across a whole directory. A jump that touches content will not look like this one.

## Done looks like

- The file's first three lines are `---`, `vibe-ops-template: plan@3`, `---`.
- No `vibe-ops-template` HTML comment remains anywhere in the file.
- `git diff` shows only those two edits: nothing else in the file moved.
- The line count differs from the original by at most two.
