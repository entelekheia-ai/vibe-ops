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

# Task: The cited policy says which policy

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-11 |
| Author | Danilo Borges |
| Issue | none — internal work, no issue opened (Plan-012 Decision Log) |
| Plan | [`plans/012-versions-travel-with-the-record.md`](../plans/012-versions-travel-with-the-record.md) — Track 7 |

---

## Context

The files under `plugin/references/` are the single copy of any rule governing more than one skill, and
they are cited **by name** as the authority — `close-plan` and `close-task` both point at
`references/knowledge-lifecycle.md` for the promotion test rather than restating it. That is the design
working as intended, and it has a gap: the referenced file changes, and nothing records which version of
it a given closure applied.

The gap is not hypothetical. Found 2026-08-10, the reference and the skill that cites it disagree today:
`references/knowledge-lifecycle.md` says a learning failing the first two questions *"still belongs
somewhere; the log is that somewhere"*, while `close-plan` Step 3 says an entry that fails the filter is
*"dropped, never filed one tier down"* and that the log is *"never the overflow bucket"*. The same file
also still describes a plan as carrying four living sections, which the current plan template dropped to
two. Which closures ran under which rule is currently unanswerable without re-reading every plan.

`plugin/references/records/plan.md` carries the same staleness — its checklist requires "all four living
sections present" — which is a second instance of one cause.

Independent of Tracks 2 through 6; it can move at any point after Track 1 settles the frontmatter form.

## Open within this task — decide it here

**Whether a prose reference can carry frontmatter.** If it can, it uses the same mechanism as every record
and there is nothing further to invent. If it cannot — because a consumer renders these files raw, or
because the plugin loader does something with a leading `---` — the fallback is a **versioned filename**,
`<name>-<version>.md`, with every citation pointing at one explicitly. That fallback has a property worth
noting rather than discovering later: it leaves room for a `references/<name>/<version>.md` layout, where
several versions coexist as files and a citation is a path rather than a lookup.

Establish which by trying it, not by reasoning about it.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Settle the version's form for a prose reference | S |
| 2 | P0 | Every reference declares a version | S |
| 3 | P0 | Reconcile the two known divergences | M |
| 4 | P0 | A closure records the policy version it applied | S |
| 5 | P1 | The completeness guard checks the version too | S |

### 1. Settle the version's form for a prose reference — P0

**What:** frontmatter if it works, versioned filename if it does not.
**Why:** the citations are by name, so the form decides what a citation looks like — this is not an
internal detail.
**Change:** try frontmatter on one reference first; record the outcome in Plan-012's Decision Log.

### 2. Every reference declares a version — P0

**What:** all seven files under `plugin/references/`, plus the per-type files under `references/records/`.
**Why:** a policy cited as authority by more than one caller is exactly the thing whose changes must be
attributable.
**Change:** integer, per Plan-012 — moving only when a consumer must handle the policy differently, not on
a wording fix.

### 3. Reconcile the two known divergences — P0

**What:** the overflow-bucket contradiction, and the four-living-sections description in both
`knowledge-lifecycle.md` and `references/records/plan.md`.
**Why:** they are live and they mislead on every closure until fixed.
**Change:** the skill is the newer statement in the first case and the template is authoritative in the
second — confirm rather than assume, and record which one won and why. Reconciling is what makes the first
version number mean something instead of freezing a contradiction.

### 4. A closure records the policy version it applied — P0

**What:** a closure's output names the reference version it ran under.
**Why:** it turns "which closures used the old routing rule" from an archaeology into a query.
**Change:** the closing verbs already produce a report; add the field there.

### 5. The completeness guard checks the version too — P1

**What:** extend `55-references-completeness.sh`, which already checks the references set.
**Why:** a reference is load-bearing only while every citation resolves; adding a version adds a second
thing that can go missing.
**Change:** additive to the existing fragment rather than a new one.

## Implementation order

- [x] P0 — Try frontmatter on one reference; record whether it works
- [x] P0 — Settle the form; write the decision into Plan-012's Decision Log
- [x] P0 — Version every file under `plugin/references/` and `references/records/`
- [x] P0 — Reconcile the overflow-bucket contradiction; record which statement won
- [x] P0 — Reconcile the four-living-sections description in both files
- [x] P0 — Closing verbs report the policy version applied
- [x] P1 — Extend `55-references-completeness.sh` to check the version

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: frontmatter on a prose reference costs nothing, and the fallback this task reserved half
  its design for was never needed.
  Evidence: added to `knowledge-lifecycle.md` first and measured — `vibe-ops check .` and
  `vibe-ops governance` both stayed exactly where they were, and every citation still resolves because a
  leading block changes no anchor. Nothing loads these files as skills, so the plugin loader never sees
  the `---`. The versioned-filename fallback, and the `references/<name>/<version>.md` layout it left room
  for, are unnecessary. Trying it took one command; reasoning about it had already taken a paragraph in
  this dossier.

- Observation: the reconciliation was the point, not the version number, and one of the two divergences
  was larger than recorded.
  Evidence: the overflow-bucket contradiction was where the task said it was, and the skills won — the
  reference now states that a rejected entry is dropped rather than filed one tier down, with the reason
  (`project/learnings/` went over budget precisely by filing rejects downward). The four-living-sections
  claim was in **four** places, not two: `knowledge-lifecycle.md`, `references/records/plan.md`,
  `GOVERNANCE.md` and its dogfooding twin under `skills/setup/templates/root/`. The plan lost `Progress`
  and `Surprises & Discoveries` when its template moved and every prose description of it stayed behind.
  Declaring `@1` over an unreconciled text would have frozen the contradiction and made the number mean
  "this is the contradiction we shipped".

- Observation: a reference's declaration is checked against the file's own name, and that turned out to
  be the part worth writing.
  Evidence: `vibe-ops-reference: <name>@<integer>` where `<name>` must equal the path under
  `references/`. Presence alone would pass a reference copied from another one that kept its source's
  token — a version belonging to a different document, which is worse than no answer because it reads as
  one. The four files under `records/` therefore declare `records/<type>@1`, not `<type>@1`, which also
  keeps them from being read as the template version of the same name.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
