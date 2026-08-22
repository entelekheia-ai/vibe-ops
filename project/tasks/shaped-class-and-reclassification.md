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

# Task: The shaped class, and the reclassification it corrects

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/031-ownership-fragments-and-the-shaped-class.md](../plans/031-ownership-fragments-and-the-shaped-class.md), Track 1 |

---

## Context

Plan-031 Track 1. Verified 2026-08-19 by reading both artifacts side by side: `plugin/ownership.json`
classes `project/{adr,rfc,plans,tasks,log,research}/**` as `repo` ("never written"), and the migrate
skill's whole job is writing those files — it reads each artifact's `vibe-ops-template` stamp and applies
the recorded note per version jump. The declaration governs promulgation only, so both are right about
their own actor; the class for what migration does (`shaped`: tooling owns structure, repository owns
content, permanently) does not exist. This dossier adds it.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `shaped` in the class vocabulary and its reader | S |
| 2 | P0 | Reclassify the record directories in this package's declaration | S |
| 3 | P0 | Migration proceeds/refuses by effective class | M |
| 4 | P0 | Fixture: locally added section survives; `repo`-classed file refused naming the class | M |

### 1. The vocabulary — P0

**What:** `OwnershipClass` gains `"shaped"`; `classOf`/`widens` in
`cli/packages/module-harness/src/ownership.ts` order it `norm → shaped → seed → repo` (authority strictly
decreasing), so the existing widening test covers it with new cases rather than new logic.
**Why:** `widens` today compares three classes (verified in `ownership.ts`); a fourth that slots into the
same order keeps consent semantics untouched.
**Change:** `ownership.ts` type + comparison; `plugin/references/ownership.md` gains the class's prose and
placement test.

### 2. The reclassification — P0

**What:** `project/{adr,rfc,plans,tasks,log,research}/**` moves `repo → shaped` in
`plugin/ownership.json`, with its `why` stating the two owners (structure/content).
**Why:** the contradiction verified above.
**Change:** the one entry; note that `repo → shaped` is a *widening* under item 1's order, which is
correct — it grants migration structural authority, and the consent mechanism (`boundary` version bump)
is exactly what should carry that grant.

### 3. Migration consults — P0

**What:** the migrate path refuses a file whose effective class is `repo` or `seed`, proceeds on `shaped`
and `norm`, naming the class in the refusal.
**Why:** a class nothing consults is documentation; migration is the actor the class was invented for.
**Change:** the migrate skill's instructions (`plugin/skills/migrate/SKILL.md` step that walks artifacts)
plus wherever the CLI's migration-adjacent verbs read stamps — locate with the plan open; promulgation's
consult in `module-harness/src/sync.ts` is the pattern to mirror.

### 4. The fixture — P0

**What:** an artifact with a locally added section (`## Alerts`, content under it) migrated across a
structure-changing jump keeps the section and its content; a `repo`-classed sibling is refused.
**Why:** "content survives" is the entire meaning of the class; untested it is a promise.
**Change:** fixture beside the module-harness tests.

## Implementation order

- [x] P0 — item 1 (not delegable: the ordering *is* the semantics)
- [x] P0 — item 2 (trivial once 1 lands)
- [x] P0 — item 3 (survey of consult points delegable; the refusal wording is not)
- [x] P0 — item 4 (delegable under the fixture contract in item 4's What)

## Surprises & Discoveries

- Observation: this dossier's coordinates predated Plan-033 — `plugin/ownership.json` and
  `module-harness` no longer exist. The reclassification landed per the plan's 2026-08-22 banner
  instead: each record directory's `shaped` entry in the fragment of the governance that owns it
  (version 1→2, the bump being the consent for the repo→shaped widening), and the base half kept only
  `project/research/**` as `repo`.
  Evidence: commit diff — five `cli/packages/governance-<t>/ownership.json` + `harness/ownership.json`.
- Observation: item 3's "wherever the CLI's migration-adjacent verbs read stamps" resolved to ONE
  surface: `records handling` gained `ownership: <class>` per record (boundary composed once per run),
  and the migrate skill's Step 3 consults it — proceed on `shaped`/`norm`, refuse `repo`/`seed`/
  `undeclared` naming the class. No new noun: the verb surface is Plan-032's, and handling was already
  the question migration asks before acting.
  Evidence: `cli/packages/module-records/src/handling.ts` (`Handling.ownership`),
  `plugin/skills/migrate/SKILL.md` Step 3.

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file.
