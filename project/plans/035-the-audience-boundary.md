---
vibe-ops-template: plan@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-035: The audience boundary

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-22 |
| Author | Danilo Borges |
| Depends on | [Plan-034](./shipped/034-the-ops-become-data-and-the-governances-feed-them.md) |
| Related | [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) |

---

## Summary

Plan-030 Track 6, carried forward unchanged in substance and re-footed on the landed architecture. The
2026-08-14 research measured that 9 of 17 shell fragments and several composed entries only make sense
in a repository that publishes a Claude Code plugin, and nothing distinguishes them from portable ones —
a composition that "announces seventeen and delivers five". An ops (and, where a real case demands it,
an entry) declares `audience: portable | internal`; what adoption composes into a target repository is
filtered by it. `fragment-parity` leaves the portable composition of `ops-governance`; `ops-self` is
formally marked internal. Depends on Plan-034 because the audience field should be born in the `.json`
collection form rather than added to the TS shape and migrated a week later.

## Goals

> **Two of the three goals below were met by a mechanism this plan then removed.** The classification is
> the lasting deliverable; the field that consumed it is not, and the boundary it aimed at is delivered by
> [Plan-037](037-the-eleven-fragments-become-gates.md). Read the Decision Log before the goals.

- Every ops entry and shell fragment classified `portable` or `internal`, with cited evidence.
- ~~`audience` declared on ops and on entries~~ — built and reverted; Plan-030's inherited open question
  is still answered by the pass (two of the three ops split across both values), which is what Plan-037
  routes on.
- `fragment-parity` out of every portable composition; `ops-self` marked internal — **carried to
  Plan-037**, which achieves it by moving both into a package rather than by filtering them.

## Scope

### In scope

The field, the classification pass over the three ops and seventeen fragments, the filter on both
composing surfaces, and the one defect that makes the acceptance count unreadable (see Track 3).

### Out of scope

- Retiring shell fragments their ports replaced —
  [Plan-022](022-retiring-a-shell-fragment-its-port-has-replaced.md), unchanged.
- Porting the eleven fragments that have no gate, which Plan-022 also excludes. The classification
  changes the size of that backlog and the finding is recorded here, but the work is a later plan.

## Tracks

- [x] **Track 1 — The field and the classification pass.** Every ops entry and fragment classified with
  cited evidence, each `internal` verdict put through two independent refutation lenses. Landed
  2026-08-23; the numbers are in Outcomes.
- [~] **Track 2 — The filter.** Built, measured, and **removed unshipped** on 2026-08-23. The boundary it
  aimed at is delivered instead by [Plan-037](037-the-eleven-fragments-become-gates.md), which carries the
  same distinction in the package boundary rather than in a field. See the Decision Log and Outcomes.
- [x] **Track 3 — The template path defect.** Landed 2026-08-23. `<template:<type>>` expands to an
  absolute path when the repository holds no copy of its own, and the document store joined it onto the
  target's root, so the file was reported absent at a path that cannot exist. One word — `path.join` to
  `path.resolve` in `core/src/document.ts`. Acceptance met: the fixture reports zero `template-version`
  SKIPs, and `template-version-adr` now does real work there.
- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the file kept.

## Success criteria

- A repository that publishes no plugin, composed with portable audience only, reports no entry and no
  fragment that can only skip there.
- That count is readable: no SKIP survives whose cause is unrelated to audience.

---

## Decision Log

- Decision: this plan waits for Plan-034 rather than landing the field on the TS `OpsDefinition`.
  Rationale: 034 moves the collection to `.json`; a field added to the shape 034 replaces would be
  written twice and migrated once, for no earlier capability.
  Date / Author: 2026-08-22 / Danilo Borges

- Decision: `agents-md/agent-frontmatter` is classified `portable`, and the plugin-only sub-check it
  applies to a non-plugin path is recorded as a defect elsewhere rather than fixed here.
  Rationale: the two refutation lenses split on it. The entry does real, unconditional work — frontmatter
  parse, `description`, `isolation: worktree` — and only `IGNORED_IN_A_PLUGIN` is plugin-shaped. The case
  for `internal` rested entirely on its population being empty today: `.agents/agents/` is named nowhere
  else in this repository and the scaffold ships only `rules/` and `skills/`. An empty population is an
  argument for writing the scaffold, not for marking the entry.
  Date / Author: 2026-08-23 / Danilo Borges

- Decision: the `<template:<type>>` path defect is fixed inside this plan (Track 3) rather than deferred
  to a record of its own.
  Rationale: maintainer direction — a plan already working on a surface fixes the bugs it finds there,
  accepting the scope it adds. The narrow reading also fails: leaving it makes this plan's own acceptance
  count unreadable, since it would measure ten SKIPs falling to five while every survivor has a cause
  this plan never claimed to address.
  Date / Author: 2026-08-23 / Danilo Borges

- Decision: the `audience` field is removed unshipped, and the boundary is delivered by the package
  boundary instead — [Plan-037](037-the-eleven-fragments-become-gates.md).
  Rationale: maintainer challenge, and it held. The field had no consumer: `setup` writes no configuration
  file into a target, the harness template a target runs never set the variable, and no adoption step
  wrote either. So the only way to turn it on was to hand-edit a file this tooling never creates, and the
  acceptance measurement passed only because the flag was passed by hand. The classification the pass
  produced is correct and survives as Plan-037's input; what was wrong was making it a switch. A package a
  repository does not install composes nothing, with nothing to declare and nothing to filter — and it
  needs no write to committed configuration, which would have put this behind Plan-032's format RFC.
  Date / Author: 2026-08-23 / Danilo Borges

- Decision: Track 2 covers both composing surfaces — the ops entries and the seventeen shell fragments.
  Rationale: the filter in `core/src/ops.ts` cannot reach the fragments; they are composed by
  `check-agents-md.sh`, and a target repository resolves that runner out of a vibe-ops checkout, so all
  ten internal fragments run there and each emits a SKIP. Doing only the ops half leaves the success
  criterion unmet. Plan-022 does not cover the gap either: nine of the ten have no gate that replaced
  them, so there is nothing to retire.
  Date / Author: 2026-08-23 / Danilo Borges

## Outcomes & Retrospective

**Track 1, 2026-08-23 — the classification pass.** 33 units, not 34: `ops-agents-md` holds 11 entries.
Each `internal` verdict was put through two independent refutation lenses (is the plugin dependency
structural or a configurable default; does a plugin-less repository get a SKIP or a real failure), and a
verdict either lens refuted was returned as contested rather than flipped.

| Surface | portable | internal | contested |
|---|---|---|---|
| 17 shell fragments | 7 | 10 | — |
| 16 composed entries | 9 | 6 | 1 |

The 2026-08-14 research measured 9 of 17 fragments as plugin-bound; the pass measured 10. Both cases the
Summary predicts held with cited evidence: `fragment-parity` is internal in all four places it appears,
and both `ops-self` entries are internal.

**Plan-030's open question is answered: `entry-too`.** A field on the ops alone resolves `ops-self` and
nothing else. `ops-agents-md` splits 8 portable to 3 internal and `ops-governance` splits 2 portable to 1,
and in both the internal side is `fragment-parity` — the entry this plan's own goal names. Ops-level
audience is the default; entry-level is what carries the goal.

**Measured on a plugin-less fixture repository**, before any filter: 10 SKIPs (agents-md 3, governance 6,
self 1). Filtering to portable removes 5 — the four `fragment-parity` entries and, with its ops,
`template-heading-drift`. The other five are `template-version` and belong to Track 3's defect.

**The conversion backlog is smaller than it looked.** Six fragments have gates; eleven do not. Nine of
those eleven are `internal`, so they never need to reach a target and can stay in shell indefinitely. The
portable fragments genuinely awaiting a port are two: `50-private-names` and `52-machine-paths`. Material
for a later plan, since Plan-022 excludes porting.

**Track 2, 2026-08-23 — built, measured, and removed unshipped.** The field landed on the three
`ops.json`, on the seventeen fragments as `CHECK_AUDIENCE`, with a filter in `core/src/ops.ts` and one in
the shell runner. Measured on a fixture repository publishing no plugin, it did what the plan asked:
15 SKIPs to 0, five on the ops surface and ten on the shell one. The classification was confirmed by the
runtime rather than only by the pass — every one of the ten shell SKIPs that vanished names its own
absent object ("not a plugin repo", "ships no hooks", "no `skills/` directory"), so the set that skips
and the set classified `internal` are the same ten.

**And it was the wrong mechanism, which the measurement itself concealed.** Nothing consumed the field.
No adoption step wrote it; `setup` sends no configuration file to a target at all; the harness template a
target's gate runs never set it. The 15-to-0 was obtained by passing the flag by hand — which measures the
filter, not the behaviour. In every repository that had already adopted, the composition still announced
seventeen and delivered seven. A boundary that has to be switched on, by a switch nothing turns, is not a
boundary. The whole field was reverted the same day;
[Plan-037](037-the-eleven-fragments-become-gates.md) carries the same distinction in the package boundary,
where a repository that installs no mirror package gets no mirror entries and there is nothing to declare.

**Track 3, 2026-08-23 — kept, because the defect is unrelated to the field.** `<template:<type>>` expands
to an absolute path when the repository holds no copy of its own, and the document store joined it onto
the target's root, producing `<repoRoot>/Users/…`. `template-version` reported "nothing to compare these
records against" over a file that was there — invisible here, five SKIPs in every target. Fixed in
`core/src/document.ts` (`path.join` to `path.resolve`), and the new guard was watched to fail: reverting
the one word fails `core/test/document.test.ts` and restores all five SKIPs. On the fixture,
`template-version-adr` now does real work, warning that its ADR is behind its template.

---

## Related

- Plan-030 Track 6's dossier, closed at the supersession:
  `git show f0ffb6995888ad41171ee142dc5ec4653a57486e:project/tasks/ops-declares-its-audience.md`
- [Plan-030](./shipped/030-the-type-unit-and-the-compositions-derived-from-it.md) — the origin of the
  boundary, and the research measurement it rests on.
