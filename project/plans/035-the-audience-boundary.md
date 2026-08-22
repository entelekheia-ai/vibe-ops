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
| Status | Backlog |
| Created | 2026-08-22 |
| Author | Danilo Borges |
| Depends on | [Plan-034](034-the-ops-become-data-and-the-governances-feed-them.md) |
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

- `audience` declared on ops and, if the classification pass demands it, on entries — decide from the
  actual pass, not in advance (Plan-030's open question, inherited).
- `fragment-parity` out of every portable composition; `ops-self` marked internal.
- What `/vibe-ops:setup` and adoption compose into a plugin-less target reports no plugin-shaped SKIPs.

## Scope

### In scope

The field, the classification pass over the three ops and seventeen fragments, the adoption filter.

### Out of scope

- Retiring shell fragments their ports replaced —
  [Plan-022](022-retiring-a-shell-fragment-its-port-has-replaced.md), unchanged.

## Tracks

- [ ] **Track 1 — The field and the classification pass.** Every ops and fragment classified; the two
  internal cases marked. Exists at the end: the classification is data, reviewable in one place.
- [ ] **Track 2 — The filter.** Composing "portable only" over a plugin-less fixture repo yields no
  plugin-shaped SKIPs. Acceptance: the before/after SKIP count on that fixture.
- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the file kept.

## Success criteria

- A repository that publishes no plugin, composed with portable audience only, reports no entry that can
  only skip there.

---

## Decision Log

- Decision: this plan waits for Plan-034 rather than landing the field on the TS `OpsDefinition`.
  Rationale: 034 moves the collection to `.json`; a field added to the shape 034 replaces would be
  written twice and migrated once, for no earlier capability.
  Date / Author: 2026-08-22 / Danilo Borges

## Outcomes & Retrospective

(No outcomes yet.)

---

## Related

- Plan-030 Track 6's dossier, closed at the supersession:
  `git show f0ffb6995888ad41171ee142dc5ec4653a57486e:project/tasks/ops-declares-its-audience.md`
- [Plan-030](./shipped/030-the-type-unit-and-the-compositions-derived-from-it.md) — the origin of the
  boundary, and the research measurement it rests on.
