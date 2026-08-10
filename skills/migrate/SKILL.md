---
name: migrate
description: Bring governance artifacts written against an older template up to the current one — finds the `vibe-ops:template <type>@<version>` stamp, applies the recorded migration for each version jump, and reports what needs a human decision instead of guessing. Use when a repo's plans, tasks, ADRs or RFCs predate a template change, after updating vibe-ops, when a plan still carries sections the current template dropped, or "/migrate [path]".
argument-hint: "[path | audit]"
---

# /migrate — artifacts, one template version at a time

Templates are versioned so that **migration happens per artifact, not per plugin**. Nobody upgrades a whole
workspace in one sitting, and a repo half-converted by a plugin-wide flag is worse than one where each file
says which shape it was written against.

**Kind:** target-state — convergent and idempotent. Running it on an artifact already at the current
version does nothing. `audit` reports without writing.

**Usage:** `/migrate` (this repo) · `/migrate <path>` (one repo, or one file) · `/migrate audit` (report
only, writes nothing).

## The version stamp

Every template writes one HTML comment above the H1, and it survives into the produced artifact:

```html
<!-- vibe-ops:template plan@0.2 — KEEP THIS LINE. ... -->
```

**An artifact with no stamp is `0.1`.** Versioning started at `0.2`, so the absence of a stamp is not an
error and **MUST NOT** be treated as one — `0.1` is the retroactive name for every shape that existed
before stamping.

## Step 1 — Detect

```sh
rg -o 'vibe-ops:template (\S+)@([0-9.]+)' -r '$1 $2' <target>/project/ | sort | uniq -c
```

Then list the artifacts carrying **no** stamp, which are the `0.1` population:

```sh
rg -L --files-without-match 'vibe-ops:template' <target>/project/{plans,tasks,adr,rfc}/ 2>/dev/null
```

Compare each against the current template version in
`${CLAUDE_PLUGIN_ROOT}/project/templates/<type>.md`. Report the counts before touching anything.

## Step 2 — Read the migration note for each jump

One file per jump, in [`migrations/`](migrations/), named `<type>-<from>-to-<to>.md`. Read **only** the
notes for jumps that this run actually needs. A multi-version jump (`0.1 → 0.3`) applies each note in
order; there is no combined note, because a combined note is one that stops matching either jump.

If a jump has no note, **stop and say so**. A missing note means the template changed without anyone
recording what that costs an existing artifact, and inventing the migration here would make it up.

## Step 3 — Apply, one artifact at a time

**The safety property, and it outranks finishing the run:**

- A section the new template drops **MUST NOT** be deleted while it still has content. Route the content
  as the note prescribes, or leave the artifact untouched and report it. A migration that silently
  deletes a plan's working record is worse than no migration.
- An artifact **MUST NOT** be partially converted. Either the whole note applies to it or it stays at its
  current version, keeping its old stamp. A half-migrated file lies about its shape.
- Content that needs a judgement call — which of several destinations an entry belongs in — **MUST** be
  left in place and listed in the report. Deciding it here is exactly the guess this skill exists to
  avoid.

Then update the stamp to the new version, and only then.

## Step 4 — Report

Per artifact: migrated, skipped (and why), or needs-a-decision (and what the decision is). A run that
migrates nothing and explains three blockers has done its job.

**Never report a migration that did not happen.** The stamp is the evidence — an artifact whose stamp did
not move was not migrated, whatever else the run did to it.

## Adding a migration note

`/new-migration` owns it — the version bump and its note are one act, and that skill also walks the note
against the worst real artifact before it ships. Do not write a note by hand from the template diff.

## ⟳ After every use: review this skill

**Step 3's safety property is the one this skill cannot recover from.** Everything else fails loudly — a
missing note stops the run, a bad detection reports zero. Deleting content is silent and permanent, and
the artifact most exposed to it is the one with the most content, which is also the one worth the most. If
a run destroyed anything, or came close, that belongs here before anything else.

Step 2's *one note per jump* rule is the second place to look, and it fails by pressure rather than by
error: a run facing `0.1 → 0.3` will be tempted to write one combined note, and a combined note is one
that stops matching either jump the next time a version moves.

The notes themselves fail differently again — by being written from the template diff rather than from a
real artifact. A note that says "delete the section" without having opened a plan that has forty entries
in it is a note that has not met its own hardest case. When a migration turns out to need a step the note
did not have, add the step to the note, not to this file.

A gap that shows up across several migrations is a workspace fact rather than a skill fix — route it with
`/route-learnings` instead of growing this file.

If a run produced no edits to this skill or its notes, say so — a migration that went cleanly on the
first pass is signal too.
