---
name: new-log
description: Write one entry into project/log/ — a trap someone would otherwise hit again, recorded as what was attempted and what happened, addressed by the path where it recurs. Use when closure routes a Surprises entry that names a file, folder or package; when a dead end is found outside a task; or when anything is being written under project/log/.
argument-hint: "[slug]"
paths:
  - "project/log/*.md"
  - "**/project/log/*.md"
---

# /new-log — one trap, addressed by its path

Record **one attempt and its outcome**, so the next session does not spend the same hours reaching the
same dead end. The narrative of a whole piece of work belongs to `project/adr/<id>-log.md` instead, and
does not go here.

One entry per trap, and there is no update mode: a trap that changes shape becomes a new entry, and the
old one retires.

## Step 1 — The admission test, before anything is written

**Name the file, folder or package where someone meets this again.**

That answer becomes `path:` (a glob) or `relatedTo:` (a package or tool with no path of its own). It is
not a formality — it is what makes the entry findable by anyone who did not know to look, and it is the
only retirement detector this tier has.

**If you cannot name one, stop. This is not a log entry**, and filing it here anyway is how the tier
becomes the overflow bucket that nobody trusts. It is one of:

| What it actually is | Where it goes |
|---|---|
| A fact that holds beyond this repository | `project/learnings/`, via `/route-learnings` |
| A decision, too large to have a path | an ADR, via `/new adr` |
| Neither | dropped, deliberately and out loud |

## Step 2 — Place it

Records live in `project/log/`. **Do not call `resolve-governance.sh`** — that resolver exists to compute
the next number, and a log entry has no number. A trap is addressed by the path where it recurs, never by
a position in a sequence.

If `project/log/` does not exist, ask before creating it; do not create it silently.

## Step 3 — Name the file

`project/log/<slug>.md`, lowercase and hyphen-separated, describing **what was attempted** rather than the
component involved — `editing-plugin-templates-does-not-change-what-ships`, not `templates`. The slug is
also the entry's `name:` field, and the two must match so a rename stays visible.

## Step 4 — Fill the template

Read `templates/log.md` from the target repo, falling back to
`${CLAUDE_PLUGIN_ROOT}/templates/log.md`. **Never reproduce its structure from memory** — most of it is
HTML comments that are the specification for filling it, and this skill deliberately does not restate them.

Three things the template asks for that are usually got wrong:

- **`description:` and the H1 are not the same sentence.** `description:` is the index row and the text a
  hook injects, so it must stand alone. The H1 is what a reader sees on opening.
- **Reverted is not failed.** If the attempt worked and was undone for another reason, say so — otherwise
  the entry steers the next reader away from something that works.
- **"Not established" is the preferred answer under *The mechanism*.** A cause inferred from the fix
  working is evidence about the fix, and a confident wrong mechanism sends the next reader hunting
  something that was never there.

Write it in English, whatever language the conversation is in — a product guarantee of this plugin.

## Step 5 — Regenerate the index, and lint what you wrote

```bash
vibe-ops log lint      # the mechanical half of the checklist below
vibe-ops log index     # rewrites project/log/README.md from the entries themselves
```

**Do not write the index row by hand.** The row *is* the entry's `description:`, and the grouping is
derived from its `path:` — entries sharing a prefix are one group, and when a prefix stops existing the
whole group collapses. Writing it by hand is what produced the drift this command removed: measured
2026-08-10, the one row in this repository's own index was a shortened paraphrase of the `description:`
it was supposed to be, and nothing had noticed.

Everything above the first level-2 heading in that file is prose you own, and the generator copies it
through untouched. Everything from that heading down is generated; edit an entry, not the index.

Do not touch `project/log/RETIRED.md` — it is append-only and belongs to retirement, not creation.

## Before finishing

- [ ] `path:` or `relatedTo:` is filled, and it is the answer to *where does someone meet this again*
- [ ] The slug describes the attempt, and matches `name:`
- [ ] `kind:` is `trap` or `debt` — debt fires on the same path and says the opposite
- [ ] No `status:` field; retirement is deletion, not a state
- [ ] `attempted:` is a real date from `date +%Y-%m-%d`, never guessed
- [ ] The "not current truth" banner is intact
- [ ] The template's guidance comments are deleted; the version stamp is not
- [ ] `vibe-ops log lint` is clean, and `vibe-ops log index` has been run

## ⟳ After every use: review this skill

**Step 1 is the one this skill cannot fix afterwards.** An entry admitted without a real recurrence
surface is indistinguishable, once written, from one that has it — the field is filled either way, and
the fake path never fires and never retires, so it sits standing forever. If a `path:` was invented to
get past the test, that is the edit worth making here.

Step 4's three corrections exist because each was got wrong at least once. When a fourth shows up, add it
rather than assuming the writer will infer it — the template's comments are already long, and a
correction that matters is one that survived being read.

The retirement half is not exercised by this skill at all, so its failures land elsewhere and come back
as entries that will not die. If a sweep finds entries whose `path:` was never plausible, the defect is
Step 1's, and it belongs here.

A gap that shows up across several entries is a workspace fact rather than a skill fix — route it with
`/route-learnings` instead of growing this file.

If an entry produced no edits to this skill, say so — a trap that filed cleanly on the first pass is
signal too.
