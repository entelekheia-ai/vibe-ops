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

# Plan-017: The plans still written against the first template shape

| Field | Value |
|---|---|
| Status | Shipped |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Related | [Plan-014](./014-the-prose-that-describes-a-template-is-checked-against-it.md) · absorbed by [Plan-031](./031-ownership-fragments-and-the-shaped-class.md) Track 3, which closes this plan as its acceptance run |

---

## Summary

Eight plans in this repository declare the first version of the plan template, in the comment form the
stamp used before it moved into the frontmatter. Six of them are closed. The governance run already
reports all eight, so this is known debt rather than a discovery. Migrating them is not the mechanical
job the count makes it look like: the second half of the jump drops the two sections those plans lean on
hardest, and the migration note is explicit that a plan whose discoveries section is not empty stays at
the old version until every entry has been routed by hand. Across the eight there are seventy-seven such
entries. That routing is the work; the version stamp is the receipt. This plan does the routing, and in
doing it settles the fate of the one plan among the eight whose subject was delivered elsewhere entirely.

## Goals

1. No plan in this repository declares a template version older than the current one.
2. Every entry from a dropped section reaches a named destination — a durable surface, a skill it
   prescribes a change to, or an explicit and stated drop. Nothing evaporates because a section was
   deleted around it.
3. The plan whose subject was delivered outside this repository is either closed as overtaken or rescoped
   to what actually remains, rather than left in the backlog describing work nobody is going to do.
4. The governance run reports zero records behind on their template version.

## Scope

### In scope

The eight plans carrying the first template stamp, and the two template jumps between that stamp and the
current one. The per-entry routing decisions the first jump requires.

### Out of scope

**The plan that is currently in progress.** Its work has shipped and only its closure ceremony remains;
it is being closed under that ceremony, and migrating a record while it is being closed produces a
conflict for no gain. It rejoins this plan's scope only if its closure leaves it behind.

**Records of any other type.** The decision, proposal and task templates have their own jumps and their
own notes; nothing here depends on them and they are not blocked by this.

**Inventing dossiers for finished work.** The migration note forbids it explicitly and it is worth
repeating: a step-level progress item from a plan that shipped months ago does not get a task dossier
created retroactively so that it has somewhere to live. It is routed or dropped, out loud.

## Design

The two jumps are not the same kind of work and must not be run as one pass.

The second jump moves the version declaration from a comment above the title into frontmatter at the very
start of the file, and changes nothing else. Its own note carries no needs-a-decision column at all,
which is what makes it safe to run across a directory unattended. It is also the jump that fails
silently: frontmatter is only frontmatter if it begins at the first byte, and a plan carrying a licence
comment before it will render fine while every consumer reads its version as absent.

The first jump is the real work. It drops the step-level progress list and the discoveries section, and
it narrows the decision log to decisions only. Each surviving entry is routed by asking, in order,
whether it holds beyond this repository, whether it names a file or folder where someone meets it again,
and whether it is a prescription for how a skill should behave — and if none of those, it is dropped
deliberately rather than filed one tier down to feel thorough.

```mermaid
flowchart TD
  A[Plan at the first stamp] --> B{Discoveries section empty?}
  B -->|no| C[Route each entry]
  C --> D{Holds beyond this repository?}
  D -->|yes| E[A durable knowledge surface]
  D -->|no| F{Can you name where someone meets it again?}
  F -->|yes| G[A log entry, addressed by that path]
  F -->|no| H{A prescription for a skill?}
  H -->|yes| I[Edit that skill; mark the entry discharged with a pointer]
  H -->|no| J[Dropped, stated out loud]
  E --> K[Section empty]
  G --> K
  I --> K
  J --> K
  B -->|yes| K
  K --> L[Apply jump one: stamp moves, sections deleted]
  L --> M[Apply jump two: stamp into frontmatter at offset zero]
```

**Two of the routing destinations do not exist in this repository.** The durable knowledge surface for a
fact that outlives one repository, and the ceremony that files into it, are both absent here — which is
why an earlier plan's findings are still sitting unrouted with nowhere to go. That gap is its own plan,
and this one is blocked on it for exactly the entries that land in that row. Entries routed anywhere else
proceed regardless; the plan is not held hostage by one row of the table.

## Tracks

- [x] ~~**Track 1 — Route the six closed plans.**~~ *(Cut — reversed by the shipped-corpus policy in
      the Decision Log: no section is emptied and the six files stay as written. The routing ANALYSIS was
      still performed over all 40 extracted discovery entries, and its finding stands: the overwhelming
      majority were already discharged into surfaces the entries themselves name — ADRs, references,
      checks, skill steps; three were promoted to the workspace's learnings by Plan-005's own routing
      pass; Plan-007's four were routed at its own closure; and exactly two prescriptions were homeless
      and are now written — the rename-criterion rule into the plan type's `authoring.md`, the
      never-narrate-the-product's-origin rule into `authoring-style.md`.)*
- [x] **Track 2 — Decide the fate of the plan whose subject was delivered elsewhere.** Done: Plan-004
      closed as overtaken — the capability shipped outside this repository, beyond this plan's scope;
      what would reopen a residue here is recorded in its retrospective.
- [x] ~~**Track 3 — Apply both jumps.**~~ *(Applied to exactly one record: Plan-004, migrated at its own
      closure — the opportunistic case the policy prescribes. The six shipped plans keep their shape.)*
- [x] ~~**Track 4 — Confirm the reporting closes.**~~ *(Closes by exemption, not migration: the archival
      directories left the `template-version` population, and the run now reports exactly one record
      behind — Plan-008, open, whose warning is the opportunistic trigger working as designed.)*
- [x] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, and the check for
      whether the routing done here makes any existing written instruction redundant. The plan file
      itself is kept.

## Success criteria

Run from the repository root:

- The governance run reports zero records behind on their template version, where it previously reported
  eight.
- No plan under `project/plans/` or `project/plans/shipped/` contains a progress or discoveries heading.
- Every plan's first three lines are the frontmatter delimiters and its version stamp, with nothing ahead
  of them.
- For each routed entry there is either a file that now carries the fact, a skill edit it prescribed, or
  a line in this plan's retrospective stating it was dropped and why.
- The plan addressed by Track 2 has a terminal status, or a scope that names only work still outstanding.

---

## Decision Log

- Decision: the two template jumps are run as two separate passes, routing first and stamping second.
  Rationale: the second jump is purely mechanical and safe across a directory; the first requires a
  judgement per entry. Running them together means the mechanical half's diff hides the judgement half's,
  and a reviewer loses the ability to check the part that can be wrong.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: an entry that fails the routing questions is dropped explicitly and listed, never filed one
  tier down to avoid the appearance of losing it.
  Rationale: filing rejects into the tier below is what pushes a knowledge base past the point where
  anyone reads it, and the tier below is then the one that rots. A drop that is stated is a decision; a
  drop disguised as a filing is a deferral nobody will revisit.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: the plan currently in progress is excluded until its own closure has run.
  Rationale: it is being closed under its own ceremony, which will rewrite the same sections this
  migration touches. Doing both at once produces a conflict whose resolution is guesswork.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: Track 1 routes from the migration note's three questions, not from `/vibe-ops:close-plan`'s
  Step 3, and every entry it acts on is marked as acted on before the pass moves to the next file.
  Rationale: Step 3 of that skill opens by saying a plan holds only design and *"there is nothing here to
  empty"*. That is true of the current template and false of exactly the eight files this plan is about —
  they predate the split, so their discoveries section is the working record. A pass that follows the
  skill as written concludes it has nothing to do. The marking half comes from the same measurement: a
  closure elsewhere, on a plan of this shape, found fifty-seven entries of which eleven carried a
  prescription, and separating the seven already implemented from the four still open took a
  comparison of every one against the current text of two surfaces. Nothing in an append-only section
  records that an entry was acted on, so seventy-seven entries here would be re-derived the same way by
  whoever reads them next. The marking is cheap while the routing decision is in hand and expensive after.
  Date / Author: 2026-08-14 / Danilo Borges

- Decision: discovery and mechanical edits under a contract that fits in a paragraph may be handed to a
  subagent; any judgement that has to agree with this plan's intent may not.
  Rationale: extracting the entries, counting them, and applying the second jump are closed contracts and
  delegate cleanly. Routing an entry is the judgement this whole plan is about, and it is precisely what
  a subagent returns plausibly and wrongly.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: the shipped corpus is never migrated, and this reverses the plan's own assumption — the
  open question is answered by the maintainer against it. A terminal record keeps the shape it was
  written in and leaves the version-reporting population (an `ignore` in `vibeops.config.ts`, the
  archival directories); a living record migrates opportunistically, at the moment it is already being
  edited, with the `template-version-behind` warning as the trigger. Encoded as governance: the
  lifecycle rule (both copies — this repository's and the setup template's) and the migrate skill.
  Rationale: maintainer, 2026-08-22, mid-execution — "normalmente não vou migrar o que já foi
  entregue, pois isso é um corpus que só cresce; o que foi shipped fica. os que estão a fazer podem
  migrar de forma oportunista, conforme forem editados." A corpus that only grows makes every
  migration campaign an eternal treadmill; and the sections an old shape carried are part of what a
  delivered record was. The six shipped plans' in-flight migration edits were reverted uncommitted.
  Date / Author: 2026-08-22 / Danilo Borges

- Decision: the in-progress plan (008) is excluded from this migration outright, not merely "until its
  closure has run" — and the zero-behind success criterion is recorded as wrong by one.
  Rationale: the exclusion was premised on "its work has shipped and only its closure ceremony remains".
  Read at execution (2026-08-22), the plan's own record refutes that premise: its 2026-08-13
  re-measurement found two of five goals unmet, the noise rate risen, and states "the plan does not
  close on this result". A record that refuses to close cannot be migrated either — the first jump
  requires routing its living sections, which are the working record of work still happening. The one
  `template-version-behind` warning it leaves is the honest reading of an unfinished plan, not residue
  of this migration.
  Date / Author: 2026-08-22 / Claude, executing for Danilo Borges

## Outcomes & Retrospective

**2026-08-22 — closed with its central assumption reversed, which is the outcome worth keeping.** This
plan assumed the eight old-shape plans should be migrated and asked, in its own Open questions, whether
a closed plan should be migrated at all — flagging the assumption as worth challenging before Track 3.
Challenged at exactly that point, it fell: the maintainer's policy is that the delivered corpus keeps
the shape it was written in, and only living records migrate, opportunistically, when edited anyway.

Against the goals: (1) "no plan declares an older version" — false by design now; the shipped corpus
legitimately declares the shapes it was written against, exempt from reporting. (2) Routing — analysis
done over all 40 entries (ledger in Track 1's note); nothing evaporated because nothing was deleted.
(3) Plan-004 — closed as overtaken. (4) Zero behind — the run reports one, Plan-008, which is open work
honestly reported; its own 2026-08-13 re-measurement says its goals are unmet and it does not close, so
it migrates when its work resumes.

**Both success criteria that predicted section deletion were wrong**, in the direction this repository's
own governance predicted: "the sections being deleted are part of what that record was" — the argument
the Open question recorded against migration — won. The lasting outputs are the policy itself (the
lifecycle rule, both copies; the migrate skill's opening; the config exemption), two authoring rules
that had no home, and Plan-004's closure.

---

## Open questions

- Whether a closed plan should be migrated at all, or whether a permanent record ought to keep the shape
  it was written in and be exempted from version reporting once it reaches a terminal status. The
  argument for migrating is a single shape across the corpus and a reporting run that reaches zero; the
  argument against is that the sections being deleted are part of what that record was. This plan assumes
  migration, and the assumption is worth challenging before Track 3 rather than after.

## Related

- [Plan-014](./014-the-prose-that-describes-a-template-is-checked-against-it.md) — the prose that describes
  these templates, which went stale in the same jump and is corrected there rather than here.
