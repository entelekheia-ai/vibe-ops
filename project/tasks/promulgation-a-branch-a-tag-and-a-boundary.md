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

# Task: Promulgation — a branch, a tag, and a boundary

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-14 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/025-the-harness-module-and-the-norm-it-promulgates.md](../plans/025-the-harness-module-and-the-norm-it-promulgates.md), Tracks 4 (the unwritten verb) and 5 |

---

## Context

Plan-025 shipped the harness module's read-only half and deliberately left one verb unwritten: `resolve`
stayed blocked because four verbs already shared one resolver and had diverged, and adding a fifth before
that was settled would have added the defect the other plan existed to remove. That plan has now decided
— the noun is the spelling — so `harness resolve` is unambiguous and lands here.

Track 5 is promulgation itself: bringing a repository to a version of the norm without disturbing what
anyone is working on there, and stopping short of anything a human has not chosen. It ends at a branch and
a tag; it does not merge and it does not push.

The plan's one unanswered question had to be settled before a line could be written: `ownership.json`
carries its own version, and a promulgation that reads a *newer* boundary to decide what it may overwrite
in a repository that agreed to an *older* one is assuming consent it does not have. **Settled: consent is
recorded in the clone.** Only a widening needs it — `seed → norm` converts a file the repository owned
into one this tooling overwrites — and only the widened paths are refused, while the rest promulgate.
Refusing the whole run on any version change would block every repository on a bump that merely added an
entry, which is how a gate gets switched off in its first week.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | A machine-writable layer for the state promulgation records | M |
| 2 | P0 | The ownership declaration, read | M |
| 3 | P0 | `harness resolve` | S |
| 4 | P0 | `harness sync`: the working tree, the branch, the tag | L |
| 5 | P0 | Verify what was staged, never the exit code | M |
| 6 | P0 | The boundary, and the consent it needs | M |

### 1. A machine-writable layer for the state promulgation records — P0

**What:** `vibeops.config.local.json`, a third layer in the config cascade, and `writeHarnessState` as the
only thing that writes it.

**Why:** `sync` has to record what it applied, and `ownership.json` classes `vibeops.config.local.*` as
belonging to the repository precisely so promulgation updates its own key rather than rewriting a file it
does not own. The three existing local variants are all executable, and a program editing someone's
TypeScript to change one key is a class of bug worth not having.

**Change:** A **third layer, not a fourth name in the local half.** Measured while writing this: `loadOne`
takes the first match within each half, so adding `.json` there would make a clone holding both it and a
`vibeops.config.local.ts` silently lose one of them — the machine's state or the operator's overrides,
depending on the order chosen, with no error either way. Layered, they compose.

The same change forced a second: `harness` merged nearest-wins **whole**, which was correct while
`applied` was its only key and became wrong the moment a machine-written file could sit nearer than the
one an operator declares `source` in. Only the `applied` map keeps the whole-key rule; `boundary` and
`source` layer per key.

### 2. The ownership declaration, read — P0

**What:** `cli/packages/module-harness/src/ownership.ts` — load, classify, and answer whether a
reclassification widens.

**Why:** The declaration shipped with Track 1 and nothing read it. Verified: no loader, no schema type, no
matcher anywhere in the tree. Every rule its prose states had to become a function rather than a habit at
the call site.

**Change:** Last match wins, so a narrow entry can carve an exception out of a broad claim — which is
exactly how the one declared exception among the commit hooks is expressed. A path with no matching entry
returns `undefined` and stops the run: absence is not permission.

### 3. `harness resolve` — P0

**What:** Where this target's harness surfaces are — rules, the bridge, the commit hook, the entrypoint,
the runner, the config files, the artifact path.

**Change:** It does **not** print through the record resolvers' shared formatter, deviating from the
plan's expectation. That function answers "where does a record type live", in keys about directories,
templates and numbering, and a harness resolution shares none of them. Routing this through it would give
one function two disjoint output sets selected by a discriminant — the coupling the sibling track removed,
wearing the costume of the convergence it created.

The bridge reading counts **symlinks**, not files: a repository that copied a rule instead of linking it
has a bridge that silently stops tracking its source, and that is indistinguishable from a listing.

### 4. `harness sync`: the working tree, the branch, the tag — P0

**What:** A linked working tree on a new branch, the write restricted to what the norm owns, a commit, an
annotated tag, and the tree removed last.

**Why:** The isolated tree removes the dirty-tree question rather than answering it — nothing to stash,
nothing to restore, and no failure mode where an interrupted run leaves someone's edits somewhere they did
not put them.

**Change:** The tree is removed in a `finally`, so a failed run cannot accumulate sibling directories
nobody remembers creating. The tag is annotated with a message — see the third Surprises entry, which is
the reason.

### 5. Verify what was staged, never the exit code — P0

**What:** After `git add`, compare `git diff --cached --name-only` against what was written, and name the
rule that caught anything missing via `git check-ignore -v`.

**Why:** A linked working tree shares the repository's internal directory, so the clone's ignore list
applies inside it. Nothing tracked is at risk — an ignore rule cannot reach a file the index knows — but
every *new* file is: an ignored new path stages as nothing, exits zero, and reports the fact only as a
hint. The default failure of this verb is a branch that looks complete.

**Change:** Naming the rule matters as much as detecting the miss. "It was ignored" leaves the reader
grepping four possible ignore files, one of which is not in the repository at all.

### 6. The boundary, and the consent it needs — P0

**What:** `harness.boundary` in the clone-local state, `--accept-boundary <n>` to record it, and a refusal
that names each widened path with both classes and the declaration's own justification.

**Change:** Exit code 3 on a refusal, so a run that promulgated some paths and refused others cannot be
read as clean from the one line anybody looks at.

## Implementation order

<!-- Delegation: none. The ownership boundary and what promulgation may do with it are the judgements
     this plan turns on, and the split agreed for it keeps those here. -->

- [x] P0 — Item 1: the state layer, the writer, and the `harness` merge correction
- [x] P0 — Item 2: the ownership reader
- [x] P0 — Item 3: `harness resolve`
- [x] P0 — Items 4, 5 and 6: `sync`, with the staging verification and the boundary
- [x] P0 — Tests against real git repositories, including the ignored-path case
- [x] P0 — `vibeops.config.local.json` ignored here and in the shipped scaffold template
- [x] P0 — `npm run build && npm run typecheck && npm test`, then `vibe-ops check .`
- [ ] P0 — Write the boundary decision into Plan-025's `Decision Log` and close its open question

## Surprises & Discoveries

- Observation: a machine-written config file cannot join the local half of the cascade — it has to be its
  own layer.
  Evidence: `loadOne` takes the first match within each half, so `vibeops.config.local.json` beside a
  `vibeops.config.local.ts` would have meant exactly one of them loading, silently, whichever the order
  put first. The plan approved this work assuming a fourth filename; the assumption was wrong.
- Observation: `harness` merging nearest-wins whole was correct only while `applied` was its only key.
  Evidence: with a machine-written file ranking nearest, whole-key merge would have had it discard an
  operator's `harness.source` declared in `vibeops.config.local.ts`. The rule was about the *map*, not
  about the key it lives under, and the two stopped being the same thing here.
- Observation: `git tag -f <name>` fails on any machine whose git config sets `tag.gpgsign`, and the
  error never mentions signing.
  Evidence: `fatal: no tag message?`, exit 128, measured 2026-08-14 — `tag.gpgsign true` forces
  annotation, and a lightweight tag has no message to give. Caught by a test asserting the tag survived
  its working tree, not by reading. Two fixes: the tag is annotated with a message, and the exit code is
  now read rather than discarded — which was the same sin this verb exists to prevent, committed inside
  the verb itself.
- Observation: the state file was not covered by any ignore rule, in this repository or in the scaffold
  this tooling ships.
  Evidence: `git check-ignore -v vibeops.config.local.json` reported nothing, while the three executable
  variants beside it were all listed. Every promulgation would have produced a tracked diff in a file the
  repository owns — the precise outcome the design says must not happen.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
