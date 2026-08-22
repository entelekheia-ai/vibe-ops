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

# Plan-032: The ownership verb, and the configuration it writes

| Field | Value |
|---|---|
| Status | Backlog |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Depends on | [Plan-031](031-ownership-fragments-and-the-shaped-class.md) |
| Related | [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) |

> **This is a deliberate stub, not an unfinished plan.** RFC-0003 scoped this work out on purpose: the
> model works with a hand-written declaration, and the verb cannot be specified without settling whether
> the committed configuration stays executable or becomes a serialised form a tool can edit safely — a
> repository-wide question that must not be decided on the strength of one verb. The RFC that settles the
> configuration format is this plan's first deliverable, and the tracks below are placeholders until it
> is accepted.
>
> **Widened 2026-08-22, after Plan-033.** The format RFC now owns every value a TOOL writes into the
> committed configuration, because three askers have accumulated on the same question: the ownership
> narrowing (this plan's original subject), the **`types` bindings** — installing or updating a
> governance package means writing `types: { freeze: "@scope/pkg#freeze" }`, and the maintainer's
> direction is to surface that through the EXISTING verbs (`/vibe-ops:setup`, adopt, migrate), never a
> new install noun — and the committed home for **`harness.applied`** (today clone-local in
> `vibeops.config.local.json`, so two clones of one repository can disagree undetectably). One format
> decision, three writers; deciding it three times would produce three formats.

---

## Summary

Plan-031 leaves the ownership declaration readable everywhere and writable only by hand. This plan adds
the surface: an `ownership` noun whose reads return the effective class with its origin and whose write
touches only the repository's own layer — after an RFC settles what that layer is serialised as. The shape
to follow is the one RFC-0003 already names: a read returns the effective value, a read with origins says
where each came from, a write names the layer it touches. It is its own noun, not a verb group under the
module that promulgates — four actors read the declaration, and promulgation is only one of them.

## Goals

*Placeholders until the format RFC is accepted; refine then.*

- The format RFC: whether the committed configuration gains a serialised member a tool may edit, and what
  the cascade's committed half accepts — covering the ownership narrowing, the `types` bindings a
  governance install/update writes, and a committed `harness.applied`. Written and accepted before any
  verb code.
- Governance install/update surfaced through the existing setup/adopt/migrate verbs, writing only the
  serialised member the RFC defines — never editing the hand-written `vibeops.config.ts`.
- `ownership get <path>` / `ownership list --show-origin` over Plan-031's composition.
- `ownership set <glob> <class> --reason` writing the repository's layer only, refusing a widening by
  naming the fragment it would override, refusing a bare class without a reason.

## Scope

### In scope

The format RFC; the three verbs; nothing else.

### Out of scope

- Everything Plan-031 ships — the verb consumes it.
- Any write to another package's fragment: the repository's layer is the only writable one.

## Design

*Not yet designed — pending the format RFC. The constraints it must honour are recorded in RFC-0003
("Reading and writing the declaration is derived work") and are not restated here.*

## Read these first

Written 2026-08-22, when this plan's scope widened to every tool-written committed value.

1. **`cli/packages/core/src/config.ts`** — the three-file-per-directory cascade, and `writeHarnessState`,
   **the only thing in this tooling that writes configuration today**. It writes
   `vibeops.config.local.json`, parsed rather than imported, precisely to avoid editing someone's
   executable TypeScript. That constraint is the RFC's starting point, not a detail.
2. **The three writers this format must serve**, all currently blocked on it: the ownership narrowing
   (Plan-031), the `types` bindings a governance install/update writes (ADR-0019 — activation is the
   config, so writing a binding IS installing a governance), and a committed home for
   `harness.applied`, which is clone-local today so two clones of one repository can disagree with
   neither detectably wrong.
3. **`plugin/skills/setup/SKILL.md`** and the adopt/migrate skills — the verbs that must carry
   install/update. The maintainer's direction (2026-08-22) is explicit: no new install noun.

## Tracks

- [ ] **Track 1 — The configuration-format RFC.** Drafted, reviewed, accepted.
- [ ] **Track 2 — The verbs.** *Placeholder; specified after Track 1.*
- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the tracking
      issue closed. The plan file itself is kept.

## Success criteria

*Not yet defined — set with Track 1's RFC.*

---

## Decision Log

- Decision: This plan stays a stub until its format RFC exists; no track is refined before it.
  Rationale: specifying the verb first would decide the format implicitly, which is the exact failure
  RFC-0003's scope decision exists to prevent.
  Date / Author: 2026-08-20 / Danilo Borges

- Decision: the format RFC's scope widens to every tool-written committed value — ownership narrowings,
  the `types` bindings, and `harness.applied`'s committed home — and governance install/update is a mode
  of the existing setup/adopt/migrate verbs, never a new noun.
  Rationale: maintainer direction, 2026-08-22, closing Plan-033: three writers had accumulated on one
  undecided format, and the activation model (ADR-0019 — the config is the registry) makes writing
  `types` the whole act of installing a governance. Deciding the format per writer would produce three
  formats; adding an install noun would duplicate verbs that already own first-contact and upgrade.
  Date / Author: 2026-08-22 / Danilo Borges

## Outcomes & Retrospective

(No outcomes yet.)

---

## Related

- [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) — the scope decision that created this
  plan, and the constraints the verb must honour.
