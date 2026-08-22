---
name: migrate
description: Bring governance artifacts written against an older template up to the current one — finds the `vibe-ops-template` stamp each one declares, applies the recorded migration for each version jump, and reports what needs a human decision instead of guessing. Use when a repo's plans, tasks, ADRs or RFCs predate a template change, after updating vibe-ops, when a plan still carries sections the current template dropped, or "/migrate [path]".
argument-hint: "[path | audit]"
effort: high
---

# /migrate — artifacts, one template version at a time

Templates are versioned so that **migration happens per artifact, not per plugin**. Nobody upgrades a whole
workspace in one sitting, and a repo half-converted by a plugin-wide flag is worse than one where each file
says which shape it was written against.

**Kind:** target-state — convergent and idempotent. Running it on an artifact already at the current
version does nothing. `audit` reports without writing.

**Usage:** `/migrate` (this repo) · `/migrate <path>` (one repo, or one file) · `/migrate audit` (report
only, writes nothing).

> **Prefer the MCP tool over the terminal.** This plugin ships its own `vibe-ops` MCP server
> (`.claude-plugin/plugin.json`), so the verbs below are tools, and a tool returns its report as
> structured data instead of terminal text to read back. The tool's full name depends on how the server
> was registered — `mcp__vibe-ops__<noun>` from a project `.mcp.json`, `mcp__plugin_vibe-ops_vibe-ops__<noun>`
> when it comes from the plugin. **If neither is listed, the CLI is correct**: the shell forms shown below
> are the same command, and the server may simply not be running in this session.

## The version stamp

**Two forms carry it, and both are real.** Every template now declares it in frontmatter, and that is what
a newly produced artifact carries:

```yaml
---
vibe-ops-template: plan@3
---
```

Artifacts written before that move carry an HTML comment above the H1 instead, and target repos are still
full of them:

```html
<!-- vibe-ops-template plan@0.2 — KEEP THIS LINE. ... -->
```

Reading only one form is the same wrong answer as guessing, just in the other direction. Frontmatter wins
when a file carries both — it is what the migration wrote.

**An artifact with no stamp is `(unknown)`, and stays unknown.** It **MUST NOT** be resolved to `0.1` or to
any other version: that guess is wrong in both directions — an artifact already in the current shape would
be handed a migration that does not apply, and a genuinely old one would look handled when it was guessed
at. Undeclared is a finding, reported per artifact, and the fix is to declare a version before migrating
anything.

## Step 1 — Detect

```sh
cd <target> && vibe-ops records census
```

One line per artifact — path, the `<type>@<version>` it declares, or `(unknown)` — grouped by type, with a
tail counting the population by version and the unknowns. `--json` for the structured array. It reads both
stamp forms through the same reader the `template-version` gate uses, and it covers `project/log/` too, so
its numbers and the gate's agree by construction.

**Do not hand-roll this with `rg`.** A regex over the token misses one of the two forms and counts any
artifact that merely *discusses* versioning as declared; both failures report a plausible number.

Compare each against the current template version, read through the CLI — the norm travels as npm
packages since Plan-033, so there is no template path inside this plugin:

```bash
vibe-ops records norm --type <type> --facet template --print
```

Report the counts before touching anything.

**Delegate this whole step to the `vibe-ops:governance-auditor` agent** — the four inputs are in
[`convergence-policy.md`](../../references/convergence-policy.md), the target state being the current
template versions above. It runs the census read-only and returns one row per artifact behind its
template, the unknowns kept as `(unknown)`. On `/migrate audit` that gap list is the entire run. Do it
inline only if the agent is not in the session's listing.

**Ask it for the jump chain too, and for the notes that do not exist**: per artifact, the sequence of
versions between what it declares and the current template, and which of those jumps has no note —
`vibe-ops records norm --type <type> --facet migrations --print` lists every note the norm ships for that
type. A jump with no note stops the run (Step 2), and knowing that now costs one
line in a report you were already reading — discovering it halfway through applying notes means stopping
with some artifacts converted and some not.

## Step 2 — Read the migration note for each jump

One file per jump, named `<type>-<from>-to-<to>.md`, in the directory
`vibe-ops records norm --type <type> --facet migrations` prints. Read **only** the
notes for jumps that this run actually needs. A multi-version jump (`0.1 → 0.3`) applies each note in
order; there is no combined note, because a combined note is one that stops matching either jump.

If a jump has no note, **stop and say so**. A missing note means the template changed without anyone
recording what that costs an existing artifact, and inventing the migration here would make it up.

## Step 3 — Apply, one artifact at a time

**Consult the ownership class before touching a file** — `records handling` reports it per record as
`ownership: <class>`. Proceed on `shaped` (the class this skill exists for: the tooling owns the
structure, the repository owns the content) and on `norm`. **Refuse `repo`, `seed`, and `undeclared`,
naming the class in the report** — a `repo`-classed file is one this tooling was told is not its to
restructure, and an undeclared path is not permission, the same rule promulgation applies. The refusal
is per file: the run continues over its siblings.

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

## Step 4 — The documents that DESCRIBE the shape

Step 1 counts records. A document that says what shape a record has is not a record: it carries no stamp,
appears in no census, and is invisible to everything above. It is also the half a reader acts on — a
reference claiming plans carry a section teaches everyone who reads it to write one.

Read [`${CLAUDE_PLUGIN_ROOT}/references/template-shape-change.md`](../../references/template-shape-change.md)
for the rule; it governs this skill and `/new-migration` and is not restated here. What this step does:

```sh
vibe-ops governance --verbose   # template-heading-drift reports the population
```

**Both readings of that gate go to the `vibe-ops:governance-auditor` agent** — the four inputs are in
[`convergence-policy.md`](../../references/convergence-policy.md), the target state being the migration
note's *what a description now says* section. The first reading is the population; the second is the
completion criterion below, and it is the one that gets skipped, because by then the edits are made and
the run feels finished. Both are read-only; the rewriting between them is not, and stays here.

Then, for each finding, apply what the note's own *what a description now says* section prescribes. Two
obligations, and they are the same ones Step 3 already carries, in the form prose needs:

- **A sentence is rewritten or reported. Never deleted**, and never rewritten into a claim the note does
  not support. If the note does not say what the new shape means, that is a note to finish, not a sentence
  to guess at.
- **An occurrence the gate could not attribute to a record type is a sentence to read, not a verdict.**
  It names two types, or none. Scope it or correct it; do not resolve it by picking one.

**This step is done when the gate is clean and a second run finds nothing to do** — not when the edits
look complete. A partial sweep that looked complete is the failure this whole step exists to prevent.
That second run is a **second dispatch of the agent**, not a re-read of your own edits: the reading that
matters is the one taken by something that did not make them.

## Step 5 — Report

Per artifact: migrated, skipped (and why), or needs-a-decision (and what the decision is). A run that
migrates nothing and explains three blockers has done its job.

**Never report a migration that did not happen.** The stamp is the evidence — an artifact whose stamp did
not move was not migrated, whatever else the run did to it.

Report the second population separately, and by its own evidence: the gate's verdict, not a count of
edits. A run that rewrote six sentences and left the gate red has not finished that half.

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

Step 4 fails in a way that looks like success: the edits get made, the run reports them, and nobody runs
the gate again. The prose half has no stamp to prove it moved, which is exactly why its completion
criterion is a second clean run rather than a list of files touched.

The notes themselves fail differently again — by being written from the template diff rather than from a
real artifact. A note that says "delete the section" without having opened a plan that has forty entries
in it is a note that has not met its own hardest case. When a migration turns out to need a step the note
did not have, add the step to the note, not to this file.

A gap that shows up across several migrations is a workspace fact rather than a skill fix — route it with
`/route-learnings` instead of growing this file.

If a run produced no edits to this skill or its notes, say so — a migration that went cleanly on the
first pass is signal too.
