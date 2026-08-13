---
name: new-migration
description: Move a template to a new version and write the migration note that comes with it — the version stamp, one note per jump under skills/migrate/migrations/, every dropped section given a destination, and every step classified mechanical or needs-a-decision. Use when changing any file under plugin/templates/, when a template changed and no note was written, or "/new-migration <type>".
argument-hint: "[template-type]"
effort: high
paths:
  - "plugin/templates/*.md"
  - "**/plugin/templates/*.md"
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
git diff -- plugin/templates/<type>.md
```

List every structural change: sections added, dropped, renamed, or retyped (prose → checklist, fence →
list). A change in wording that leaves the structure alone needs no note and **MUST NOT** get one.

## Step 2 — Choose the version

Patch-level does not exist here, and neither does semver. **A template version is a single integer, and it
moves when an artifact written against it would now be shaped differently** — that is the only test,
because the version's whole job is to tell `/migrate` whether a file needs work. The package's own semver
is a different number answering a different question, and the two never merge.

If nothing about existing artifacts changes, do not move the version.

Declare it in the template's **frontmatter, at offset 0** — the first bytes of the file, ahead of any
licence block:

```yaml
---
vibe-ops-template: <type>@<version>
---
```

## Step 3 — Write the note

`skills/migrate/migrations/<type>-<from>-to-<to>.md`, in this order:

1. **What changed in the template** — a table, old shape against new. Structure only.
2. **What it costs an existing artifact** — for every dropped or retyped section, where its content goes.
3. **What a description of this shape now says** — see the completeness rules below.
4. **Mechanical vs. needs a decision** — a two-column table.
5. **Done looks like** — concrete enough to check without judgement.

The table in section 1 is a **contract, not a layout**, because `template-heading-drift` parses it for
what the template no longer has. Its first header cell is the literal `Section`; a row names a section by
putting the heading in a code span in its first cell (`` `## Progress` ``); the last column is the new
shape, and a dropped section's cell opens with `**dropped**`. A table that departs from this parses to
nothing, and a dropped set that parses to nothing is a gate that reports every document clean.

Three completeness rules, all hard:

- **A dropped section with no stated destination is an unfinished note.** Content does not evaporate
  because the template stopped asking for it. If the honest destination is *dropped*, say so explicitly —
  silence reads as an oversight and `/migrate` will refuse to act on it.
- **A note that changes structure MUST say what a document DESCRIBING this shape now says.** The records
  are not the only population: governance docs, always-on rules, references and skills all assert what
  shape a record has, and every one of those assertions goes false in this commit. Say what the new shape
  means — "the living sections are now X and Y" — never a list of files, which is stale before the note is
  committed. The rule and the reason are in
  [`${CLAUDE_PLUGIN_ROOT}/references/template-shape-change.md`](../../references/template-shape-change.md);
  do not restate them here.
- **Say WHERE positionally and absolutely, never relative to something that may not be there.** "At
  offset 0, before whatever is currently first" holds for every artifact; "above the licence block" holds
  only for the ones that have one. Written from the template alone the second phrasing looks equivalent,
  because the template always has the block — the artifacts are where they differ, which is what Step 4
  is for.
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

**Dispatch the `vibe-ops:migration-rehearser` agent to do the walk**, passing the note, the population and
the template as absolute paths. It holds no writing tool, so "without editing anything" is enforced rather
than promised, and it returns the stall — or a clean walk with the artifact, its size and the step that
met the heaviest content, which is the only form of "it applied cleanly" worth accepting.

**Decide the fan-out here, and say which you chose.** One rehearsal against the artifact you judge worst
is the default and is usually right. Dispatch **one agent per candidate** when the population is
heterogeneous — several artifacts long for different reasons, or a section that is empty in most files and
enormous in two — because then "the worst" is a guess, and a guess is what the fan-out exists to remove.
That decision changes coverage, not cost, and coverage is what shrinks in silence.

Adding a step the stall revealed is yours, not the agent's: what the note *should* say is the judgement
this whole skill is about.

Record what the walk found **in the plan or RFC that owns the change**, never in the note.

## Step 5 — Check the pair

Three mechanical questions, none of them a judgement. **Delegate the step whole to the
`vibe-ops:governance-auditor` agent** — the four inputs are in
[`${CLAUDE_PLUGIN_ROOT}/references/convergence-policy.md`](../../references/convergence-policy.md), the
target state being the note you just wrote and the template it belongs to. Answer them here only if the
agent is not in the session's listing.

- Does `/migrate`'s detection actually find artifacts at the old version? An artifact with **no** stamp is
  the previous version by definition — the note must be reachable from that state, not only from an
  explicitly stamped one.
- Is the jump contiguous? `/migrate` applies notes in sequence, so `0.1 → 0.3` needs both notes and
  **MUST NOT** get one combined note — a combined note stops matching either jump the next time a version
  moves.
- Does the note parse? `vibe-ops governance` runs `template-heading-drift`, which reads this note for the
  dropped set. A dropped section it cannot see is a gate reporting every stale description as clean, so
  **the note is not finished until the gate reports the drift the change just created** — the notes and
  the descriptions go out of agreement in the same commit, and this is where that is caught.

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

The description rule fails by feeling like somebody else's job. It reads as documentation while the note
reads as migration, and the note ships without it. Measured once: two sections were dropped from a
template, the note was written and the change called complete, and nine documents were still asserting the
old shape eight days later — two of them shipped into every repository this plugin scaffolds, and two
agents auditing the repository read them and reported the dropped sections as the current model.

A gap that shows up across several notes is a workspace fact rather than a skill fix — route it with
`/route-learnings` instead of growing this file.

If a version bump produced no edits to this skill, say so — a note that walked cleanly on the first pass
is signal too.
