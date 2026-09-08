---
vibe-ops-template: task@3
---

# Task: The verb becomes the composition

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-08 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/038-concluding-the-fragment-migration-and-the-measurement-that-l.md, Track 6 |

---

## Context

Track 5 moved every consumer's gate onto `vibe-ops check`, but the verb was still a wrapper spawning
`sh/check-agents-md.sh` and nothing else. Two consequences, both found by reading rather than by failure:
this repository's own commit gate ran seventeen shell fragments and **not one** of the twenty-one gates
written to replace them — the ops were reachable only through their own nouns and their tests — and
nothing anywhere declared which ops a repository composes. Activation was npm resolution alone, which is
why `mirror` and `exposure`, in no package's dependency list, worked here only through workspace symlinks.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `config.ops` and `effectiveOps`, modelled on `config.types` | M |
| 2 | P0 | `check` composes the ops beside the shell half | M |
| 3 | P0 | Collapse the duplicated ops lists onto `effectiveOps` | S |
| 4 | P0 | Hold the `N checks, M failed` contract Track 5 wired | S |

### 1

**What:** `core/src/ops-map.ts` — `DEFAULT_OPS` (the three that name nothing outside the repository being
checked: `governance`, `agents-md`, `exposure`) and `effectiveOps(config)` merging `config.ops` over them,
with `false` removing a default. `OpsConfig` added to `VibeOpsConfig`, merged per key like `types`.
`mirror` and `for-vibe-ops` moved into this repository's own `vibeops.config.ts`.
**Why:** ADR-0019 already made the config the registry for governance types; ops get the same door rather
than a second concept, and this repository goes through it like any consumer.
**Change:** `cli/packages/core/src/{ops-map.ts,config.ts,index.ts}`, `vibeops.config.ts`.

### 2–4

**What:** `runComposedOps` runs each declared ops in-process and merges its **structured `data`** —
findings, skipped, population — rather than re-parsing printed lines. One `N checks, M failed` line over
both halves; the runner's own partial count is filtered out of every mode. An ops that does not resolve
is a named finding that fails the run.
**Why:** both halves running is what makes Track 7 a removal rather than a silent retirement of seventeen
checks nobody judged.
**Change:** `cli/packages/module-check/src/index.ts`, `cli/packages/harness/src/catalog.ts`,
`cli/packages/module-check/test/composition.test.ts` (new), `cli/packages/harness/test/catalog.test.ts`.

## Implementation order

- [x] P0 — `ops-map.ts`, `OpsConfig`, the per-key merge, core exports
- [x] P0 — `mirror` + `for-vibe-ops` declared in this repository's own config
- [x] P0 — Measured first that all five ops were green here, so composing them could not turn the gate red
- [x] P0 — `runComposedOps` merges structured data; `check` reports 68 checks (17 fragments + 51 gates)
- [x] P0 — Three duplicated ops lists collapsed onto `effectiveOps` (two in module-check, one in catalog)
- [x] P0 — Four contract tests: the summary shape, both halves counted, exactly one count line, an
      unresolvable declared ops named and failing
- [x] P1 — `npm test` 647/647, `npm run typecheck` clean, `check --self-test` green
- [ ] P1 — Commit

## Surprises & Discoveries

- Observation: this repository reported "typecheck clean" in Track 5 without having measured it.
  `npm run typecheck | tail -3` prints the last workspace package's banner whether or not earlier packages
  failed, so a real pre-existing error in `gates/test/runner-provenance.test.ts:78` was invisible and was
  reported as clean. The failure mode is the one this workspace already has a rule about — a command that
  fails silently confirms what you wanted to hear — and it was reintroduced by a pipe.
  Evidence: `cd cli/packages/gates && npx tsc --noEmit` on a package untouched by any of this work returns
  `TS2345` at `runner-provenance.test.ts:78`; `git log -1` on that file names `a7e7416`, long before
  Plan-038. Fixed here (`"skipped" in result` does not narrow an optional field; `result.skipped !==
  undefined` does).

- Observation: the ops were never part of this repository's commit gate. `vibe-ops check` spawned only the
  shell runner, so twenty-one gates — including every port the last four tracks proved against its
  fragment — ran in tests and in their own nouns and nowhere else. Composing them was additive and safe
  only because all five ops happened to be green; that was measured before writing the composition, not
  assumed.
  Evidence: `vibe-ops check --verbose` before the change printed 17 composed fragments and no gate;
  running each ops by hand gave `18 gates, 0 failed, 1 warned` / `7` / `4` / `21` / `1`, all green.

- Observation: `harness catalog` reading a different ops set from the gate it reports on is a real failure
  mode, and the catalog test was the thing that surfaced it — it built its context with `config: {}`, so
  once composition became config-driven the catalog reported this repository's own `mirror` gates as
  composed nowhere while `check` was running them every commit.
  Evidence: `catalog.test.ts` failed listing `fragment-parity`, `mirror`, `template-heading-drift` as
  uncomposed; fixed by loading the real config, which is what the test's own claim ("against this
  repository's own checkout") always meant.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
