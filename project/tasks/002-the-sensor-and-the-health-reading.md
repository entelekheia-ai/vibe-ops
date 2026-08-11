<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# Task: The sensor, and the health reading it produces

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-11 |
| Author | Danilo Borges |
| Issue | none — internal work, no issue opened (Plan-012 Decision Log) |
| Plan | [`plans/012-versions-travel-with-the-record.md`](../plans/012-versions-travel-with-the-record.md) — Track 2 |

---

## Context

`/vibe-ops:migrate` states that an artifact with no version declaration **is** the oldest known version.
That default is safe for the record types whose template has only ever had one version, and it is an
unverified claim for a plan: a plan already written in the current shape but never declared receives a
migration note that does not apply to it, and that skill's own safety rule says a half-migrated file lies
about its shape.

Measured 2026-08-11: 8 of 30 governance records under `project/` carried a declaration. Nothing keeps the
number from growing — every record written by hand rather than through `/vibe-ops:new` joins the same
population silently, and none of the seventeen fragments under `cli/packages/module-check/sh/checks/`
mentions the version at all.

**Counting declarations is the means, not the point.** The reading that matters is *what is open and what
is behind*: a record on an older version is where an upgrade is owed, and a record that is open **and**
behind is where a fix is owed first. That is the repository-health signal this track exists to produce.

Depends on Track 1 (`project/tasks/001-the-version-moves-to-the-frontmatter.md`) — the sensor reads
frontmatter, and building it against the comment position would mean building it twice.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | A fragment that reports a record with no declared version | M |
| 2 | P0 | The health reading: open, behind, and both | M |
| 3 | P0 | The fixtures that prove each case fires | S |
| 4 | P1 | `project/research/` is excluded, and says so | S |

### 1. A fragment that reports a record with no declared version — P0

**What:** a new fragment under `cli/packages/module-check/sh/checks/`, following the `head_`/`skip`/id
conventions the existing seventeen use.
**Why:** without it the unversioned population is discovered by hand once and then grows unobserved.
**Change:** it reports `UNKNOWN` naming the file. It must not classify, guess a version, or suggest one —
the refusal is the whole behaviour.

### 2. The health reading: open, behind, and both — P0

**What:** three numbers reported separately — records with no version, records behind the current version,
and records that are both open and behind.
**Why:** they mean different things and they are acted on differently. Collapsing them into one count
turns an upgrade indicator back into a compliance score, which nobody uses twice.
**Change:** "open" is read from the record's own status field, per type. A record type with no status
concept contributes to `behind` only.

### 3. The fixtures that prove each case fires — P0

**What:** one fixture per reported case, including a record carrying a version string **in its prose** and
none in frontmatter.
**Why:** `references/knowledge-lifecycle.md` requires proving a guard fails, and the prose-mention case is
the exact false negative that produced a wrong measurement of this repository on 2026-08-11.
**Change:** extend the broken-fixture builder in `cli/packages/module-check/sh/check-agents-md.sh`; assert
each case fires.

### 4. `project/research/` is excluded, and says so — P1

**What:** the fragment skips research documents, reporting the exclusion rather than silently omitting
them.
**Why:** Plan-012 scoped them out because the type has no template and its shape is not settled. Silence
about an excluded population is indistinguishable from a clean one, which is the failure mode this whole
plan is about.
**Change:** an explicit `skip` naming the reason, the way a disabled check already does.

## Implementation order

- [ ] P0 — Read three existing fragments for the conventions (`head_`, `skip`, `$ROOT`/`$PLUGIN_DIR`)
- [ ] P0 — Write the fragment reading frontmatter via the Track 1 resolver, not a second parser
- [ ] P0 — Add the three reported numbers; keep them separate in the output
- [ ] P0 — Add the fixtures, including the prose-mention case; confirm each fires
- [ ] P0 — Run against this repository; expect real numbers, not zero
- [ ] P1 — Exclude research with a stated reason
- [ ] P1 — Fix the same substring defect in `/vibe-ops:migrate`'s Step 1 detection command

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
