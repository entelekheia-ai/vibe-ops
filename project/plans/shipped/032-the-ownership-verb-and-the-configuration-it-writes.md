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
| Status | Shipped |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Depends on | [Plan-031](./031-ownership-fragments-and-the-shaped-class.md) |
| Related | [RFC-0003](../../rfc/0003-a-governance-type-as-a-pluggable-unit.md), [RFC-0004](../../rfc/implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md) |

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
> **Track 1 done 2026-09-03.** [RFC-0004](../../rfc/implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md)
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

Designed in [RFC-0004](../../rfc/implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md) and not restated
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

1. **[RFC-0004](../../rfc/implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md)** — the whole design,
   with the `file:line` of everything it changes. Its Implementation Notes are the contract for Tracks 2–6.
2. **`cli/packages/core/src/config.ts`** — the cascade as it is: three halves in `loadOne`, `merge` per
   key, and `writeHarnessState`, the only writer today. The RFC's §1–§4 are edits to this file.
3. **`cli/packages/harness/src/sync.ts`** and **`index.ts`** — the ceremony the RFC reorders (§6), the
   blanket refusal it replaces with `boundaryRefusals`, and the merged-cascade write source it retires.
4. **`cli/packages/harness/ownership.json`** and **`plugin/references/ownership.md`** — the four classes
   and the fragment format `vibeops.config.json` joins as `shaped` (§7).
5. **`plugin/skills/setup/SKILL.md`** and **`plugin/skills/migrate/SKILL.md`** — the verbs that carry
   install and update. No new install noun.
6. **`cli/packages/core/test/config.test.ts`** — the ordering assertions Track 2 extends (every one of
   them must keep passing), and the fixture style to copy for the new ones.
7. **`cli/AGENTS.md`** — the config cascade as documented today (`:185-188` describes the three files
   Track 6 rewrites), the build order (`governance-base` in the foundation pass), and how a single test
   file is run.
8. **`plugin/references/convergence-policy.md`** — the four verbs every write in Tracks 5 and 6 must be
   named by.

## Tracks

- [x] **Track 1 — The configuration-format RFC.** Drafted 2026-09-03 through a judged panel of four
      independent designs and two adversarial review rounds, every `file:line` verified against the tree;
      reviewed and accepted by the maintainer the same day, sign-off recorded in the header, the two Open
      Questions carried as non-blocking.
- [ ] **Track 2 — The managed layer in core.** `cli/packages/core/src/config.ts` and `index.ts`:
      `MANAGED_FILENAME` as a third half of `loadOne`; the `.git`-ancestor probe; `layers` and `leave`
      on `LoadedConfig`; `harness.applied`/`harness.boundary` sourced from `managed` alone; per-entry
      `ownership` origins; `writeManagedConfig(dir, patch, { remove })` with refusals R1–R5 and the
      shadow report. Acceptance: every assertion RFC-0004 lists for `config.test.ts` exists and passes;
      `npm test` green. **Adds, never retires:** `writeHarnessState` and `statePath` stay exported, marked
      deprecated, and the legacy state file stays readable as the lowest source for `harness.applied`,
      because `harness` still imports both and the gate must stay green between tracks; Track 4 retires
      them with their callers, and the "`vibeops.config.local.json` appears in `leave` unread" assertion
      lands there.
- [ ] **Track 3 — The vocabulary and the consent fix.** `harness/ownership.json` to version 2 with
      `vibeops.config.json` as `shaped` and the widened matches; `plugin/references/ownership.md` to
      `ownership@3` with the `shaped` row generalised to "the parts a recorded rule names versus the rest",
      naming both instances; the enum and the authority order in `harness/src/ownership.ts` untouched.
      Acceptance: `ownership.test.ts` proves `vibeops.config.json` composes as `shaped` from the harness
      and that classifying it widens nothing; `vibe-ops check .` green here. The consent fix moved to
      Track 4 — its input does not exist yet; see the Open questions.
- [x] **Track 4 — The ceremony and the readers.** Landed 2026-09-04, main loop. `harness/src/sync.ts` in RFC-0004 §6's seven steps,
      including the one-file commit and the leftover removal at the repository root; `harness/src/index.ts`
      writing through `writeManagedConfig` and reporting "this repository has never been promulgated to";
      `resolve.ts` with a `managed` surface and `state` flagged `leave`; `check-global.ts` reading
      `declared` and `local` only; the legacy state read and the `writeHarnessState`/`statePath` exports
      retired from `core` once nothing imports them; `sync` calls `boundaryRefusals` so a non-widening
      bump promulgates without `--accept-boundary`, on whatever record of the agreed classes the Open
      question settles. Acceptance: `sync.test.ts` proves the managed file lands in the commit carrying
      the files it describes, that a run staging no norm file commits it alone, that step 7 empties then
      deletes the leftover, and that a non-widening bump promulgates and records the new boundary;
      `config.test.ts` proves `vibeops.config.local.json` appears in `leave` unread; `hook.test.ts`
      proves a managed file alone leaves the Stop gate off.
- [x] **Track 5 — The nouns and the gates.** Landed 2026-09-06 (sonnet delegation behind the gate, sonnet review: one blocker fixed before merge). `config get` / `config list --show-origin` and
      `ownership get` / `list --show-origin` / `set` in `cli/packages/cli/src`, exposed over MCP like every
      other noun; `config-shadow`, `config-managed-committed` and `config-state-leftover` under
      `cli/packages/gates/src/`, each with the fixture it fails. Acceptance: `config list --show-origin`
      on this repository names the file behind every effective key; `ownership set` refuses an unknown
      class, a missing reason and a widening, naming what stopped it; each gate fires on its fixture and
      passes on this repository.
- [x] **Track 6 — The skills, the prose, the migration.** Landed 2026-09-06: skills and prose 74cc687; the one repository holding a state file promulgated by a real `harness sync` and its branch merged; RFC-0004 Implemented. `setup` writes `types` after Step 3 in the
      caller's own step and verifies at Step 7, routing an R1 or R5 refusal into the gap list as an
      `adopt` that exits 0; `migrate` writes `types` on a rebind and removes an entry whose package is
      uninstalled, naming the noun and the records directory that stop resolving; the gitignore template
      comment, `vibeops.config.local.example.ts`, `cli/AGENTS.md`, `cli/packages/harness/README.md` and
      this repository's `.gitignore` comment say what is now true; one supersession pointer sentence each
      in ADR-0014, ADR-0015 and RFC-0003; the one repository holding a state file migrated by a real
      `harness sync`; RFC-0004 advanced to Implemented. Acceptance: `/vibe-ops:setup repo audit` against
      a repository with a hand-declared `types` name reports it as shadowed and writes nothing; the
      migrated repository's `harness status` answers from the managed file with the state file gone;
      `npm run typecheck`, `npm test` and `vibe-ops check .` green at close, nothing left pending here.
- [x] Run `/vibe-ops:close-plan` (2026-09-06) — retrospective against the goals, the demotion check, the tracking
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

- Decision: the consent record is a receipt, `harness.agreed: { "<path>": "<class>" }`, written by `sync`
  in the promulgation commit and compared by `boundaryRefusals` at the next run; the fifth member of the
  managed layer's writable set. Rejected: keeping the blanket refusal (the failure RFC-0004 §6 names), and
  folding the receipt into `ownership` entries (one list, two writers, where the tool must never rewrite an
  operator's entry on the same match). Today the receipt is all `norm`, since `sync` writes templates only.
  Rationale: maintainer direction, 2026-09-03, after seeing the managed file rendered with and without the
  key. RFC-0004 §6 amended with one paragraph; the Open question below is closed.
  Date / Author: 2026-09-04 / Danilo Borges

- Decision: a touched path that is tracked and byte-identical to HEAD is "unchanged", not "swallowed".
  Rationale: found cutting Track 4 — `sync` counted every unstaged touched path as swallowed, so a
  repository already holding the norm re-promulgated as exit 3; RFC-0004 §6 step 4 (the one-file commit)
  needs exactly that run to succeed. Swallowing still means an untracked path that never reached the index.
  Date / Author: 2026-09-04 / Danilo Borges

- Decision: the gate unsets `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_WORK_TREE` and `GIT_PREFIX` on entry.
  Rationale: a linked worktree's `pre-commit` exports them absolute; the `nudge-behaviour` fixture's
  `git init` then reinitialised the real repository as bare (`core.bare=true`, repaired by hand). Found
  committing Track 2 from a worktree; a `project/log/` entry at Track 6's routing.
  Date / Author: 2026-09-03 / Danilo Borges

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

Closed 2026-09-06. Every goal against what exists:

- **The format RFC before any verb code** — held. RFC-0004 was accepted 2026-09-03 and no track wrote
  code before it; the one amendment (the `harness.agreed` receipt) was made to the Accepted RFC with a
  dated paragraph rather than re-decided in code.
- **One committed serialised member a tool writes** — `vibeops.config.json`, three layers per directory,
  read at the git toplevel, every write reporting `written managed:<file>` and what shadows it, R1
  naming the hand-written file. Exists as specified; `config set types.license …` on this repository
  refuses with the file's name.
- **Install and update through the existing verbs** — `setup` Step 3a and `migrate`'s bindings step,
  both through `config set`/`unset`, a verb the RFC's table did not name and Track 5 gained by addendum:
  the table gave the skills the write and no noun carried it. No install noun.
- **`harness.applied`/`boundary` committed with the files they describe** — and `agreed` beside them.
  A second clone of the migrated repository answers `harness status` identically with no clone-local file.
- **The `ownership` and `config` nouns** — as specified, plus the two writers above; every origin is
  `<layer>:<file>`.
- **Three gates with fixtures** — `self --self-test`: 4 of 4 fire; green here.

Success criteria: all six run at closure and met (the second-clone comparison on a fresh local clone; the
R1 refusal on this repository; the widening refusal and a managed narrowing on a scratch repository; the
self-test; a scan of every governed repository for a leftover state file — none).

**Predictions that were wrong.** RFC-0004 §6 said "the implementation makes `sync` call
`boundaryRefusals`" as if its input existed; two review rounds and the acceptance missed that nothing
recorded the classes agreed to. The receipt was designed mid-implementation, with the file rendered for
the maintainer before deciding. A design that names a function as the fix must name where its arguments
come from. Second: the plan cut Track 2 as "adds and retires" and the retirement had to move to Track 4
because the harness still imported the old API — a track boundary that crosses a package's import graph
is not a boundary the test gate lets you keep.

**Cut or moved.** Nothing cut. The consent fix moved from Track 3 to Track 4 (input missing); the export
removal moved from Track 2 to Track 4 (importers). Open Question 1 (overlapping globs) and 2
(home-directory layers render — they do) stay as the RFC left them; the first waits for a real overlap.

**What it cost.** Three delegations behind the test gate (Track 2 sonnet/medium 220K tokens; Track 5
sonnet/medium 278K after one stall; two adversarial reviews, opus/high 149K and sonnet/high 142K) — each
review found exactly one real blocker at a scope boundary the implementer had been told to keep. Tracks
3, 4 and 6 in the main loop.

## Open questions

- RFC-0004's two Open Questions: overlapping-but-unequal `ownership` globs, and whether `config list`
  renders home-directory layers. Neither blocks a track; the first real case decides each.
- ~~Where the agreed classes come from~~ — closed 2026-09-04 by the `harness.agreed` receipt (Decision Log).

---

## Related

- [RFC-0003](../../rfc/0003-a-governance-type-as-a-pluggable-unit.md) — the scope decision that created this
  plan, and the constraints the verb must honour.
- [RFC-0004](../../rfc/implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md) — Track 1's deliverable;
  the design every other track implements.
- [ADR-0014](../../adr/0014-clone-local-configuration-layers-rather-than-replaces.md),
  [ADR-0015](../../adr/0015-a-third-config-layer-the-tooling-writes.md) — amended by RFC-0004.
- [ADR-0019](../../adr/0019-one-artifact-one-governance-package-activated-by-config.md) — why writing `types`
  is the whole act of installing a governance.
- [Plan-031](./031-ownership-fragments-and-the-shaped-class.md),
  [Plan-033](./033-one-artifact-one-governance.md).
