<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# Task: Verbs dispatch on the version they were handed

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-11 |
| Author | Danilo Borges |
| Issue | none — internal work, no issue opened (Plan-012 Decision Log) |
| Plan | [`plans/012-versions-travel-with-the-record.md`](../plans/012-versions-travel-with-the-record.md) — Track 6 |

---

## Context

Exactly one consumer reads a record's version today: `/vibe-ops:migrate`. Creation and closure ignore it.
A version that only the migration verb reads is an annotation, not routing.

The cost is observable. `/vibe-ops:close-plan` Step 3 asserts *"A plan carries no `Surprises &
Discoveries` section"*, and it was run on 2026-08-10 against a plan holding sixteen entries in exactly
that section. The skill stated something false about the file in front of it and continued. Nothing
stopped it, because nothing looked at the version.

The dispatch is specified in Plan-012's Design section, as a flowchart. Its load-bearing branch is the
absent declaration: unknown is reported, never defaulted.

**The transparency constraint is not negotiable and is the easiest thing to get wrong here.** An ordinary
verb resolves the version, acts, and mentions it in one line only when it is not current. No flag on an
ordinary verb, no prompt, no version vocabulary on the common path.

Depends on Track 5 (`project/tasks/005-backfill-the-version-declarations.md`): dispatch needs honest
declarations to dispatch on.

## Open within this task — decide it here, with the code in front of you

**How several versions of a skill's behaviour stay alive at once.** Branching inside one `SKILL.md` body
makes every version's instructions load for every run, which is the cost an instruction-file budget exists
to prevent. The candidate Plan-012 records is a **skill-scoped hook that forwards to a versioned sibling**
— `close-plan` dispatching to a `close-plan-2` that keeps the older handling intact and complete. Two
things to establish before committing to it, both measurable rather than arguable:

- A skill's `hooks:` block is installed only while that skill is active, and `paths:` makes a skill
  *eligible* to load, not guaranteed to. Whether a forward fires reliably is a measurement, not an
  assumption — `plugin/AGENTS.md` records a case where it did not.
- The skill listing is a shared budget across every installed plugin. A versioned sibling per version per
  skill multiplies entries in it, so the forwarding sibling must stay out of the listing or the mechanism
  costs more than it saves.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | The resolver answers a record's version | S |
| 2 | P0 | The closing verbs dispatch on it | M |
| 3 | P0 | Unknown and newer both stop, with a named reason | S |
| 4 | P0 | Settle how a skill keeps several versions alive | M |
| 5 | P1 | The skills stop asserting the current shape | M |

### 1. The resolver answers a record's version — P0

**What:** the record resolver reports the version it parsed, alongside what it already resolves.
**Why:** one reader for the version, or there will be three that disagree.
**Change:** extend the path Track 1 built; do not add a second entry point.

### 2. The closing verbs dispatch on it — P0

**What:** `vibe-ops plan close` and `vibe-ops task close` select handling by the resolved version.
**Why:** it is the payoff of every track before this one.
**Change:** the report gains at most one line, and only when the version is not current. A current record
produces no mention of a version anywhere in its output — that is a test, not a preference.

### 3. Unknown and newer both stop, with a named reason — P0

**What:** an absent declaration reports unknown and stops; a version newer than the handler knows stops
and names the jump and the missing migration note.
**Why:** proceeding on an assumption is the failure mode the whole plan is about, and a newer record means
the tooling is behind, which is not something to guess through.
**Change:** mirror `/vibe-ops:migrate`'s existing rule — a jump with no note stops the run rather than
being invented.

### 4. Settle how a skill keeps several versions alive — P0

**What:** decide between the forwarding sibling and whatever the measurements above favour, then implement
it for one real case.
**Why:** deciding it in the abstract is how a mechanism gets chosen for how it reads rather than for
whether it fires.
**Change:** record the decision and its evidence in Plan-012's Decision Log, not only in code.

### 5. The skills stop asserting the current shape — P1

**What:** `close-plan` and `close-task` describe what they do per version instead of stating one shape as
universal fact.
**Why:** the SKILL body is what the agent follows; a correct CLI under a skill that asserts the wrong
shape still produces the wrong reading of the file.
**Change:** the specific sentence to fix is `close-plan` Step 3's claim that a plan carries no
`Surprises & Discoveries` section. It is true of the current template and false of the eight older plans.

## Implementation order

- [ ] P0 — Extend the record resolver to report the version, reusing Track 1's parser
- [ ] P0 — Measure whether a skill-scoped hook forwards reliably; record the result either way
- [ ] P0 — Settle the multi-version mechanism; write the decision into Plan-012
- [ ] P0 — Dispatch in `plan close`; assert a current record's output mentions no version
- [ ] P0 — Dispatch in `task close`
- [ ] P0 — Unknown stops; newer stops naming the jump; a test for each
- [ ] P1 — Rewrite the shape-asserting sentences in `close-plan` and `close-task`
- [ ] P1 — Confirm no ordinary verb gained a version flag or a prompt

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
