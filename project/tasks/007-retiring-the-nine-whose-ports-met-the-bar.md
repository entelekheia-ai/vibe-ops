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

## The eight, audited — one retirable

Eight fact sheets, four subagents reading in parallel, every load-bearing claim re-verified by hand
before it was believed. The result inverts the track's expectation: **seven of the eight ports do less
than the fragment they were written to replace.**

| Fragment | Verdict | What the port does not do |
|---|---|---|
| `nudge-behaviour` | **retirable** | nothing — 7 of 7 assertions covered, one strengthened |
| `private-names` | not retirable | population is `**/*.md`; the fragment's `git grep` has no pathspec (344 tracked non-markdown files), matches case-insensitively (`-i`) and literally (`-F`) where the gate compiles `new RegExp(pattern)` — case-sensitive, metacharacters live |
| `hooks-registration` | not retirable | the `description` count check, and the **entire** skill-scoped `hooks:` population (four failure branches) — roughly half the fragment |
| `references-completeness` | not retirable | the `vibe-ops-reference: <name>@<n>` token check (nothing in the repository reads that token) and the whole `references/*.md` population; the port checks only that `authoring.md` **exists** |
| `license-texts` | not retirable | the `{{placeholder}}` guard, and the verification that this repository's own `LICENSE` is the real Apache-2.0 text — no ops entry reads `LICENSE` at all |
| `plugin-root-paths` | not retirable | climb-out detection and its `plugin-root-paths: allow` marker — `mirror` has no notion of either |
| `command-references` | not retirable | the fenced-code-block decoy; `mirror`'s `scan` reads raw text with no fence awareness, so a usage example would become a false positive |
| `manifest-sync` | cannot tell | four comparisons map one-to-one, but `manifest-description` and `manifest-keywords` carry no fixture, and the port turns three of the fragment's designed SKIPs (absent `marketplace.json`, absent `plugin.json`, no matching entry) into FAILs |

### What the audit turned up

- Observation: `plugin-root-path`'s port passes the exact lines the fragment's decoy was written for, and
  passes them **by coincidence**. The fragment fails a `${CLAUDE_PLUGIN_ROOT}/../…` reference unless the
  line carries `plugin-root-paths: allow`; the port does a plain `existsSync` on the resolved path, and in
  this checkout `plugin/../cli/…` resolves because `cli/` is `plugin/`'s sibling. In an installed plugin —
  a version-pinned cache directory with no sibling `cli/` — it would not resolve, so the port's verdict on
  the one input that matters depends on which tree it runs in. That is the failure the climb check exists
  to catch, reproduced inside its own replacement.
  Evidence: `grep -n '\.\./\|climb' gates/src/mirror/index.ts` finds only glob escaping;
  `test -e plugin/../cli/packages/module-check/sh/check-agents-md.sh` succeeds;
  `plugin/skills/setup/SKILL.md:257-258` are the live marked lines.

- Observation: the eight were exempted from `fragment-parity` for a **mechanical** reason — the gate
  compares sets of file paths and these produce none — and that exemption was read, by this plan
  included, as though it said something about the ports. It does not. **Not one of these eight entries
  carries a fixture**, so no one has ever watched any of these ports fail. Plan-022's third condition
  exists for precisely this, and eight checks were routed around it by a technicality.
  Evidence: no `fixture` key on `hooks-registration`, `authoring-completeness`, `license-text`,
  `plugin-root-path`, `command-reference`, `manifest-description` or `manifest-keywords` in
  `cli/packages/ops-mirror/ops.json`; the tests that look like theirs in `gates/test/mirror.test.ts`
  build their own options objects and exercise the gate's mechanics, not these entries' configuration.

- Observation: Plan-037 closed on "every one of the seventeen fragments now has a TypeScript
  counterpart", which is true and was read as though it meant the counterpart did the same job. Seven do
  less. The sentence that would have caught it is the one this audit asks — *which gate covers each
  branch* — and nothing required it at the time.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
