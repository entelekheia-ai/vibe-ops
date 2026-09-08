---
vibe-ops-template: task@3
---

# Task: Retiring the nine whose ports met the bar

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-09-08 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/038-concluding-the-fragment-migration-and-the-measurement-that-l.md, Track 7 |

---

## Context

Plan-022's bar holds for nine of the seventeen fragments: a corpus wide enough to exercise the check, no
divergence ever reported, and both sides made to fail on one shared fixture. The other eight have a port
that was never compared — `fragment-parity` cannot reach them structurally — so retiring those is a
different act, needing analysis rather than a bar already met.

The ordering constraint that shaped this track came from outside vibe-ops: every consumer repository
under the authoring workspace ran `check-agents-md.sh` **by path** and composed no ops at all, so a
retired fragment would have removed a check from each of them with nothing taking its place. Four were
migrated first; the maintainer is holding the rest, so the window is controlled rather than silent.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Clear the corpus-width blocker on the ninth pair | S |
| 2 | P0 | Migrate the consumer repositories that can be migrated | M |
| 3 | P0 | Delete the nine fragments and their parity entries | M |
| 4 | P0 | Retire the `fragment-parity` gate, now composed nowhere | S |
| 5 | P1 | Correct every document the deletion made false | M |

### 1–2

**What:** `fragment-parity-bridge` declared `.claude/**`, which the ops-wide `ignore` strips; it now
declares `.agents/**` and examines 2 files. A `/migrate-harness` skill was written at the workspace root
and four repositories moved onto `vibe-ops check` (17 checks → 46 each).
**Why:** the first condition was unmet for one pair, and unmigrated consumers would have lost coverage
in silence.
**Change:** `cli/packages/ops-mirror/ops.json`; four sibling repositories; a workspace skill and rule.

### 3–4

**What:** nine fragment files deleted, their nine `fragment-parity` entries removed, the completeness
entry's left side trimmed from seventeen paths to eight, and the `fragment-parity` gate and its test
deleted. The runner's `--self-test` lost the nine ids and the per-check decoy assertions for two of them;
its declared-disablement assertion moved from `machine-paths` to `private-names`.
**Why:** with no entry left, the gate was composed nowhere — the state its own header predicted for the
day its subject left.
**Change:** `cli/packages/module-check/sh/`, `cli/packages/gates/src/fragment-parity/`,
`cli/packages/ops-mirror/{ops.json,test/ops.test.ts}`.

## Implementation order

- [x] P0 — Ninth pair's population corrected; all nine meet the three conditions
- [x] P0 — Four consumer repositories migrated; the rest held deliberately by the maintainer
- [x] P0 — Nine fragments, nine entries, the gate and its test removed
- [x] P0 — Runner `--self-test` green on the eight that remain
- [x] P0 — `check --self-test` green, `ports` still reports all nine ports failing on the shared fixture
- [x] P1 — `npm test` 637/637, `npm run typecheck` clean, gate green at 50 checks
- [ ] P1 — Documents corrected (delegated)
- [ ] P1 — The eight unproved fragments: analysis, then retirement or written exemption
- [ ] P1 — Commit

## Surprises & Discoveries

- Observation: the fixture had to be kept **intact** while the fragments that justified it were deleted.
  Every defect the nine retired fragments used to catch is still in `build_fixture`, because ownership of
  that evidence transferred rather than lapsed: `check --self-test`'s `ports` phase asserts the nine
  PORTS still fail on it. Deleting the decoys alongside the assertions that read them — the obvious tidy
  — would have silently weakened the only fixture the ports are measured against.
  Evidence: `check --self-test` after the deletion still prints `ports: all 9 proved-comparable fragments
  failed on the shared fixture`, built through `--emit-fixture` from a `build_fixture` that did not change.

- Observation: retiring the fragments retired the measuring apparatus in the same act, without anyone
  deciding to. Once the nine entries were gone, `fragment-parity` was composed nowhere — the state
  `harness catalog` exists to report — so the gate deleted itself by the argument its own header had
  written years earlier ("what lets this gate leave the repository the day its `fragment` does").
  Evidence: `grep -c '"fragment-parity"' cli/packages/ops-*/ops.json` returned 0 across all five ops
  immediately after the entries were removed, before the gate itself was touched.

- Observation: a self-test assertion can name a subject it is not about. The declared-disablement check
  used `machine-paths` as its subject, and deleting that fragment broke an assertion whose actual claim —
  that a declared-off check reports `SKIP` naming its reason — has nothing to do with which check it uses.
  Repointing it at `private-names` restored it unchanged in meaning.
  Evidence: `SELF-TEST FAILED: a declared-off check did not report SKIP naming its reason`, fixed by a
  substitution of the subject only.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
