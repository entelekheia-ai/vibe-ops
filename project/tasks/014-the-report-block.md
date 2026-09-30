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

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
