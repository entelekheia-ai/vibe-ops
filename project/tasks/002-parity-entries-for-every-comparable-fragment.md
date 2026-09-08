---
vibe-ops-template: task@3
---

# Task: Parity entries for every comparable fragment

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-07 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/038-concluding-the-fragment-migration-and-the-measurement-that-l.md, Track 2 |

---

## Context

Track 1 closed the two dishonest ports (`15-manifest-sync.sh`, `27-nudge-behaviour.sh`). Track 2's
text calls for "the thirteen missing `fragment-parity` entries", written before anyone read what the
existing four entries actually capture, or what `mirror`'s `file` field holds for a group/scan
comparison.

Audit before touching anything: `fragment-parity` extracts the compared file from
`^FAIL  \[<id>\] ([^:]+):` in the shell output. Three of the four wired entries
(`frontmatter`, `skill-frontmatter`, `memory-slugs`) never emit a colon-delimited path in most or all
of their `fail()` calls, so those entries compare an empty or near-empty set and report a clean pass
that proves nothing. Separately, `mirror`'s `file` for anything but a `pairs` comparison is the prose
`subject` string (`gates/src/mirror/index.ts:348`, `:370`), never a path — so a fragment ported to a
`mirror` group/scan entry structurally cannot be compared by `fragment-parity` at all, no matter how
its `fail()` message is shaped.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Prove or reject each candidate pair on a real fixture | M |
| 2 | P0 | Normalize `fail()` for every proved pair | S |
| 3 | P0 | Wire the new `fragment-parity` entries and fix the test's hardcoded list | S |
| 4 | P0 | Build the completeness entry | M |
| 5 | P1 | Fold results into Plan-038 (Decision Log, Track 2 text, Outcomes) | S |

### 1. Prove or reject each candidate — P0

**What:** For each of the nine fragments not already conclusively wired or exempt, build a one-defect
fixture, run the shell fragment and its port over it, and compare what each names.
**Why:** The verdict table in the plan is a hypothesis from reading source, not a measurement. Plan-022's
own bar is "shown to agree", not "read to agree".
**Change:** No repo change; this is measurement, recorded below as it happens.

### 2. Normalize `fail()` — P0

**What:** Reshape the message to `<repo-relative-path>: <text>` for every fragment step 1 proves
comparable.
**Why:** A prefix a script can produce and a gate can already parse is cheaper than a new extraction
rule in `fragment-parity`.
**Change:** One line per fragment under `cli/packages/module-check/sh/checks/`, `CHECK_VERSION` bumped
on each.

### 3. Wire entries — P0

**What:** Append `fragment-parity` entries to `cli/packages/ops-mirror/ops.json`; fix the hardcoded
label array and comparison-count loop in `cli/packages/ops-mirror/test/ops.test.ts`.
**Why:** The entries are the whole point of the track.
**Change:** `ops.json`, `test/ops.test.ts`.

### 4. Completeness entry — P0

**What:** A `mirror` `compare: "group"` entry: left = fragment ids from disk (`scan` over
`checks/*.sh` filenames), right = wired `fragment` values + declared exemptions.
**Why:** A hand-maintained list of pairs is a list of what someone remembered.
**Change:** New entry in `ops.json`.

### 5. Fold into Plan-038 — P1

**What:** Tick Track 2's checkbox, rewrite its text to state what was measured, add Decision Log
entries for the comparability boundary and the three vacuous entries found.
**Why:** The plan is the permanent record; this dossier is deleted at closure.
**Change:** `project/plans/038-....md`.

## Implementation order

- [x] P0 — Fixture-prove: `40-frontmatter` / `check-frontmatter` (schema: rule) — confirmed live
      (scratch repo: shell names the real path, port's finding already carries `file`)
- [x] P0 — Fixture-prove: `45-skill-frontmatter` / `check-frontmatter` (schema: skill) — confirmed live,
      same run
- [x] P0 — Fixture-prove: `60-memory-slugs` / `classification` — confirmed by source
      (`classification`'s `report()` always sets `file`)
- [x] P0 — Fixture-prove: `52-machine-paths` / `classification` — confirmed by source, same gate
- [x] P0 — Fixture-prove: `80-template-attribution` / `classification` — confirmed by source, same gate
- [x] P0 — Fixture-prove: `30-bridge` / `bridge` — confirmed by source (`file: rel` on every finding)
- [x] P0 — Fixture-prove: `10-budget` / `budget` — confirmed by source; the one exception
      (no-AGENTS.md) carries no `file` on either side and is deliberately left unprefixed
- [x] P0 — Fixture-prove: `35-dogfooding-drift` / `mirror` pairs — confirmed by source
      (`where: a`, the pair's left/own-repo path, matches the pair order the shell fragment already uses)
- [x] P0 — Confirmed the eight exemptions structurally: five `mirror` group/scan entries
      (`hooks-registration`, `references-completeness`, `plugin-root-paths`, `command-references`) plus
      `license-texts` (`rows`, always names `SOURCES.tsv`) via `mirror`'s `where` logic; `private-names`
      by its own header comment (never echoes the file, by design); `manifest-sync`/`nudge-behaviour`
      carried over from Track 1
- [x] P0 — Normalized `fail()` for all eight comparable fragments, bumped `CHECK_VERSION` on each
- [x] P0 — `check-agents-md.sh --self-test` green after normalization (25 failures still fire, all
      assertions intact)
- [x] P0 — Five new `fragment-parity` entries in `ops.json` (`machine-paths`, `template-attribution`,
      `bridge`, `budget`, `dogfooding-drift`) — nine wired in total with the three repaired
- [x] P0 — Fixed `ops.test.ts` hardcoded label array + comparison loop
- [x] P0 — Completeness `mirror` entry (`fragment-parity-completeness`), scanning fragment ids from
      disk against live `"fragment":`/`"exempt":` strings in `ops.json` itself; proved it fails naming
      `budget` when `fragment-parity-budget` is deleted, then restored
- [x] P1 — `rm -rf cli/packages/*/dist && npm run build && npm test && npm run typecheck` — 643/643,
      clean
- [x] P1 — Updated Plan-038: Track 2 checkbox, four new Decision Log entries, Outcomes & Retrospective
- [ ] P1 — Commit

## Surprises & Discoveries

- Observation: three of the four `fragment-parity` entries wired before this track (`frontmatter`,
  `skill-frontmatter`, `memory-slugs`) compare a vacuous or near-vacuous set because their `fail()`
  message has no `<path>:` prefix, and the repository being clean means the shell side is always empty
  — so they have reported "agreement" without ever comparing a real file.
  Evidence: `check-agents-md.sh` lines for `40-frontmatter.sh:21,24`, `45-skill-frontmatter.sh:34,52`,
  `60-memory-slugs.sh:37`, read against `fragment-parity`'s extraction regex
  (`gates/src/fragment-parity/index.ts` `failedFilesFor`).
- Observation: `mirror`'s `file` field for a group/scan comparison is the prose `subject`, never a
  path — this is a structural property of the gate, not a per-fragment accident, and it rules out five
  fragments from `fragment-parity` regardless of how their shell message is shaped.
  Evidence: `gates/src/mirror/index.ts:348` (`where: subject`) vs `:331` (`where: a`, only under `pairs`).

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
