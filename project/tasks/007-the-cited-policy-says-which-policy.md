<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

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

- [ ] P0 — Try frontmatter on one reference; record whether it works
- [ ] P0 — Settle the form; write the decision into Plan-012's Decision Log
- [ ] P0 — Version every file under `plugin/references/` and `references/records/`
- [ ] P0 — Reconcile the overflow-bucket contradiction; record which statement won
- [ ] P0 — Reconcile the four-living-sections description in both files
- [ ] P0 — Closing verbs report the policy version applied
- [ ] P1 — Extend `55-references-completeness.sh` to check the version

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
