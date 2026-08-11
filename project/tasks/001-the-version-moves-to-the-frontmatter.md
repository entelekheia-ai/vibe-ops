---
vibe-ops-template: task@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

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

- [x] (2026-08-11) P0 — Field name and integer form decided: `vibe-ops-template: <type>@<integer>`, in
      Plan-012's Decision Log with the reasoning for the vendor prefix and for keeping the `0.x` history
- [x] (2026-08-11) P0 — All five templates moved and all five migration notes written: `plan@3`,
      `task@3`, `adr@2`, `rfc@2`, `log@2`. `log`'s note is the one that diverges — its frontmatter
      already existed, so the note forbids inserting a second block
- [x] (2026-08-11) P0 — The **shipped** copies under `skills/setup/templates/project/templates/` moved
      too (five files). Not in this dossier when it was written; found by the gate
- [x] (2026-08-11) P0 — `35-dogfooding-drift.sh`'s `strip_leading_copyright_comment` taught about
      leading frontmatter; `vibe-ops check` green and `--self-test` confirms the check still fires
- [x] (2026-08-11) P0 — `/vibe-ops:new-migration` Step 2 corrected: it instructed stamping in a comment
      above the H1, which this track made wrong for all five types
- [x] (2026-08-11) P0 — `template-version.ts` reads both forms through the document model, anchoring the
      comment form to the text before the first heading found in the parsed tree. Wired into
      `resolveRecord` off the same `DocumentStore`, so the template is still parsed once per call, and
      surfaced as `TPL_VERSION`. Eight tests, the first of which is the prose false positive
- [x] (2026-08-11) P0 — `frontmatter.ts`'s doc comment corrected
- [x] (2026-08-11) P0 — Header table documented as presentation only, in `.agents/rules/governance.md`
      **and its shipped twin** — a dogfooded pair, so the drift gate would have caught a one-sided edit
- [ ] P0 — `/vibe-ops:migrate`'s own Step 1 detection is **still the substring form** and still counts a
      prose mention as a declaration. The correct reader now exists and is exported; pointing the skill at
      it is listed under Track 2, which owns the same defect for the sensor. Not closed here, and not
      silently left either

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: a migration note for this jump written from the template diff alone says "insert the
  frontmatter above the licence block", and that instruction is wrong for most of the files it applies to.
  Evidence: of the three plans stamped `plan@0.2`, only `010` carries a licence comment; `009` and `011`
  open directly on the stamp comment. Both shapes are real in one directory. The instruction that holds
  for all of them is positional and absolute — *at offset 0, before whatever is currently first* — which
  is only visible by looking at the artifacts, never at the template. This is what `/new-migration`
  Step 4 exists to catch, caught on its first use.

- Observation: frontmatter position is a parser contract here, not a formatting preference, and getting it
  wrong fails silently.
  Evidence: `cli/packages/records/src/frontmatter.ts` finds frontmatter as the `source.yaml` layer whose
  `hostStart === 0`, deliberately, so that a fenced yaml example further down a document is not mistaken
  for metadata. A file with a licence block ahead of its frontmatter therefore has no frontmatter as far
  as every consumer is concerned — and it still renders correctly, so the version simply reads as absent.

- Observation: the frontmatter reader this track assumed it would have to build already exists, and
  carries no per-key typing.
  Evidence: `readFrontmatter` is implemented and exported from `packages/records`, returning `keys`,
  `scalars` and `lists` as open maps. Adding `vibe-ops-template` needs no type change and no new parser —
  work item 3 is substantially smaller than this dossier estimated when it was written.

- Observation: putting frontmatter at offset 0 silently disabled the guard that keeps the two copies of
  each template in sync, and the failure mode was permanent rather than intermittent.
  Evidence: `35-dogfooding-drift.sh` compares a dogfooded template against the copy shipped to other
  repositories, stripping the licence header the shipped copy must not carry. Its stripper keyed on
  `NR == 1`, so with frontmatter ahead of the licence block the block stopped being recognised — it then
  entered the comparison, the shipped copy has none by design, and the two sides could never match again.
  The gate caught it on the first run after the edit and named all four pairs. Two lessons, and the second
  is the transferable one: a positional parser is a dependency on a file's shape, and moving anything to
  offset 0 breaks every one of them at once; and the check that fails immediately after a deliberate
  change is more likely to be the change's blast radius than a false positive.

- Observation: the five templates exist in two copies, and this dossier was written as though they existed
  in one.
  Evidence: `skills/setup/templates/project/templates/` holds the copy `setup repo` ships into other
  repositories, and the dossier's work item 2 said "all five templates" meaning five files when the real
  number was ten. Nothing in the plan or the dossier would have revealed it; the gate did, immediately.
  The shipped copies also carry **no** copyright block at all, which is why the offset-0 instruction in
  every migration note had to be positional rather than "above the licence block".

- Observation: verifying a CLI change through the MCP tool can show you the previous build and look like
  the change did not land.
  Evidence: after `npm run build`, `records --type plan` over MCP returned a payload with no
  `templateVersion`, while the same command run as a fresh process printed `TPL_VERSION=plan@3`. The MCP
  server is a long-lived process that imported `dist/` when the session began; "stateless" describes what
  it keeps between calls, not when it loads its code. Verify a CLI change with a new process, and treat an
  MCP reading of your own just-built code as the old version until proven otherwise.

- Observation: `records --json` writes nothing at all to a terminal. Pre-existing, not introduced here.
  Evidence: `node cli/packages/cli/dist/bin.js records --type plan --json` exits 0 with empty stdout while
  the bare form prints the full block. It follows from the module contract — the report goes in `data` and
  a module logs only under `surface === "cli"` — so the flag is answered by the MCP surface and silently
  by the terminal one. Left alone as out of scope for this track, recorded so the next person does not
  read the silence as their own bug.

- Observation: `frontmatter.ts`'s own doc comment goes stale as a result of this track.
  Evidence: it states "a file with no frontmatter is the ordinary case for three of the four record
  types", which stops being true the moment all five templates carry it. Fix it in this track rather than
  leaving a correct-looking sentence that describes the previous world.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
