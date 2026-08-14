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

# Task: The audit that cannot mis-measure

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-14 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/025-the-harness-module-and-the-norm-it-promulgates.md](../plans/025-the-harness-module-and-the-norm-it-promulgates.md), Track 6 |

---

## Context

The harness audit existed twice. One copy was a hand-run assessment skill that composed shell to take its
own measurements; the other was this plugin's `setup harness` mode, whose survey step ran four of the same
commands. Both were prose executed by a model, and every number either produced was a number somebody
composed a pipeline for at the moment they needed it.

Track 6 splits that at the line the tooling can defend. The **measuring** half became verbs with tests —
`harness resolve`, `shape`, `catalog` and `audit`, shipped in the sibling dossier. What is left is the
half that genuinely needs a model: placing a component on the guide/sensor grid, recognising an
instruction that is a command written in prose, and deciding whether a check may block or must only warn.

**The decision this opened with: the two are one skill, not two.** Auditing a repository as a harness and
installing one into it are the same knowledge asked in two directions — what the apparatus should be —
and splitting them produced two surfaces that both had to hold it, with the survey written twice. So the
assessment folds into `/vibe-ops:setup harness audit`, following the pattern `setup repo audit` already
uses: the read-only survey is delegated to an agent, so raw listings never enter the caller's context.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | The model, as a shipped reference | M |
| 2 | P0 | The survey step stops composing shell | M |
| 3 | P0 | The audit's reporting path, and where it stops | M |
| 4 | P0 | The surveyor learns the harness verbs, and which one it may never run | S |
| 5 | P0 | Retire the copy that lived outside this repository | S |

### 1. The model, as a shipped reference — P0

**What:** `plugin/references/harness-model.md`, stamped `vibe-ops-reference: harness-model@1`, indexed in
`plugin/references/README.md`.

**Why:** The theory — the two axes, the lifecycle positions, the regulation categories, the attention
budget — was already written and already deliberately repo-neutral, which is exactly what made it
shippable rather than needing a rewrite. A reference is the right home because it governs more than one
surface: the skill applies it, the surveyor needs it to know what its readings mean.

**Change:** It absorbs the judging half too — the three tests that turn a gap into a recommendation, and
the five ways this audit has produced confident nonsense. Four of those five now have a verb that answers
them, and each is kept anyway with the verb named: knowing *why* the verb exists is what stops the next
reader reaching for the shell again.

### 2. The survey step stops composing shell — P0

**What:** Step H0 of `plugin/skills/setup/SKILL.md` calls `harness resolve|shape|catalog` instead of four
hand-run commands.

**Why:** Measured: three of the four commands it ran are exactly `hasRemote()`, `hooksPath()` and
`workflowFiles()` from the harness module, and the fourth is what the `runner-provenance` gate checks.
The shell versions carry none of the tests those functions do — including the one for a glob that matches
nothing while `2>/dev/null` swallows the error, which reads identically to a genuinely empty population
and once produced "this workspace has no CI at all".

### 3. The audit's reporting path, and where it stops — P0

**What:** A step of its own, reached when the user asked for `audit`: fill the grid, name the empty cell,
report each recommendation with its evidence command and a wire-it/build-it estimate, list the gaps
dropped and why, and state what was not examined.

**Change:** The rule that makes it un-fakeable is one sentence — **every number comes from
`harness audit`** — and it is stated where the numbers are used, not in the reference someone may not
open. It writes nothing and hands off to `/vibe-ops:new plan` if the gaps justify one.

### 4. The surveyor learns the harness verbs — P0

**What:** `plugin/agents/governance-auditor.md` gains the four reading verbs in its allowed list.

**Why:** It already names `/vibe-ops:setup harness audit` as a trigger and already holds no writing tool,
so extending it was clearly right and a sibling agent would have duplicated the whole "you write nothing"
contract for one caller.

**Change:** `harness sync` is named as **excluded, with no prompt able to grant it** — the allowed list
had been a list of commands, and this is the first module where one verb writes and four do not.

### 5. Retire the copy that lived outside this repository — P0

**What:** Delete the standalone assessment skill and its bridge symlink where it lived, and repoint the
one sibling skill that named it.

**Change:** This is the only work item that touches files outside this repository, which is why the plan
named it in advance rather than letting it be discovered.

## Implementation order

<!-- Delegation: none. Which half of an audit needs a model and which is a measurement is precisely the
     judgement this track exists to make, and the split agreed for this plan keeps that here. -->

- [x] P0 — Item 1: the reference, stamped and indexed
- [x] P0 — Items 2 and 3: Step H0 and the audit reporting path
- [x] P0 — Item 4: the surveyor's allowed list, and the verb excluded from it
- [x] P0 — Item 5: the outside copy retired and its one caller repointed
- [x] P0 — `vibe-ops check .` green, `npm test` unchanged
- [ ] P0 — Write the fold decision into Plan-025's `Decision Log`

## Surprises & Discoveries

- Observation: folding the assessment into an existing skill costs nothing in the listing budget and
  removes an entry from it.
  Evidence: the `setup` description is unchanged at 863 characters, and the standalone skill's own 323-
  character entry is gone. The budget argument for the fold was the weakest of the three reasons before
  this was measured and is now the cheapest to state.
- Observation: the surveyor agent's guarantee was expressed as a list of allowed commands, which does not
  survive a module where some verbs read and one writes.
  Evidence: `vibe-ops harness` is the first such module. Adding it to the allowed list without naming
  `sync` as excluded would have left "any other command that only reports" doing the work, against a
  module whose name is now on the list.

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
