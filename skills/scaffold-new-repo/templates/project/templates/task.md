<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!--
 TASK DOSSIER TEMPLATE — copy to tasks/<NNN>-<slug>.md (NNN = the GitHub issue number).
 A dossier is the detailed WORKING LOG for one issue, for work already decided (see tasks/AGENTS.md).
 If the design is still open, write an RFC first. The dossier is EPHEMERAL: committed live, then
 deleted at closure after its lessons are distilled into the issue + research/learnings/.
 Delete these comments before committing.
-->

# Task: Title

| Field | Value |
|---|---|
| Status | Planned |
| Created | YYYY-MM-DD |
| Author | Your Name |
| Issue | <!-- <repo-url>/issues/NNN, or "pending" until opened --> |

<!-- Status lifecycle: Planned → In Progress → Done → (dossier removed; git history is the archive) -->

---

## Context

<!-- Why this work exists and how the items below were identified. The issue holds the one-line
     intent + a link here; THIS file holds the detail the issue does not carry. -->

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | … | S |

### 1. Item title — P0

**What:** <!-- the concrete change -->
**Why:** <!-- the consequence of not doing it -->
**Change:** <!-- the specific edit / approach -->

## Implementation order

```
P0:  …
P1:  …
```

## Closure

<!-- At Done: distill the executive summary + durable learnings into the ISSUE and, for reusable
     lessons, research/learnings/ (/vibe-ops:new-learning). Record the breadcrumb in the issue:
       git show <sha>:project/tasks/NNN-slug.md
     (get <sha> from `git rev-parse HEAD` before deleting). Then `git rm` this file. -->
