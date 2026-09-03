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
| Status | In Progress |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Depends on | [Plan-031](./shipped/031-ownership-fragments-and-the-shaped-class.md) |
| Related | [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md), [RFC-0004](../rfc/0004-the-managed-layer-the-configuration-a-tool-writes.md) |

> **This began as a deliberate stub.** RFC-0003 scoped this work out on purpose: the model works with a
> hand-written declaration, and the verb cannot be specified without settling whether the committed
> configuration stays executable or becomes a serialised form a tool can edit safely — a repository-wide
> question that must not be decided on the strength of one verb. The RFC that settles the configuration
> format is this plan's first deliverable.
>
> **Widened 2026-08-22, after Plan-033.** The format RFC owns every value a TOOL writes into the committed
> configuration, because three askers accumulated on the same question: the ownership narrowing (this
> plan's original subject), the **`types` bindings** — installing or updating a governance package means
> writing `types: { freeze: "@scope/pkg#freeze" }`, and the maintainer's direction is to surface that
> through the EXISTING verbs (`/vibe-ops:setup` on a new or an existing repository, `/vibe-ops:migrate`),
> never a new install noun — and the committed home for **`harness.applied`** (clone-local until then, so
> two clones of one repository could disagree undetectably). One format decision, three writers.
>
> **Track 1 done 2026-09-03.** [RFC-0004](../rfc/0004-the-managed-layer-the-configuration-a-tool-writes.md)
> was drafted, reviewed and accepted the same day. Tracks 2–6 below are cut from its Implementation
> Notes and are the contract for the work.

---

## Summary

Plan-031 leaves the ownership declaration readable everywhere and writable only by hand. This plan adds
the surface: an `ownership` noun whose reads return the effective class with its origin and whose write
touches only the repository's own layer — after an RFC settles what that layer is serialised as. The shape
to follow is the one RFC-0003 already names: a read returns the effective value, a read with origins says
where each came from, a write names the layer it touches. It is its own noun, not a verb group under the
module that promulgates — four actors read the declaration, and promulgation is only one of them.

RFC-0004 settles the layer: a committed, machine-owned `vibeops.config.json` — the `managed` layer — read
at the git toplevel, ranked under the hand-written `declared` file, serving all three writers. The
clone-local state file retires, `harness.applied` and `harness.boundary` become facts about the tree, and
the harness records them in the promulgation commit.

## Goals

- The format RFC written, reviewed and accepted before any verb code. **Accepted 2026-09-03.**
- One committed serialised member, `vibeops.config.json`, that a tool writes and a person never has to:
  three layers per directory, `managed` last, read at the git toplevel, every write reporting what shadows
  it, and a refusal — naming the file — where the hand-written file already holds the key; at the skill
  that refusal is the convergence policy's `adopt` gap, reported and untouched.
- Governance install and update surfaced through the existing verbs — `setup` on a new or an existing
  repository, `migrate` after a package moved — writing only `types` into the managed layer, never editing
  `vibeops.config.ts`.
- `harness.applied` and `harness.boundary` committed with the files they describe, written by `harness
  sync` inside the promulgation commit, so a second clone reads the same record.
- `ownership get <path>` / `ownership list --show-origin` over Plan-031's composition, with every entry's
  origin naming its layer and file; `ownership set <glob> <class> --reason` writing the managed layer only,
  keeping Plan-031's three refusals.
- `config get <key>` / `config list --show-origin` printing the effective value, its origin, and every
  value shadowed beneath it.
- Three gates, each shipping a fixture it fails: a key in both committed layers, a managed file that is
  not tracked, a leftover state file.

## Scope

### In scope

The format RFC; the managed layer in core; the `shaped` generalisation in the ownership vocabulary and the
consent fix in `sync`; the sync ceremony; the `config` and `ownership` nouns; the three gates; the write steps in the
`setup` and `migrate` skills; the migration of the one repository that holds a state file today.

### Out of scope

- Everything Plan-031 ships — the verb consumes it.
- Any write to another package's fragment: the managed layer is the only writable one.
- Overlapping-but-unequal `ownership` globs (RFC-0004 Open Question 1) and whether `config list` renders
  home-directory layers (Open Question 2): both stay open until a real case decides them.
- `harness.source`: hand-written, per key, unwritable.

## Design

Designed in [RFC-0004](../rfc/0004-the-managed-layer-the-configuration-a-tool-writes.md) and not restated
here. Three facts drive the track cut:

- **Core first, alone.** Every later track reads through `loadConfig` and writes through
  `writeManagedConfig`; a track that starts before the layer exists designs its own.
- **The vocabulary and the consent fix travel together.** Bumping `ownership.json` to version 2 without
  making `sync` call `boundaryRefusals` would refuse every promulgation until each clone consents — the
  defect RFC-0004 §6 names.
- **The ceremony before the verbs.** `harness sync` is the only writer with a worktree, a commit and a
  migration step; the nouns are plain reads and one plain write, cut after the ceremony proves the writer.
- **The policy's verbs, never new ones.** Every write is one of `create`/`adopt`/`migrate`/`leave` from
  `plugin/references/convergence-policy.md`, and `audit` is every read. R1 and R5 are the core's mechanism
  behind `adopt`; a skill reports the gap and exits 0.

## Read these first

Written 2026-08-22, when this plan's scope widened to every tool-written committed value; revised
2026-09-03 with the RFC.

1. **[RFC-0004](../rfc/0004-the-managed-layer-the-configuration-a-tool-writes.md)** — the whole design,
   with the `file:line` of everything it changes. Its Implementation Notes are the contract for Tracks 2–6.
2. **`cli/packages/core/src/config.ts`** — the cascade as it is: three halves in `loadOne`, `merge` per
   key, and `writeHarnessState`, the only writer today. The RFC's §1–§4 are edits to this file.
3. **`cli/packages/harness/src/sync.ts`** and **`index.ts`** — the ceremony the RFC reorders (§6), the
   blanket refusal it replaces with `boundaryRefusals`, and the merged-cascade write source it retires.
4. **`cli/packages/harness/ownership.json`** and **`plugin/references/ownership.md`** — the four classes
   and the fragment format `vibeops.config.json` joins as `shaped` (§7).
5. **`plugin/skills/setup/SKILL.md`** and **`plugin/skills/migrate/SKILL.md`** — the verbs that carry
   install and update. No new install noun.

## Tracks

- [x] **Track 1 — The configuration-format RFC.** Drafted 2026-09-03 through a judged panel of four
      independent designs and two adversarial review rounds, every `file:line` verified against the tree;
      reviewed and accepted by the maintainer the same day, sign-off recorded in the header, the two Open
      Questions carried as non-blocking.
- [ ] **Track 2 — The managed layer in core.** `cli/packages/core/src/config.ts` and `index.ts`:
      `MANAGED_FILENAME` as a third half of `loadOne`; the `.git`-ancestor probe; `layers` and `leave`
      on `LoadedConfig`; `harness.applied`/`harness.boundary` sourced from `managed` alone; per-entry
      `ownership` origins; `writeManagedConfig(dir, patch, { remove })` with refusals R1–R5 and the
      shadow report; `writeHarnessState` and `statePath` removed from the export. Acceptance: every
      assertion RFC-0004 lists for `config.test.ts` exists and passes; `npm test` green.
- [ ] **Track 3 — The vocabulary and the consent fix.** `harness/ownership.json` to version 2 with
      `vibeops.config.json` as `shaped` and the widened matches; `plugin/references/ownership.md` to
      `ownership@3` with the `shaped` row generalised to "the parts a recorded rule names versus the rest",
      naming both instances; the enum and the authority order in `harness/src/ownership.ts` untouched;
      `sync` calls `boundaryRefusals` so a non-widening bump promulgates without `--accept-boundary`.
      Acceptance: `ownership.test.ts` proves `vibeops.config.json` composes as `shaped` and that
      classifying it widens nothing; a sync test proves a non-widening bump promulgates and records the
      new boundary; `vibe-ops check .` green here.
- [ ] **Track 4 — The ceremony and the readers.** `harness/src/sync.ts` in RFC-0004 §6's seven steps,
      including the one-file commit and the leftover removal at the repository root; `harness/src/index.ts`
      writing through `writeManagedConfig` and reporting "this repository has never been promulgated to";
      `resolve.ts` with a `managed` surface and `state` flagged `leave`; `check-global.ts` reading
      `declared` and `local` only. Acceptance: `sync.test.ts` proves the managed file lands in the commit
      carrying the files it describes, that a run staging no norm file commits it alone, and that step 7
      empties then deletes the leftover; `hook.test.ts` proves a managed file alone leaves the Stop gate
      off.
- [ ] **Track 5 — The nouns and the gates.** `config get` / `config list --show-origin` and
      `ownership get` / `list --show-origin` / `set` in `cli/packages/cli/src`, exposed over MCP like every
      other noun; `config-shadow`, `config-managed-committed` and `config-state-leftover` under
      `cli/packages/gates/src/`, each with the fixture it fails. Acceptance: `config list --show-origin`
      on this repository names the file behind every effective key; `ownership set` refuses an unknown
      class, a missing reason and a widening, naming what stopped it; each gate fires on its fixture and
      passes on this repository.
- [ ] **Track 6 — The skills, the prose, the migration.** `setup` writes `types` after Step 3 in the
      caller's own step and verifies at Step 7, routing an R1 or R5 refusal into the gap list as an
      `adopt` that exits 0; `migrate` writes `types` on a rebind and removes an entry whose package is
      uninstalled, naming the noun and the records directory that stop resolving; the gitignore template
      comment, `vibeops.config.local.example.ts`, `cli/AGENTS.md`, `cli/packages/harness/README.md` and
      this repository's `.gitignore` comment say what is now true; one supersession pointer sentence each
      in ADR-0014, ADR-0015 and RFC-0003; the one repository holding a state file migrated by a real
      `harness sync`; RFC-0004 advanced to Implemented. Acceptance: `/vibe-ops:setup repo audit` against
      a repository with a hand-declared `types` name reports it as shadowed and writes nothing; the
      migrated repository's `harness status` answers from the managed file with the state file gone.
- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the tracking
      issue closed. The plan file itself is kept.

## Success criteria

- A second clone of a promulgated repository answers `harness status` identically to the first, with no
  clone-local file involved.
- No tool edits `vibeops.config.ts`, and a key it holds is never silently overridden: the write refuses,
  naming the file, or reports the shadow.
- Installing a non-default governance is `npm install` plus one `types` entry written by `setup` or
  `migrate` — no install noun exists.
- `ownership list --show-origin` names the layer and file behind every entry, including the repository's
  own narrowings.
- The three gates are green on this repository and fire on their fixtures.
- `vibeops.config.local.json` exists in no governed repository after the migration, and the gate says so
  if one reappears.

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

- Decision: the format decisions live in RFC-0004's Decisions Closed and are not restated here; Tracks 2–6
  are cut from its Implementation Notes and hold while the RFC is in review.
  Rationale: a plan that restates a Draft RFC diverges from it at the first review edit. The RFC was
  produced by four independent designs, three judges, a synthesis and two adversarial review rounds
  (fifty-three findings, ten blockers, all resolved against the code); the plan's job is to sequence,
  not to re-decide.
  Date / Author: 2026-09-03 / Danilo Borges

- Decision: delegation split. Tracks 2, 4 and 5 may be implemented by a subagent in a worktree with
  RFC-0004's Implementation Notes and assertion list as the whole contract, one track per delegation, and
  every such diff reviewed adversarially before merge — by a second delegation given the risky part by
  name (the merge rule, the ceremony order, the refusal messages). Track 3 and Track 6 stay with the main
  loop: the first changes a vocabulary four actors read, the second edits skill prose that must agree with
  this plan's intent.
  Rationale: a track whose contract fits in the RFC's own notes is cheap to delegate and cheap to verify;
  a judgement that has to agree with the plan's intent drifts when delegated. Recorded here rather than in
  the conversation, which the first compaction summarises away.
  Date / Author: 2026-09-03 / Danilo Borges

- Decision: the managed layer's writes speak the convergence policy's four verbs — `create`, `adopt`,
  `migrate`, `leave` — with `audit` as the read mode; the RFC's R1 and R5 stay as the core's mechanism
  behind `adopt` and are never surfaced as a skill-level failure.
  Rationale: maintainer direction, 2026-09-03: follow the verbs the plugin already has rather than coin
  refusal names. `adopt` is the verb the policy says an agent will not invent on its own, and a write
  refused over a hand-declared key is exactly its case — coherent, referenced, not to be touched.
  Date / Author: 2026-09-03 / Danilo Borges

- Decision: four ownership classes, not five. `vibeops.config.json` is `shaped`, whose definition
  generalises from "structure versus content" to "the parts a recorded rule names versus the rest"; the
  enum and the authority order do not change.
  Rationale: maintainer direction, 2026-09-03, on reading the fifth class as micro-fragmentation. Tested
  against the file's facts, `seed` (written once) and `repo` (never written) state falsehoods and `norm`
  (overwritten whole) breaks a `setup` binding at the next `sync`; `shaped` was created for an owner per
  part of a file, and this is a second instance of that shape. A fifth class would have encoded how the
  tooling writes, where the vocabulary answers who owns which part.
  Date / Author: 2026-09-03 / Danilo Borges

## Outcomes & Retrospective

(No outcomes yet.)

## Open questions

- RFC-0004's two Open Questions: overlapping-but-unequal `ownership` globs, and whether `config list`
  renders home-directory layers. Neither blocks a track; the first real case decides each.

---

## Related

- [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) — the scope decision that created this
  plan, and the constraints the verb must honour.
- [RFC-0004](../rfc/0004-the-managed-layer-the-configuration-a-tool-writes.md) — Track 1's deliverable;
  the design every other track implements.
- [ADR-0014](../adr/0014-clone-local-configuration-layers-rather-than-replaces.md),
  [ADR-0015](../adr/0015-a-third-config-layer-the-tooling-writes.md) — amended by RFC-0004.
- [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md) — why writing `types`
  is the whole act of installing a governance.
- [Plan-031](./shipped/031-ownership-fragments-and-the-shaped-class.md),
  [Plan-033](./shipped/033-one-artifact-one-governance.md).
