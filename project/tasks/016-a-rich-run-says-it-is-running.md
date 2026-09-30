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

# Task: A rich run says it is running, styles its verbose lines, and names what it read

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-09-30 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/041-the-cli-grows-a-render-layer.md — Track 5 |

---

## Context

The maintainer ran Tracks 1–4 at a terminal and asked for three things: feedback while `vibe-ops check`
works, because a silent terminal reads as a hang; `--verbose` formatted by the same rich/plain decision
as the rest; and a block title that says what the result is of, anchored at what was analysed.

Carried out by a track lead in its own worktree, which writes the red tests, dispatches the implementer
and the reviewer, and triages. **Files owned:** `cli/packages/cli/src/render.ts`, `bin.ts`, `run.ts` (an
optional warning sink on `RunOptions`), `report-view.ts` (the title), tests under `cli/packages/cli/test/`,
this dossier, and one new `.changeset/*.md` for `@entelekheia/vibe-ops-cli`.

**Frozen, and not this track's to change:** everything a machine reads. A pipe, `--no-ui`, `CI`,
`NO_COLOR` without `--ui`, `--json` and `--print` produce byte-for-byte what they produce at the contract
commit, and the `N checks, M failed` line prints once on stdout in the default run, `--verbose` and
`--audit`. `cli/packages/cli/test/render-plain.test.ts` already asserts most of this; its assertions over
machine-read output stay untouched and green, and anything this track adds to it is additive. **Amended
at the second contract:** an assertion there that pins *rich* output — the `check --ui --verbose` test's
`/^FAIL {2}\[budget\]/m` — may change to the styled line the design asks for (`✖ FAIL  [budget]`), since
rich output is what this track exists to change.

**The caller's design notes — a starting point, not a spec.** Verify each against the code:

- *Status line.* `render.ts` gains `out.progress(label)` returning a `stop()`; it writes
  `◌ <label> · running…` to stderr with no newline, only when the run is rich **and** `process.stderr.isTTY`
  (a `--ui` run into a pipe gets none), and `stop()` writes `\r\x1b[2K`. `bin.ts` starts it right before
  `runModule` when lines are being held, and stops it in the `finally`, before anything is flushed or drawn
  — including the throw and SIGINT paths.
- *Warnings.* `run.ts` builds `warn` as a direct `process.stderr.write`, which would print onto the status
  line and make `stop()` erase the warning. `RunOptions` gains an optional warning sink (default: today's
  behaviour); in rich mode `bin.ts` holds warnings with the lines as `{ text, stream: "err" }` beside
  `{ text, stream: "out" }`, and every flush — result, throw, SIGINT — writes each held line to its own
  stream, in order. The comment in `run.ts` on why warnings go to stderr stays true and should stay.
- *Styling held lines in rich mode.* The runner and the ops share line shapes: `^(ok|FAIL|WARN|SKIP)\s+\[id\] rest`,
  the header `check-agents-md — <path>`, `composed N checks:` with indented `id@N  source` lines under it,
  and `composed deny-list: …`. Styled: the verdict word with its glyph and colour (`✔ ok` green,
  `✖ FAIL` red, `⚠ WARN` yellow, `⊘ SKIP` dim), `[id]` bold, the header's name bold, `Composed`
  capitalised, `id@N` bold. Only in rich mode, only held `out` lines; any other line prints as written.
  The maintainer's sketch of the wanted look:

  ```text
  ✔ ok   [first-publish] 24 examined        ← verdict coloured, [id] bold
  check-agents-md — /path/to/repo            ← name bold
  Composed 7 checks:
    manifest-sync@1    sh/unported/checks/15-manifest-sync.sh   ← id@N bold
  ```

- *Title.* `report-view.ts` draws `result of <title> – <anchor>` (an en dash). The anchor is what the
  module analysed: `bin.ts` computes it from the target it already resolves — the repository's name when
  the target is inside a git repository, taken from `git rev-parse --path-format=absolute
  --git-common-dir` so that a linked working tree names its repository (`…/vibe-ops/.git` → `vibe-ops`;
  a bare `…/name.git` → `name`), and the folder's own name when it is not in one. Measured here: this
  worktree's toplevel is `…/.claude/worktrees/plan-041-cli-render-layer` and its common dir
  `…/vibe-ops/.git`.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | A status line on stderr while a rich run works, erased before any output | S |
| 2 | P0 | Warnings held with the lines in rich mode, in order, on their own stream | S |
| 3 | P0 | Held lines styled by the runner's shapes in rich mode | S |
| 4 | P0 | Title `result of <what ran> – <anchor>` | S |

## Implementation order

- [ ] P0 — items 1–4
- [ ] P0 — tests: a pipe gets no status line and no styled line; `--ui --verbose` styles; a warning keeps
      its place among held lines; the title names a plain repository and a linked working tree's
      repository
- [ ] P0 — the gate: `npm run build:foundation && npm run build -w @entelekheia/vibe-ops-cli`,
      `npm run typecheck -w @entelekheia/vibe-ops-cli`, `node --test cli/packages/cli/test/*.test.ts`,
      and a run under `script -q /dev/null`

## Surprises & Discoveries

- Observation: A status line on stderr would have collided with the module's warnings, which
  `cli/packages/cli/src/run.ts` writes straight to stderr during the run — a warning would have been
  printed onto the same terminal line, and the erase would then have cleared the warning instead.
  Evidence: `warn: (message) => process.stderr.write(...)` in `run.ts`; the status line has no newline.
- Ruling (main session, at the second contract): the lead's three questions are answered as the macro's
  owner. Q1 — the verdict glyph (`✔ ok`, `✖ FAIL`, `⚠ WARN`, `⊘ SKIP`) is restored, and the one rich-output
  assertion in `render-plain.test.ts` that pins the unstyled line changes with it; the "untouched" rule was
  meant for machine-read output and was written wider than that. Q2 — the changeset states what the erase
  covers: anything written through `process.stdout` / `process.stderr`, such as `console` or a Node warning;
  a child with inherited stdio or a raw `fs.writeSync` is outside it, and no built-in module does either.
  Q3 — the anchor takes the common dir's parent only when the common dir's basename is `.git` or
  `<parent>/.git` exists, and otherwise `basename(repoRootFrom(target))` — cost if wrong: Q1 costs one
  follow-up cycle; Q3 one test and a condition.
- Ruling: In rich mode a module's warnings are held with its lines, keep their order among them, and
  are still written to stderr when flushed — the status line then owns stderr while the module runs, and
  the deferred minor about warnings jumping ahead of held lines goes away with it — cost if wrong: a
  rich run's warnings appear at the end of the run rather than as they happen.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
