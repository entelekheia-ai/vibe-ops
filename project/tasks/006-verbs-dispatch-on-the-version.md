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

# Task: Verbs dispatch on the version they were handed

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-11 |
| Author | Danilo Borges |
| Issue | none — internal work, no issue opened (Plan-012 Decision Log) |
| Plan | [`plans/012-versions-travel-with-the-record.md`](../plans/012-versions-travel-with-the-record.md) — Track 6 |

---

## Context

Exactly one consumer reads a record's version today: `/vibe-ops:migrate`. Creation and closure ignore it.
A version that only the migration verb reads is an annotation, not routing.

The cost is observable. `/vibe-ops:close-plan` Step 3 asserts *"A plan carries no `Surprises &
Discoveries` section"*, and it was run on 2026-08-10 against a plan holding sixteen entries in exactly
that section. The skill stated something false about the file in front of it and continued. Nothing
stopped it, because nothing looked at the version.

The dispatch is specified in Plan-012's Design section, as a flowchart. Its load-bearing branch is the
absent declaration: unknown is reported, never defaulted.

**The transparency constraint is not negotiable and is the easiest thing to get wrong here.** An ordinary
verb resolves the version, acts, and mentions it in one line only when it is not current. No flag on an
ordinary verb, no prompt, no version vocabulary on the common path.

Depends on Track 5 (`project/tasks/005-backfill-the-version-declarations.md`): dispatch needs honest
declarations to dispatch on.

## Inherited from Track 1: `/vibe-ops:migrate` is the third caller of the same question

Moved here on 2026-08-11 because it needs a verb that answers *what version is each record*, which does
not exist and is this track's subject. Fixing it in Track 1 or 2 would have made a third surface for one
question, which is the state Plan-012 exists to leave.

Measured against the tree on 2026-08-11, after Tracks 1 and 5 landed. Three separate defects, and the
command is the least of them:

- **`migrate/SKILL.md:21` is false.** *"Every template writes one HTML comment above the H1"* — none of
  the five does any more.
- **`migrate/SKILL.md:27` contradicts the shipped gate.** *"An artifact with no stamp is `0.1` … MUST NOT
  be treated as an error"* against `template-version-undeclared`, which fails. Two surfaces answering the
  same question differently is the exact condition this plan removes.
- **`migrate/SKILL.md:34`, the version census, is blind to the current form.** Its regex demands
  `vibe-ops-template ` with a **space**; frontmatter writes a **colon**. Run against this repository it
  reports **8 records, all `plan@0.1`** — the only ones still on the comment form — where there are **33
  records across five types, 25 of them current**. Wrong by 21 files and by four of the five types.
- **`migrate/SKILL.md:40`, the unstamped population, returns empty for the wrong reason.** Plain substring
  matching, so every migrated record is excluded (correct) and so are the eight comment-form plans, which
  also contain the string. It would report the same emptiness for a file that merely mentions the string
  in prose, and it never looks at `project/log/` at all.

The fix is not a better regex — it is Step 1 calling whatever this track builds. Whichever verb answers
the dispatch question answers this one, and the two statements above it are corrected in the same edit.

## Open within this task — decide it here, with the code in front of you

**How several versions of a skill's behaviour stay alive at once.** Branching inside one `SKILL.md` body
makes every version's instructions load for every run, which is the cost an instruction-file budget exists
to prevent. The candidate Plan-012 records is a **skill-scoped hook that forwards to a versioned sibling**
— `close-plan` dispatching to a `close-plan-2` that keeps the older handling intact and complete. Two
things to establish before committing to it, both measurable rather than arguable:

- A skill's `hooks:` block is installed only while that skill is active, and `paths:` makes a skill
  *eligible* to load, not guaranteed to. Whether a forward fires reliably is a measurement, not an
  assumption — `plugin/AGENTS.md` records a case where it did not.
- The skill listing is a shared budget across every installed plugin. A versioned sibling per version per
  skill multiplies entries in it, so the forwarding sibling must stay out of the listing or the mechanism
  costs more than it saves.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | The resolver answers a record's version | S |
| 2 | P0 | The closing verbs dispatch on it | M |
| 3 | P0 | Unknown and newer both stop, with a named reason | S |
| 4 | P0 | Settle how a skill keeps several versions alive | M |
| 5 | P1 | The skills stop asserting the current shape | M |

### 1. The resolver answers a record's version — P0

**What:** the record resolver reports the version it parsed, alongside what it already resolves.
**Why:** one reader for the version, or there will be three that disagree.
**Change:** extend the path Track 1 built; do not add a second entry point.

### 2. The closing verbs dispatch on it — P0

**What:** `vibe-ops plan close` and `vibe-ops task close` select handling by the resolved version.
**Why:** it is the payoff of every track before this one.
**Change:** the report gains at most one line, and only when the version is not current. A current record
produces no mention of a version anywhere in its output — that is a test, not a preference.

### 3. Unknown and newer both stop, with a named reason — P0

**What:** an absent declaration reports unknown and stops; a version newer than the handler knows stops
and names the jump and the missing migration note.
**Why:** proceeding on an assumption is the failure mode the whole plan is about, and a newer record means
the tooling is behind, which is not something to guess through.
**Change:** mirror `/vibe-ops:migrate`'s existing rule — a jump with no note stops the run rather than
being invented.

### 4. Settle how a skill keeps several versions alive — P0

**What:** decide between the forwarding sibling and whatever the measurements above favour, then implement
it for one real case.
**Why:** deciding it in the abstract is how a mechanism gets chosen for how it reads rather than for
whether it fires.
**Change:** record the decision and its evidence in Plan-012's Decision Log, not only in code.

### 5. The skills stop asserting the current shape — P1

**What:** `close-plan` and `close-task` describe what they do per version instead of stating one shape as
universal fact.
**Why:** the SKILL body is what the agent follows; a correct CLI under a skill that asserts the wrong
shape still produces the wrong reading of the file.
**Change:** the specific sentence to fix is `close-plan` Step 3's claim that a plan carries no
`Surprises & Discoveries` section. It is true of the current template and false of the eight older plans.

## Implementation order

- [x] P0 — Extend the record resolver to report the version, reusing Track 1's parser
- [x] P0 — Measure whether a skill-scoped hook forwards reliably; record the result either way
- [x] P0 — Settle the multi-version mechanism; write the decision into Plan-012
- [x] P0 — Dispatch in `plan close`; assert a current record's output mentions no version
- [x] P0 — Dispatch in `task close`
- [x] P0 — Unknown stops; newer stops naming the jump; a test for each
- [x] P0 — Point `/vibe-ops:migrate` Step 1 at that verb, and correct SKILL.md lines 21 and 27
- [x] P1 — Rewrite the shape-asserting sentences in `close-plan` and `close-task`
- [x] P1 — Confirm no ordinary verb gained a version flag or a prompt

## Surprises & Discoveries

<!-- Fill WHILE the work happens. Routed at closure: beyond this repository → project/learnings/;
     nameable file/folder/package → project/log/ with that as its path:; neither → dropped. -->

- Observation: the forwarding-sibling mechanism this task was told to explore cannot work, and the reason
  is not the one the task predicted. It predicted the skill-listing budget; the listing was never the
  problem.
  Evidence: `disable-model-invocation: true` does remove a skill's description from context, so a hidden
  sibling is affordable — `plugin/AGENTS.md` was right and the measurement that said otherwise was wrong.
  What kills it is that **nothing can perform the forward**: a hook returns text (`additionalContext`)
  and cannot invoke a skill, and skill→skill invocation is explicitly non-deterministic. The
  documentation's own advice, when determinism is wanted, is to use a hook — the one mechanism that
  cannot do this.

- Observation: the handling document for an older version already existed, and writing a second one would
  have been the duplication this plan exists to remove.
  Evidence: `plan-0.1-to-0.2.md` states that `Surprises & Discoveries` was living at `0.1`, that it is
  never deleted in place, and carries the four routing questions per entry — the whole of what
  `close-plan` Step 3 needed and never asked for. So `--handling` points at the migration note rather
  than at a new per-version file: one artifact, one ritual (`/new-migration`), two readers.

- Observation: putting the dispatch before every mutation also put it before every validation, and the
  error path got worse in a way the happy path could not show.
  Evidence: `task close project/tasks/999-nope.md` answered *"declares no template version — declare
  `task@<version>` in its frontmatter"* about a file that does not exist. Fixed by letting the library's
  own existence check run first; two regression tests, one of them a batch, since a single mistyped path
  must not be reported as a version problem across the whole set.

- Observation: `--json` printed nothing and exited 0 on the terminal, for every module that declares it.
  Evidence: `result.data` was consumed only by `mcp.ts` and `hook.ts`; `bin.ts` never rendered it. An
  empty success is the worst shape a query can have — it reads as "there is nothing", a real answer,
  rather than as "this surface did not render it". Unit tests on the modules passed throughout, because
  the module was never the broken half.

- Observation: a closure can report zero dangling references and still leave dead ones, and the check
  that says so is not wrong about links.
  Evidence: Plan-012's five `Task:` lines are code spans, which `linksToBasenames` does not match by
  design. The dangling check asked only about links, so it went green over five dead paths. The fix is
  exactness rather than a wider net: a code span counts as a citation only when its whole content is a
  whitespace-free path ending in the basename — which admits `` `project/tasks/001-x.md` `` and excludes
  both `` `[name](../tasks/001-x.md)` `` (a syntax example, correct forever) and
  `` `git show <sha>:…` `` (the repaired form, which would otherwise make the fix look like the defect).

- Observation: the two defects this track left behind were both in the one piece of work that had been
  agreed as not delegable, and the agreement had been lost to a compaction rather than overruled.
  Evidence: before Track 1 the split was written in a chat message — subagents for discovery and for
  mechanical edits under a closed contract, never for the version dispatch or the shape of a record. After
  the compaction the dispatch was handed to a subagent anyway, and its output shipped a line that named
  the version jumps without naming any document to read, plus an alert suppressed under `--json` instead
  of carried in `data`. Neither survived a second reading. The mechanism is worth more than the two fixes:
  **a compaction carries the operator's messages forward and drops the agent's**, so a rule the agent
  proposed and the operator merely assented to evaporates, while everything written into the plan
  survives. Repaired 2026-08-12: the split is now in the plan's recovery section, the plan template says a
  process decision belongs in the `Decision Log`, and `/vibe-ops:new` asks for the split before writing a
  plan.

- Observation: a work item was ticked against a criterion whose words the delivery did not meet, and it
  went unnoticed because the reviewer and the author were the same reader working from memory.
  Evidence: three instances in one pass. Track 4's box was checked with *"every gate **and every
  fragment** declares a version"* while zero of seventeen fragments declared anything; this dossier's
  *"confirm no ordinary verb gained a version flag"* was checked in the same commit that added two flags
  to `records`; and the plan's own flowchart said *run that handling* while the code ran one handling for
  every version. The two flags survive review — `--census` and `--handling` are verbs whose *subject* is
  versions, which the transparency constraint permits explicitly — but the reasoning existed nowhere until
  now, which is the same defect as being wrong: a later reader cannot tell a considered answer from an
  unexamined one.

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
