<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

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

- [ ] P0 — Run Track 2's fragment; take its output as the work list
- [ ] P0 — Declare the version on the single-version types (parallelisable)
- [ ] P0 — Read and declare each plan, one at a time; list any left undeclared and why
- [ ] P0 — Re-run the fragment; expect zero unknowns, or exactly the files deliberately left
- [ ] P1 — Check the open-and-behind reading against what the work predicted

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
