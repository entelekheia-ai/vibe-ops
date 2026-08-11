<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# Task: The version moves to the frontmatter

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-11 |
| Author | Danilo Borges |
| Issue | none — internal work, no issue opened (Plan-012 Decision Log) |
| Plan | [`plans/012-versions-travel-with-the-record.md`](../plans/012-versions-travel-with-the-record.md) — Track 1 |

---

## Context

The template version is declared today as an HTML comment above the H1. That is a **position**, and a
position has to be described in prose to every consumer that reads it. The description has already failed:
`/vibe-ops:migrate`'s own Step 1 detection command matches the stamp string anywhere in the file, so a
record that merely *mentions* a version in its body counts as declared. Measuring this repository on
2026-08-11 reproduced the defect first-hand — the unversioned population came back smaller than it is.

A parsed field cannot be matched by accident. The version moves to frontmatter; the header table in a
record becomes a thin presentation layer whose only job is rendering in a markdown preview.

This is Track 1 for a mechanical reason. A sensor built to read the comment position would be invalidated
by this move, so the move goes first and everything downstream is written against the new location once.

**This touches all five templates, so it is a version jump per type**, and a jump without a migration note
is the thing `/vibe-ops:migrate` refuses to run. `/vibe-ops:new-migration` writes the template bump and
its note as one act; it is path-scoped to `templates/*.md`, so it loads when the debt is created.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Decide the frontmatter field name and shape, once | S |
| 2 | P0 | Move the version in all five templates, via `/vibe-ops:new-migration` | M |
| 3 | P0 | The resolver reads frontmatter | M |
| 4 | P1 | The header table is documented as presentation only | S |

### 1. Decide the frontmatter field name and shape, once — P0

**What:** the key and its value form, settled before any template is touched.
**Why:** five templates written against three guesses is the drift this plan exists to remove, and the
value form is not free — Plan-012 decided the document version is an **integer**, not semver.
**Change:** one decision, written into Plan-012's Decision Log before the first edit.

### 2. Move the version in all five templates — P0

**What:** `adr`, `rfc`, `plan`, `task`, `log` each gain frontmatter carrying the version, and each takes a
version jump with its own migration note.
**Why:** a template that moves without a note leaves every artifact written against the old one
unmigratable, by that skill's own rule.
**Change:** **run `/vibe-ops:new-migration` per type** — do not hand-write the bump and the note. The note
must classify every step as mechanical or needs-a-decision, and the comment-to-frontmatter move is
mechanical only where the old stamp was actually present.

### 3. The resolver reads frontmatter — P0

**What:** `packages/records/` parses the version from frontmatter and reports it.
**Why:** one reader for the version, or there will be three that disagree — which is already the state
between `/vibe-ops:migrate`'s detection command and everything else.
**Change:** a single resolution path that everything downstream calls. The comment form is read for as
long as unmigrated records exist, and only there.

### 4. The header table is presentation only — P1

**What:** say so where the record types are described.
**Why:** the table will still show a version to a human reading the rendered file, and the next person to
edit one needs to know which of the two is authoritative.
**Change:** one line in the governance rule; do not restate it in five templates.

## Implementation order

- [ ] P0 — Decide the field name and integer form; write it into Plan-012's Decision Log
- [ ] P0 — `/vibe-ops:new-migration` for each of the five types (parallelisable per type, one contract each)
- [ ] P0 — Extend the record resolver to parse frontmatter; keep the comment reader for unmigrated records
- [ ] P0 — Confirm `/vibe-ops:migrate` still detects and refuses correctly against both forms
- [ ] P1 — Document the header table as presentation only, in one place

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
