---
name: new-migration
description: Move a template to a new version and write the migration note that comes with it — the version stamp, one note per jump under skills/migrate/migrations/, every dropped section given a destination, and every step classified mechanical or needs-a-decision. Use when changing any file under project/templates/, when a template changed and no note was written, or "/new-migration <type>".
argument-hint: "[template-type]"
paths:
  - "project/templates/*.md"
  - "**/project/templates/*.md"
---

# /new-migration — the version bump and its note, as one act

A template change without a note is a change nobody can apply to the artifacts that already exist. The note
is **part of the change**, not a follow-up: written later it is reconstructed from the diff by someone who
no longer remembers which parts were deliberate.

**Kind:** event — one note per version jump, append-only. A note is never edited to match a later jump;
that jump gets its own note.

## Step 1 — Establish what actually changed

Diff the template against its committed version. Do **not** work from memory of the edit, and do not work
from the new file alone — a section that was silently dropped is invisible in the new file and is exactly
what the note exists to catch.

```sh
git diff -- project/templates/<type>.md
```

List every structural change: sections added, dropped, renamed, or retyped (prose → checklist, fence →
list). A change in wording that leaves the structure alone needs no note and **MUST NOT** get one.

## Step 2 — Choose the version

Patch-level does not exist here. **A template version moves when an artifact written against it would now
be shaped differently** — that is the only test, because the version's whole job is to tell `/migrate`
whether a file needs work.

If nothing about existing artifacts changes, do not move the version.

Stamp it in the template, above the H1, in the comment that survives the instruction-block deletion:

```html
<!-- vibe-ops:template <type>@<version> — KEEP THIS LINE. /vibe-ops:migrate reads it ... -->
```

## Step 3 — Write the note

`skills/migrate/migrations/<type>-<from>-to-<to>.md`, in this order:

1. **What changed in the template** — a table, old shape against new. Structure only.
2. **What it costs an existing artifact** — for every dropped or retyped section, where its content goes.
3. **Mechanical vs. needs a decision** — a two-column table.
4. **Done looks like** — concrete enough to check without judgement.

Two completeness rules, both hard:

- **A dropped section with no stated destination is an unfinished note.** Content does not evaporate
  because the template stopped asking for it. If the honest destination is *dropped*, say so explicitly —
  silence reads as an oversight and `/migrate` will refuse to act on it.
- **Every step is classified mechanical or needs-a-decision.** This is a contract, not a courtesy:
  `/migrate` uses the split to decide what it may touch unattended. An unclassified step is one it must
  treat as unsafe.

**Instructions only.** No history, no narrative of what the change was for, no measurement that motivated
it. Those belong in the plan or RFC that made the change — a note is read by someone converting a file,
who needs the steps and nothing else.

## Step 4 — Test the note against the worst real artifact

Find the existing artifact this migration handles least comfortably — the longest, the one with most
content in a section being dropped — and walk the note against it without editing anything.

This is the step that finds what a diff cannot: a note written from the template change alone will say
"delete the section" and will not have met a file with forty entries in it. If the walk stalls, the note
is missing a step; add the step to the note.

Record what the walk found **in the plan or RFC that owns the change**, never in the note.

## Step 5 — Check the pair

- Does `/migrate`'s detection actually find artifacts at the old version? An artifact with **no** stamp is
  the previous version by definition — the note must be reachable from that state, not only from an
  explicitly stamped one.
- Is the jump contiguous? `/migrate` applies notes in sequence, so `0.1 → 0.3` needs both notes and
  **MUST NOT** get one combined note — a combined note stops matching either jump the next time a version
  moves.

## ⟳ After every use: review this skill

**Step 4 is the one that cannot be recovered by a later pass**, because a note that was never walked
against a real artifact ships looking complete. The failure is silent and lands on whoever runs the
migration months later, against a file nobody remembers. If a walk was skipped, say so in the note's own
"needs a decision" column rather than leaving the gap unmarked.

Step 1's *structure only* rule is the second place to look, and it fails in both directions: a wording
change that got a note it did not need, or a retype (prose → checklist) that was read as wording and got
none. The second is the expensive one.

Step 3's completeness rules are the ones that will be argued with, because a dropped section whose content
"obviously" goes nowhere is the common case. It is also the case where being wrong destroys content. When
a note turns out to have needed a destination it did not state, add the destination — and consider whether
the rule itself needs sharpening, not just that one note.

A gap that shows up across several notes is a workspace fact rather than a skill fix — route it with
`/route-learnings` instead of growing this file.

If a version bump produced no edits to this skill, say so — a note that walked cleanly on the first pass
is signal too.
