---
vibe-ops-template: log@2
name: moving-a-declaration-to-offset-zero
description: Frontmatter is found as the YAML layer at offset 0 and a leading copyright comment was found
             at NR == 1, so putting frontmatter first silently disabled the drift gate — moving anything
             to the top of a file breaks every parser anchored there at once, and all of them fail quietly.
kind: trap
path:
  - "cli/packages/records/src/frontmatter.ts"
  - "cli/packages/module-check/sh/checks/35-dogfooding-drift.sh"
  - "plugin/templates/*.md"
attempted: 2026-08-11
source: Plan-012 Track 1
---

# Moving a declaration to the top of a file breaks every parser anchored there

## What was attempted

Moving each governance template's version declaration out of an HTML comment above the H1 and into YAML
frontmatter, so a machine reads it from a parsed field instead of from a position described in prose.

## What happened

Two parsers were anchored to the top of the file, and neither said so where the edit was being made.

**`readFrontmatter` requires offset 0, and that is a contract rather than a preference.** It finds
frontmatter as the `source.yaml` layer whose `hostStart === 0` — deliberately, so a fenced yaml example
further down a document is not mistaken for metadata. A file with a licence block ahead of its frontmatter
therefore has **no frontmatter** as far as every consumer is concerned. It still renders correctly, and
the version simply reads as absent. Nothing errors.

**`35-dogfooding-drift.sh` was disabled by the same move, permanently and silently.** It compares a
dogfooded file against the copy shipped to other repositories, stripping the licence header the shipped
copy must not carry — and its stripper keyed on `NR == 1`. With frontmatter ahead of the licence block the
block stopped being recognised, so it entered the comparison, the shipped copy has none by design, and the
two sides could never have matched again. The gate caught this on the first run after the edit only
because it started failing loudly; had the templates been edited on both sides in the same commit, it
would have gone green while measuring nothing.

## What to do about it

Before moving anything to the start of a file, find what reads that position. `hostStart === 0`,
`NR == 1`, `head -1`, `lines[0]` and `^` in a multiline regex are all the same dependency written five
ways, and none of them fails loudly when a new first line appears — they fail by matching nothing, which
looks exactly like a clean file.

The related instruction, learned in the same pass and now stated in every migration note this produced:
**describe the destination positionally and absolutely** — *at offset 0, before whatever is currently
first* — never relative to a block that may not be there. Of the three plans that carried the old stamp,
only one had a licence comment; an instruction reading "insert above the licence block" would have been
wrong for the majority of the files it applied to.
