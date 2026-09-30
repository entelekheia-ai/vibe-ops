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

# Task: The plain default narrows

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-30 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/041-the-cli-grows-a-render-layer.md — Track 4 |

---

## Context

Plan-041 Track 4, quoted: *"The passthrough filter in `cli/packages/module-check/src/index.ts` stops
repeating the composition preamble and its indented source lines, which move behind `--verbose`. At the
end, a repository with no findings reports one line, and `--verbose` reports everything it reports
today."*

Today the filter at `cli/packages/module-check/src/index.ts:428` passes any runner line matching
`/^(FAIL|WARN|SELF-TEST|composed|\s{2})/`. The runner prints `composed N checks:` and one indented line
per composed fragment (`cli/packages/module-check/sh/unported/check-agents-md.sh:200` and `:205`), then
`composed deny-list: …` (`:322`). All of it reaches every default run. The module contract already
forbids it: *"no 'composed N' preamble"* (`cli/AGENTS.md`, the module contract). `SKIP` is not in the
filter and stays out — the plan's Decision Log of 2026-09-30 settles that.

**Files owned:** `cli/packages/module-check/src/index.ts` (the passthrough filter only) and one new test
file under `cli/packages/module-check/test/`. **Other tracks running at the same time** own
`cli/packages/cli/**` (Track 2: `bin.ts`, `render.ts`, a CLI test) — do not touch it. The totals line
`N checks, M failed` is a contract with consumer repositories and must not change by a byte.

**Gate**, from the worktree root:

```sh
npm run typecheck -w @entelekheia/vibe-ops-module-check
node --test cli/packages/module-check/test/*.test.ts
npm run build -w @entelekheia/vibe-ops-module-check
node cli/packages/cli/dist/bin.js check 2>&1 | grep -c '^composed'                             # 0
node cli/packages/cli/dist/bin.js check --verbose 2>&1 | grep -c '^composed'                   # ≥ 1
node cli/packages/cli/dist/bin.js check --self-test; echo $?                                    # as before
```

**Never run the root `npm run build` in this track.** Track 2 edits `cli/packages/cli/src/` in the same
worktree at the same time, and the root build compiles it; the one-package build above leaves the CLI's
already-built `dist/` alone, which is all the commands above need.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Drop the preamble and its source listing from the default passthrough | S |
| 2 | P0 | Keep any indented line that belongs to a FAIL or WARN | S |
| 3 | P0 | A test for both | S |

### 1. The preamble leaves the default — P0

**What:** A run without `--verbose`/`--list` no longer repeats `composed N checks:`, the per-fragment
source lines under it, or `composed deny-list: …`.
**Why:** Twelve lines to say nothing failed, paid by every agent reading the gate.
**Change:** The filter at `index.ts:428`.

### 2. Evidence that is indented stays — P0

**What:** Establish, before removing `\s{2}`, whether any fragment prints an indented continuation line
under a `FAIL` or `WARN`. If one does, keep indented lines that follow a `FAIL`/`WARN` line and drop only
those that follow `composed`. If none does, say so with the command that shows it.
**Why:** `\s{2}` may be the only thing carrying part of a finding's evidence; removing it blind would
make a failing run quieter than the failure.
**Change:** Read `cli/packages/module-check/sh/unported/checks/*.sh` and run `check --self-test`, whose
fixture is broken on purpose, and read what its FAIL lines carry.

### 3. The test — P0

**What:** A non-verbose run's logged lines contain no line starting with `composed` and no source-listing
line; a `--verbose` run's contain `composed`; a FAIL or WARN still reaches the log when one exists. Model
it on `cli/packages/module-check/test/composition.test.ts` (it builds a `ModuleContext` and calls
`check.run`). Prefer a fixture over this repository where the assertion depends on what is found.
**Why:** The success criterion is a count of output lines, and nothing else pins it.

## Implementation order

- [x] P0 — item 2 answered first, with its evidence here under Surprises
- [x] P0 — item 1
- [x] P0 — item 3, green; then break it on purpose once (restore `composed` in the filter) and see it fail
- [x] P0 — the gate above, every line

`--self-test` output is unchanged by this track: it is the one mode whose text is the answer. If the
filter change alters what `--self-test` prints, keep that mode's output as it is today.

## Surprises & Discoveries

- Observation (item 2): no fragment prints indented evidence under a FAIL or WARN. Every finding is one line.
  Evidence: `fail()` in `check-agents-md.sh:60` is `printf 'FAIL  [%s] %s\n'`; `grep -rn` of `sh/unported/checks/*.sh` finds
  no indented printf/echo; `check --self-test` and `check --verbose` FAIL/WARN lines are each followed by another
  FAIL/WARN/ok line, never an indented one. The only indented lines are the `report_composition` listing
  (`:205`) and the second line of `SELF-TEST PASSED:` (`:~560`), which `\s{2}` was also carrying.
- Ruling: the default filter keeps an indented line only while it follows a FAIL/WARN/SELF-TEST line, and
  `--self-test` keeps the old filter byte for byte (its output still holds `composed` lines) — the dossier says that
  mode's text is unchanged — if wrong, `--self-test` loses its preamble, a cosmetic change.

- Deferred minor: `cli/packages/module-check/test/passthrough.test.ts` runs the whole gate over this
  repository three times, about 8–30 s a test and roughly 53 s for the module's suite — the assertions
  hold over any population, so a small fixture would serve them at a fraction of the cost.

- Observation (review blocker): `check --verbose` piped printed the `N checks, M failed` line twice.
  Evidence: `node cli/packages/cli/dist/bin.js check --verbose 2>&1 | grep -cE '^[0-9]+ checks, [0-9]+ failed'` gave 2; module-check logged
  `totals` under `--verbose` and, since Track 2, the CLI prints the plain summary bare too. Removed the verbose
  `context.log(totals)`; the count is now 1 for `check`, `check --verbose` and `check --audit`.
  The existing "only one count line" test in `composition.test.ts` counted logged lines, so it now asserts none
  is logged and the summary carries the one.

- Ruling: `@entelekheia/vibe-ops-module-check` takes a minor bump rather than a patch — removing the
  verbose totals is correct only beside a CLI that prints the summary bare, and the released CLI's
  `^0.1.2` range then cannot pick up `0.2.0` alone — cost if wrong: one version number nobody needed.
- Ruling: `composition.test.ts` now asserts no count line is logged and the summary carries the one —
  the line it counted is the one the blocker fix removed, and the contract is one line in total —
  cost if wrong: the test is looser about where the line comes from.
- Observation: The blocker came from two tracks meeting, and the plan's success criteria measured only
  the default run — none counted the totals under `--verbose`, the form every consumer gate runs. The plan
  now carries that criterion for `check`, `check --verbose` and `check --audit`.
  Evidence: the review of `84839f7` and `b85cc13`; `render-plain.test.ts` fails with the old verbose log
  put back.
- Deferred minor: `cli/packages/harness/scaffold/checks-run.sh:66-71` says the summary is rendered with a
  prefix so the bare form never appears, and that a clean run without `--verbose` prints nothing. Both
  are false after this plan. It is a promulgated file, so the correction is its own `harness sync`.

- Observation: The second pass over `7622bff` found nothing standing: the totals line prints once on stdout
  in the default run, `--verbose`, `--audit`, an exit-1 run and a refused target, through
  `module-check/sh/check.sh` and a scaffolded consumer alike, where the parent build printed two under
  `--verbose`; and `changeset version` on a scratch copy moved this package to `0.2.0`, the CLI to `0.3.0`,
  and the CLI's range to `^0.2.0`.
  Evidence: the second review's probes (`modes.sh`, `consumers.sh`), run against builds of `7622bff` and
  `b85cc13`.
- Deferred minor: a default `vibe-ops check <missing dir>` exits 2 and prints no reason — the runner's
  `not a directory: …` goes to stderr and the passthrough keeps only FAIL/WARN. The filter before this
  track dropped it too; `--verbose` shows it.
- Observation: two tests outside this plan fail on this branch and on its base alike —
  `cli/packages/gates/test/classification.test.ts:34` and `cli/packages/ops-exposure/test/ops.test.ts:68`,
  where a private-name check reports 229 examined. The cause is `VIBE_OPS_DENYLIST` set in the shell that
  ran them: both tests assert what happens when no deny-list is supplied, and one was. Neither test clears
  the variable before running.
  Evidence: `npm test` at `872d664` gave 766 of 768 with those two failing; `env -u VIBE_OPS_DENYLIST node
  --test` over the two files gave 21 of 21; this branch changes neither package (`git diff --stat
  29fefb6..HEAD -- cli/packages/gates cli/packages/ops-exposure` is empty).

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
