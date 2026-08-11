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

- [x] (2026-08-11) P0 — Written as a **gate**, not a shell fragment: `cli/packages/gates/template-version/`,
      reading through Track 1's `readTemplateVersion`. The dossier asked for both a fragment and no second
      parser, and once the reader was TypeScript those stopped fitting — see Plan-012's Decision Log
- [x] (2026-08-11) P0 — Four rules, each acted on differently: `undeclared`, `behind`, `ahead`,
      `mismatch`. `behind` carries the record's own Status, so open-and-behind reads off the findings
      without the gate aggregating anything
- [x] (2026-08-11) P0 — Composed into `ops-governance`, one entry per record type, each handed its own
      template rather than a version number — a template bump needs no edit to the composition
- [x] (2026-08-11) P0 — Eleven gate tests plus two end-to-end, including the prose-mention case at the
      surface where someone meets it
- [x] (2026-08-11) P0 — Run against this repository: 0 failed, 8 warned. The eight are exactly the plans
      still at `plan@0.1`, of which **004 (Backlog) and 008 (In Progress) are the open ones**
- [x] (2026-08-11) P1 — Research excluded by a `disabled` entry naming its reason, so it reports SKIP
      rather than being absent from the composition
- [x] (2026-08-11) P0 — `level` became configuration (`settings.<ops>.level`), so `behind` warning is a
      default this repository can override rather than a verdict baked into the gate
- [→] **Moved to Track 6.** `/vibe-ops:migrate`'s Step 1 needs a verb that reports each record's version,
      and no such verb exists — that is Track 6's subject, and answering it here would make a third
      surface for one question

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: a gate hardcoding a finding's level is the same class of error as a gate hardcoding its
  own population, and the repository already had the argument written down for the second one only.
  Evidence: `GateFinding.level` is documented as stripped before the emitter, because "a producer that
  records a verdict has already done the consuming product's job for it" — which makes the verdict a
  consumer concern by the repository's own reasoning. `GovernedSettings` nonetheless carried only
  `ignore` and `disabled`, and `finding.level ?? "fail"` left the detector with the last word. Now three
  members of one family, and the gate's declaration is the default rather than the answer.

- Observation: a gate handed a path in `options` must expand `<plugin>/`, and a fixture that mirrors this
  repository's layout will never catch that it does not.
  Evidence: `options.template` was written as a literal `plugin/templates/adr.md`, which resolves here
  and nowhere else. The end-to-end fixture is deliberately **flat** — no `plugin/` directory — and that
  is the only reason it surfaced. `cli/AGENTS.md` already records the same failure for `$ROOT` versus
  `$PLUGIN_DIR` on the shell side; this is the TypeScript instance of it, in a field that is free-form
  and therefore not type-checked into correctness.

- Observation: "the template is missing" and "the template declares nothing" are different states, and
  reporting both as a finding makes a gate accuse a small repository of being broken.
  Evidence: the fixture repository keeps ADRs and nothing else, so four of the six entries pointed at
  templates that do not exist and each reported the *template* as undeclared. A repository that keeps no
  plans has nothing to read, not a defect — it is the "zero examined is not a reading" rule arriving one
  level up, and the answer is `skipped` naming the path.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
