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
| Status | Done |
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

- [x] P0 — items 1–4
- [x] P0 — tests: a pipe gets no status line and no styled line; `--ui --verbose` styles; a warning keeps
      its place among held lines; the title names a plain repository and a linked working tree's
      repository
- [x] P0 — the gate: `npm run build:foundation && npm run build -w @entelekheia/vibe-ops-cli`,
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

- Observation: The track ran in the track-lead pipeline over two contracts (`0f210b5`, then `f44e679`) and
  an accidental editor interruption that stopped the first lead; a second lead resumed from the commits on
  disk. Five RED commits, three implementation commits, two reviews, eight findings — all eight fixed, none
  rejected. The machine-read output was compared per case in an empty repository against the contract
  sources: 45 invocations, 0 differences. `env -u VIBE_OPS_DENYLIST npm test`: 809 of 809.
  Evidence: the lead's triage file and reviews (in the run's scratch space); the main session reran RED 4
  and RED 5 in a scratch working tree (7 failing each, as recorded) and the full suite at `f0e9b2c`.
- Ruling (lead): the status line is not redrawn after a direct write erases it — the wrapper stays simple
  and never draws over output — cost if wrong: a long run that emits a warning early shows no status for
  the rest of the run.
- Ruling (implementer, accepted by the lead): the stream wrapper is installed only inside `progress()`,
  which already requires rich mode and a terminal on stderr, so no plain, `--json` or `--print` run is
  touched — cost if wrong: a caller injecting writers with `statusLine: true` gets the process streams
  wrapped too, harmlessly.
- Ruling (lead): outside a repository the anchor falls back to `basename(repoRootFrom(target))`, on the
  fallback path only — `--show-toplevel` predates `--path-format` — cost if wrong: git is spawned twice
  outside a repository.
- Ruling (lead): the parent rule of Q3 applies only to a hidden common dir; a visible bare `name.git`
  keeps its own name — taken for any basename, the rule would name a bare `super/vendor.git` `super`,
  because `super/.git` sits beside it — cost if wrong: a visible common dir whose parent is the repository
  would be named for itself.
- Ruling (lead): the unanchored "no raw `FAIL  [budget]` beside the block" guard lives in
  `rich-run.test.ts`, since the glyph leaves `render-plain.test.ts`'s `^FAIL` check unable to see a leaked
  line and only one of that file's assertions was authorised to change — cost if wrong: the claim is
  asserted in two files.
- Deferred minor: a status line erased by a direct write is not redrawn for the rest of the run.
- Observation (final review follow-up): a rich run lost a Ctrl-C that arrived while the module was
  blocked in `spawnSync`. The terminal's SIGINT killed the child and was queued on the main event loop,
  but only a poll phase dispatches a queued signal; `bin.ts` removed its `SIGINT` listener in the
  `finally` and went on to draw the result and `process.exit(0)` without reaching one, so no handler ever
  saw it. Evidence: the reproducer (`node sigint.mjs head tty 1500 …/mods/syncsleep.mjs`, Ctrl-C to the
  process group under `script`) printed `LOG after child signal=SIGINT` then `✔ done` and exited 0;
  `--no-ui` stopped. Red test: `rich-run.test.ts` "Ctrl-C while the module waits on a synchronous child
  …" failed with `exit status 0: "…PROGRESS two\r\n✔ done\r\n"` before the fix, passed after (3/3 runs);
  the reproducer then exited 130 with both held lines and no result, 3/3.
- Ruling: after `runModule` settles in a rich run, `bin.ts` keeps the `SIGINT` handler installed across
  two nested `setImmediate` hops, then removes it and only then erases the status line and flushes or
  draws — the first immediate runs in the current turn's check phase, the second only after the next
  turn's poll phase, which dispatches every signal already delivered to the process; the throw path
  goes through the same wait before flushing, so a signal on that path flushes once, not twice — this
  is event-loop ordering, not a wall-clock wait (a flag checked after `runModule` alone cannot work:
  the handler that would set it has not run yet), and Ctrl-C after the listener is removed falls back
  to Node's default (death by SIGINT, 130 at a shell) — cost if wrong: if a platform delivers the
  signal to the loop's pipe later than the child's exit is reaped, the run is lost as before, and the
  red test would catch it; an uninterrupted rich run pays two loop turns, and a stray timer of the
  module's due in them could run before the result is drawn.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
