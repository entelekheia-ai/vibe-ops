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

# Task: Backfill the version declarations

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-11 |
| Author | Danilo Borges |
| Issue | none — internal work, no issue opened (Plan-012 Decision Log) |
| Plan | [`plans/012-versions-travel-with-the-record.md`](../plans/012-versions-travel-with-the-record.md) — Track 5 |

---

## Context

Measured 2026-08-11: 8 of 30 governance records under `project/` carried a version. The population splits
cleanly by how much judgement the backfill needs.

Fourteen records — the ADRs, the RFC and the log entries — belong to types whose template has only ever
had one version. Their declaration is mechanical: there is no other value it could take.

Eight plans are the real work. Their declaration is an **assertion about the file's shape**, not a
default, and the shapes differ: three of the eight carry a `Progress` section and no
`Surprises & Discoveries` entries, while others carry both. Declaring the older version on a file already
shaped like the newer one would hand it a migration note that does not apply, which is exactly the
half-migration `/vibe-ops:migrate` refuses to do.

Five research documents are **out of scope** by Plan-012's decision — the type has no template and its
shape is not settled. Track 2's fragment excludes them and says so.

Depends on Track 2 (`project/tasks/002-the-sensor-and-the-health-reading.md`), which produces the list
this task works from. A hand-built list would be one more thing to go stale.

**This task declares. It does not migrate.** Converting a plan from one shape to another is
`/vibe-ops:migrate`, run per artifact with a decision per entry, and it is out of Plan-012's scope.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Declare the version on the single-version types | S |
| 2 | P0 | Declare it on the eight plans, each after reading it | M |
| 3 | P1 | Confirm the health reading responds | S |

### 1. Declare the version on the single-version types — P0

**What:** add the frontmatter version to each undeclared ADR, RFC and log entry.
**Why:** they are the population where the value is not a judgement.
**Change:** mechanical and independent per file — parallelisable with a one-paragraph contract.

### 2. Declare it on the eight plans, each after reading it — P0

**What:** read each plan's actual section set, then declare the version that describes it.
**Why:** the declaration is a claim, and a wrong claim here is worse than the absent one it replaces — it
turns "nobody has looked" into "someone looked and said this", which no later reader will re-check.
**Change:** **not parallelisable and not delegated.** Each file needs the judgement this plan is about.
Where a plan's shape is genuinely ambiguous, leave it undeclared and list it, rather than guessing.

### 3. Confirm the health reading responds — P1

**What:** re-run Track 2's fragment and check the numbers moved the way the work predicts.
**Why:** a backfill that does not move the sensor means one of the two is wrong, and finding out which
now is cheaper than finding out later.
**Change:** compare before and after; if `behind` did not drop, the declarations disagree with the
resolver.

## Implementation order

**Landed together with Track 2, and not by choice.** The end-to-end test asserting this repository runs
clean is what forced it: the sensor cannot be committed green while thirty-five records are undeclared,
so the sensor and the backfill are one landing. Recorded rather than smoothed over — the plan's own track
order implies they are separable and they were not.

- [x] (2026-08-11) P0 — Took the gate's own output as the work list, rather than a hand-built one
- [x] (2026-08-11) P0 — 11 ADRs, 1 RFC, 2 log entries and 7 dossiers **migrated**, not merely declared:
      for these four types the jump *is* the declaration moving, so applying the note leaves them current
- [x] (2026-08-11) P0 — Plans 009, 010, 011 and 012 were `plan@0.2`, a mechanical jump — now `plan@3`
- [x] (2026-08-11) P0 — The eight `plan@0.1` plans declare **`plan@0.1`, in the comment form of their own
      era**, not frontmatter. Declaring the current form on 0.1 content would produce a file no migration
      note describes: content at 0.1, declaration at 3, and the 0.2→3 note expecting a comment to delete
- [x] (2026-08-11) P0 — Re-run: zero undeclared, eight warned, research skipped by its stated reason
- [x] (2026-08-11) P1 — The open-and-behind reading is real: of the eight behind, **004 is Backlog and
      008 is In Progress**; the other six are Shipped and cost nothing to leave

Left open deliberately: those eight plans still need the `plan-0.1-to-0.2` content migration, one entry
at a time. That is `/vibe-ops:migrate`'s job and Plan-012 scoped it out; the gate now names them, which
is the point.

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: …
  Evidence: …

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
