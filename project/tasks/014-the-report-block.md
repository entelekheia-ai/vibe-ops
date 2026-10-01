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

# Task: The report block

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-30 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/041-the-cli-grows-a-render-layer.md — Track 3 |

---

## Context

Plan-041 Track 3, quoted: *"`cli/packages/cli/src/report-view.ts` draws counts by state followed by each
finding with its location, and `out.result()` routes to it. At the end, a run at an interactive terminal
shows the block, the same run piped shows the summary line, and `--json` shows neither."*

It reads the `Report` of Track 1 (`readReport` in `cli/packages/core/src/report.ts`) and plugs into the
`out.result()` of Track 2 (`cli/packages/cli/src/render.ts`). Carried out in the main loop: what the block
shows and how it looks is the judgement the plan's Decision Log keeps with the author.

**Files owned:** `cli/packages/cli/src/report-view.ts` (new), `cli/packages/cli/src/render.ts` (the rich
branch of `result`), `cli/packages/cli/src/bin.ts` (the header it passes), and tests under
`cli/packages/cli/test/`.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `report-view.ts`: counts, findings grouped by id, the summary last | S |
| 2 | P0 | `out.result()` draws it when rich and `data` is a report | S |
| 3 | P0 | Tests: the view's lines, and the real binary under `--ui` and in a pipe | S |

### 1. The view — P0

**What:** A title line (what ran, where), one counts line (fail, warn, skip), then each group of findings
by id — failures first, a count beside a group of more than one, the location on its own line when the
finding carries one — then the module's summary verbatim, behind a glyph.
**Why:** The block is the whole of goal 2.
**Change:** New file, returning lines rather than writing them.

### 2. The routing — P0

**What:** `out.result()` in rich mode calls `readReport(result.data)`; a report is drawn, anything else
keeps the one glyph line. `bin.ts` passes the header.
**Why:** The plan's flow: `--json` first, then rich, then report-or-not.

### 3. The tests — P0

**What:** A unit test over `renderReport`: order (fail groups before warn), grouping and counts, the
summary as the last non-empty line and byte-identical to the input, no escape bytes with colour off. An
end-to-end test: `check --ui` in a pipe shows the counts line, `check` in a pipe does not, and
`check --ui --json` prints JSON only.

## Implementation order

- [x] P0 — item 1
- [x] P0 — item 2
- [x] P0 — item 3, green; then break the routing once on purpose and see the end-to-end test fail
- [x] P0 — the gate below; and one run under a real pseudo-terminal

**Gate**, from the worktree root:

```sh
npm run build:foundation && npm run build -w @entelekheia/vibe-ops-cli
npm run typecheck -w @entelekheia/vibe-ops-cli
node --test cli/packages/cli/test/*.test.ts
script -q /dev/null node cli/packages/cli/dist/bin.js check        # the block, at a real terminal
node cli/packages/cli/dist/bin.js check 2>&1 | tail -1              # the summary line, alone
```

## Surprises & Discoveries

- Observation: Drawn beside the module's own output, the block repeats every finding: `check` writes its
  FAIL and WARN lines through the `sink` as it runs, and the block lists the same findings again below.
  The plan did not foresee it — Track 2's `sink` streams to stdout in every mode.
  Evidence: read from the code, before the block was wired — `check` logs its FAIL/WARN lines through
  `context.log` (the passthrough in `cli/packages/module-check/src/index.ts`) and returns the same findings
  in `data.findings`, which the block draws. `render-plain.test.ts` now asserts a rich run carries no raw
  `FAIL  [budget]` line.
- Ruling: In rich mode only, `bin.ts` holds the module's lines back; a drawn block stands in for them, and
  anything else — a non-report result, `--verbose`, `--list` — prints them before the close, where they
  always were. Plain mode streams exactly as before, and `--json` / `--print` never hold, since their
  output is a stream or a document — cost if wrong: a rich run of a long module shows its lines at the end
  rather than as they come.
- Ruling: The block's `where` is the directory name of the repository the module acted on — the first
  positional's for a module that takes one, the working directory's otherwise — cost if wrong: a
  worktree shows its own directory name rather than the repository's.
- Ruling: Skips are counted in the block and not listed; the list is one `--verbose` away — cost if
  wrong: a person has to ask for what a disablement says.

- Observation: The review of `9547ed1` found the holding ruling above wrong in two ways, both reproduced
  before the fix: a module that threw after logging lost every held line (the error handler in `main`
  never saw them), and a drawn block dropped every held line, not only the findings it redraws — a
  `FIXED [links] …` repair line and a `hint:` line vanished under `--ui` and printed under `--no-ui`.
  Evidence: the reviewer's `throws.mjs` and `exits.mjs` probes, rerun against this worktree's build;
  both are now tests in `render-plain.test.ts`, and each fails with its fix taken out.
- Ruling (narrows the first ruling above): the block stands in for the finding lines only —
  `FAIL|WARN|SKIP  [id] …`, the lines it redraws — and every other held line prints above it; a throw
  writes the held lines to stdout before the error. (Narrowed again below: its cost clause was wrong.)
- Ruling: `check`'s findings carry `file` and `line` beside the `evidence` that already folds the file in,
  and the block strips that folded prefix when it draws the location on its own line — the merge
  predated this track and dropped `line`, which the block made visible; `--json` readers of `evidence`
  see it unchanged — cost if wrong: two new optional fields in `check`'s payload.
- Deferred minor: under `check` the block groups by the gate label (`template-version-plan`) where the
  plain line names the rule (`template-version-behind`); the rule is not carried through `check`'s merge.
- Deferred minor: the block's fail count counts findings, while the summary counts failed checks, so the
  two numbers can differ in one run.

- Observation: The second pass over `872d664` found the narrowed filter still wrong for `check`, which
  hands the sink one joined string per half of its run: an entry beginning `FAIL` was dropped whole,
  indented detail included, and one beginning otherwise kept its FAIL lines to print a second time. A
  real `check` with a fragment printing a FAIL and an indented `detail:` line showed the detail under
  `--no-ui` and lost it under `--ui`. It also found a rich run interrupted by SIGINT exiting 130 with
  every held line unprinted.
  Evidence: the reviewer's `check-continuation.sh` and `order.sh`, rerun against this worktree's build;
  both are now tests or fixed paths, and the filter tests fail with the per-line split taken out.
- Ruling (narrows the holding ruling a second time): the filter splits each held entry into lines, and a
  finding line is dropped only when nothing is indented under it — the block redraws a finding's first
  line and no more, so a finding with detail prints whole above the block; SIGINT writes the held lines
  before exiting 130 — cost if wrong: a finding with detail appears twice, once whole and once redrawn.
- Deferred minor: under `--ui`, a module's `context.warn` lines (written straight to stderr by
  `cli/packages/cli/src/run.ts`) print before its held stdout lines rather than among them.

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
