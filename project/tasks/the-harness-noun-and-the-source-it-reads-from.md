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

# Task: The harness noun, and the source it reads from

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/025-the-harness-module-and-the-norm-it-promulgates.md](../plans/025-the-harness-module-and-the-norm-it-promulgates.md) — Track 4 |

---

## Context

The read-only half of the `harness` module: the verbs that measure a repository, plus the one contract
change they rest on. Nothing here writes into a target — promulgation is the next track, and keeping the
measuring half separable is what lets it be trusted before anything mutates.

Two things were folded in or cut back after the foundation landed, and both change what "done" means here.

**The source seam merged in.** It was its own track: give a module a resolved *source* surface alongside
its target, so promulgation can read the norm from where it is installed rather than from the repository
it is writing into. It is one field, changes no observable behaviour, and has exactly one consumer. Landed
alone it is a contract addition nothing reads — the shape someone later deletes because they cannot see
why it exists. It arrives here with the verb that proves it.

**`catalog` is smaller than designed.** The gate command already lists what it would run and names each
check's source file — seventeen entries, measured 2026-08-13. That is the "what is composed here" half.
What remains unanswered is the complement: what exists and is *not* composed. That difference is the whole
verb; building the part that already works would be a second answer to a settled question.

**`resolve` is blocked, deliberately.** Four verbs already share one resolver and have diverged where
nobody chose to; consolidating them is an open plan of its own. Writing a fifth before that lands adds the
exact defect that plan exists to remove.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | A module is handed a source surface, not only a target | S |
| 2 | P0 | `harness shape` — the four facts every recommendation rests on | M |
| 3 | P0 | `harness status` — the applied map against what is installed | S |
| 4 | P1 | `harness catalog` — what exists and is not composed | M |
| 5 | P1 | `harness audit` — guides with their cost, sensors with their position | L |
| 6 | P2 | Two detectors surfaced, deliberately not composed | S |

### 1. A module is handed a source surface, not only a target — P0

**What:** add the resolved location of the installed norm to what a module receives, declared by the
modules that need it and absent for every module that does not.

**Why:** promulgation and `status` both have to read the norm from where it is installed while acting on a
repository somewhere else. The token that expands to a plugin surface resolves *relative to the target*,
which is the opposite. The session hook shipped in the previous track works around this by taking the path
as an explicit argument — that workaround is the evidence the seam is missing, and it should collapse into
the seam once it exists.

**Change:** one optional field, resolved once by the CLI like every other positional fact, so a module
still never reaches for the filesystem itself. Absent unless declared — a module that never promulgates
must not be handed a second root it might use by accident.

### 2. `harness shape` — the four facts every recommendation rests on — P0

**What:** whether the repository has a remote, where its hooks live, what already runs, and what its churn
by top-level directory says it is actually for.

**Why:** getting any of the four wrong invalidates everything downstream, and the most common wrong
recommendation in this whole genre — *add CI* — is wrong precisely where there is no remote to run it on.

**Change:** the churn reading is the least obvious and the most useful: a repository whose commits are
overwhelmingly documentation is not under-tested, it is a governance repository, and the sensors it needs
are not the sensors a service needs.

### 3. `harness status` — the applied map against what is installed — P0

**What:** for one target, which version of each record type was promulgated into it against what the
installed norm ships.

**Why:** it is the question that has no answer today, and the one that decides whether promulgating a
change is a command or an afternoon.

**Change:** the comparison already exists inside the session hook shipped in the previous track. This verb
and that hook must not grow two copies of it — the hook becomes a caller.

### 4. `harness catalog` — what exists and is not composed — P1

**What:** the detectors, fragments and skills available, minus those this repository actually composes.

**Why:** it exists to make one specific wrong recommendation impossible — proposing to build something
that is already written and merely unwired.

**Change:** read the composed set from the command that already reports it rather than re-deriving it.

### 5. `harness audit` — guides with their cost, sensors with their position — P1

**What:** the measured inventory: every surface that reaches the agent before it acts, with its always-on
cost as a number and its scope; every mechanical check, with what it verifies and where in the change
lifecycle it fires.

**Why:** it is the half of a harness audit that a command cannot get wrong and a model repeatedly does.

**Change:** carry the measurement traps as tests, not as prose asking a reader to be careful. Two are
known and both have produced confident nonsense: a shell glob that matches nothing while an error is
swallowed, returning zero uniformly and reading as "this repository has none"; and a count derived from a
proxy instead of taken directly. A third is structural — a configured linter that nothing executes is a
guide, not a sensor, so the tool must be run and its output counted rather than its config file noted.

**Not in scope here:** placing anything on the guide/sensor grid, or judging whether a check may block.
Those need a model and belong to the next track.

### 6. Two detectors surfaced, deliberately not composed — P2

**What:** a detector refusing a gate runner that was copied in rather than resolved, and one requiring a
disabled check to name its reason.

**Why:** the first is a trap currently described only in prose, warning that a local copy wins the
resolution order and silently shadows the live runner. The second turns the whole backlog of deliberately
disabled checks into one command.

**Change:** written and tested, and **not** added to any composition. Which population they belong to is a
separate decision, and the recent precedent is that a detector inheriting the wrong composition's
exclusions fails in silence.

## Implementation order

- [x] P0 — Item 1: add the source field and its resolution. **Delegable**: may touch the context type, its
      resolution in the CLI, and their tests; must not change how the target root is resolved; returns the
      diff and a passing run.
- [x] P0 — Item 1: collapse the session hook's explicit path argument onto the new seam, keeping its
      fail-open behaviour and its silence tests green.
- [x] P0 — Item 2: `harness shape`, with the no-remote case asserted by a fixture.
- [x] P0 — Item 3: `harness status`, reusing the hook's comparison rather than copying it.
- [x] P1 — Item 4: `harness catalog`, reading the composed set from the existing report.
- [ ] P1 — Item 5: `harness audit`. **Not delegable** — what counts as a guide, and what its cost means,
      is the judgement this plan exists to make; a subagent returns a plausible inventory that drifts.
- [ ] P1 — Item 5: the three measurement traps as fixtures that fail before the guard exists.
- [ ] P2 — Item 6: the two detectors, tested and uncomposed.
- [ ] P2 — Once the resolve consolidation lands: add `harness resolve` in whatever shape it settled on.

## Surprises & Discoveries

<!-- Filled while the work happens. An entry written from memory at the end is worthless. -->

- Observation: `CLAUDE_PLUGIN_ROOT` as an environment variable — the seam's tier 3 — cannot be trusted as
  the *only* way the session hook learns where the norm is installed.
  Evidence: `plugin/references/harness-pair.md:130` states `${CLAUDE_PLUGIN_ROOT}` is "usually unset" for
  a process this plugin spawns, citing `resolve_runner()`'s own header — measured for the shell runner's
  invocation path, not this hook's, but no equivalent measurement exists for the SessionStart hook either.
  Resolution: `harness-status.ts` keeps its `--plugin <dir>` flag (unchanged in `hooks.json`) and passes it
  into `resolveSourceRoot` as the flag tier, so tier 3 is an added fallback rather than the only path —
  the hook does not regress if the env var turns out to be unset in practice. Tier 3 is unverified for
  this specific invocation path and should not be relied on alone until it is.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
