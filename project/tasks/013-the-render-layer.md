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

# Task: The render layer, and the framing leaves the pipe

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-30 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/041-the-cli-grows-a-render-layer.md — Track 2 |

---

## Context

Plan-041 Track 2, quoted: *"`cli/packages/cli/src/render.ts` is written and the nine `@clack/prompts`
call sites in `cli/packages/cli/src/bin.ts` move onto it, leaving `p.confirm` and its cancellation as the
only clack usage. `--ui` and `--no-ui` are introduced as CLI-level flags, extracted from the argument list
before the module's own strict parse and listed in `--help` under a section of their own. At the end,
`vibe-ops check` piped into anything contains no escape bytes and no framing characters, and the orphaned
`│` that a run with no `p.intro` emits today is gone."*

The split, from the plan's Decision Log: `render.ts` is written in the main loop and is **already on
disk** — read it first, it is the contract. The call-site substitutions in `bin.ts`, the flag wiring and
the tests are this dossier's delegable half.

**Files owned by the implementer:** `cli/packages/cli/src/bin.ts` and new files under
`cli/packages/cli/test/`. `cli/packages/cli/src/render.ts` may change only to fix a defect found while
wiring it, and each such change is written below under Surprises as a `Ruling:`. **Other tracks at the
same time:** Track 4 edits `cli/packages/module-check/src/index.ts` and adds a test beside it, in this same
worktree — do not touch `cli/packages/module-check/`.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | The nine clack call sites move onto `render.ts` | S |
| 2 | P0 | `--ui` / `--no-ui` extracted in `main`, and listed in `--help` | S |
| 3 | P0 | Two tests: the render predicate, and the real binary in a pipe | S |

### 1. The call sites — P0

**What:** Every `p.note`, `p.log.error` and `p.log.success` in `bin.ts` goes through one `Out` built by
`createOut` from `render.ts` — `out.help(title, lines)`, `out.error(message)`, `out.result(result, { json
})`. Build it once in `main`, from `wantsRich(ui, { isTTY: process.stdout.isTTY === true, env:
process.env })` and `colour: colourAllowed(process.env)`, and pass it to `usage`, `runNamed` and the
`mcp --help` branch. The final `catch` in `main` builds its own `Out` the same way if the one in `main`
is out of reach. `p.confirm`, `p.isCancel` and `p.cancel` stay exactly as they are.
**Why:** The framing reaches the pipe from these nine sites, and nowhere else.
**Change:** The `--json` block and the summary block after `runModule` (today two `if` blocks writing to
stdout and stderr) collapse into `out.result(result, { json: parsed.values.json === true })`, which
already does both. The `sink` passed to `runModule` stays a raw `process.stdout.write`.

### 2. The global flags — P0

**What:** `extractGlobalFlags(argv)` runs at the top of `main`, before `--version`, `--help`, `mcp`,
`hook` or `runNamed` see the arguments, so `vibe-ops check --ui` and `vibe-ops --ui check` both reach
`check` without `--ui`. `usage()` and a module's own `--help` gain a section titled
`flags on every command:` listing `GLOBAL_FLAGS`, after the module's own flags.
**Why:** `runNamed` parses with `strict: true` against the module's declared flags, so an unextracted
`--ui` is refused as unknown and exits 2.
**Change:** `main` and the two help builders in `bin.ts`.

### 3. The tests — P0

**What:**
- `cli/packages/cli/test/render.test.ts`, unit, over `src/render.ts`: `wantsRich` — `on` wins over a
  non-TTY, `off` wins over a TTY, a TTY with `CI=1` or `NO_COLOR=1` is plain, a bare TTY is rich;
  `extractGlobalFlags` — removes both flags anywhere, the last one wins, anything after `--` is kept;
  `createOut` — plain `result` writes the summary alone and no `\x1b`; rich with `colour: false` writes
  no `\x1b`; `json` writes the payload to stdout and the summary to stderr.
- `cli/packages/cli/test/render-plain.test.ts`, through the real built binary, modelled on
  `cli/packages/cli/test/json-flag.test.ts` (a temporary git repository, `spawnSync("node", [BIN, …])`):
  `check` in a pipe emits no `│`, no `◆` and no `\x1b`; `check --ui` in a pipe emits a `✔` or `✖`
  summary glyph; `check --no-ui` is accepted (exit code other than 2); an unknown flag still exits 2
  with a line beginning `error: `.
**Why:** The success criterion is a byte count on a pipe, and only the real binary produces the bytes.

## Implementation order

- [x] P0 — item 1
- [x] P0 — item 2
- [x] P0 — item 3, green; then break it once on purpose (put a `p.log.success` back) and see
      `render-plain.test.ts` fail
- [x] P0 — the gate below, every line

**Gate**, from the worktree root:

```sh
npm run build:foundation && npm run build -w @entelekheia/vibe-ops-cli
npm run typecheck -w @entelekheia/vibe-ops-cli
node --test cli/packages/cli/test/*.test.ts
node cli/packages/cli/dist/bin.js check 2>&1 | grep -c '│\|◆'                       # 0
node cli/packages/cli/dist/bin.js check 2>&1 | cat -v | grep -c '\^\['              # 0
grep -o 'p\.[a-zA-Z.]*' cli/packages/cli/src/bin.ts | sort -u                        # p.cancel p.confirm p.isCancel
node cli/packages/cli/dist/bin.js check 2>&1 | grep -cE '^[0-9]+ checks, [0-9]+ failed'   # 1
```

Build only the foundation and the CLI, never the root `npm run build`: Track 4 is editing
`cli/packages/module-check/` at the same time and builds it on its own.

## Surprises & Discoveries

- Ruling: Every line keeps the stream it had before — the summary of a failing run stays on stdout, and
  so does an error before the module ran — because consumer gates read the totals line off stdout
  whatever the exit code; this plan changes the framing, not the streams — cost if wrong: moving errors
  to stderr later is one line in `render.ts`.
- Ruling: A plain error line reads `error: <message>`, and the plain summary is the summary alone — the
  prefix tells a reader of a pipe that the run did not happen, and the summary's own text is the contract
  consumers grep — cost if wrong: an agent that matched clack's `■` glyph, which no test did.
- Ruling: Under `--ui` with `NO_COLOR` set, the rich layout is drawn without colour — the variable is
  about colour, and `--ui` is an explicit request for the layout — cost if wrong: one condition in
  `colourAllowed`.
- Ruling: The module's own `--help` section that listed the module's flags under the title `flags on every command:` is now titled `flags:`, and `flags on every command:` lists only `--ui` and `--no-ui` — two sections cannot share a title, and the module's flags are not on every command — cost if wrong: one string.
- Ruling: `--print` without `--json` keeps writing the summary to stderr by a raw `process.stderr.write` in `bin.ts`, since `out.result` only knows `json` — the document must not carry the summary, as before — cost if wrong: fold a `print` option into `out.result`.
- Ruling: the final `catch` re-extracts `--ui` from `process.argv` to build its `Out`, so a crash under `--ui` still draws rich — cost if wrong: none observable.

- Observation: The gate's escape-byte line (`… | cat -v | grep -c '\^\['`) printed nothing at all in this
  session's shell, for the implementer and for the caller alike, while the bytes held no escape.
  Evidence: `rtk proxy sh -c "cat -v <out> | grep -c '\^\['"` printed `0`, and a byte count over the same
  file gave `esc 0 frame 0`; the session's shell hook rewrites `cat`, and the rewritten form drops the count.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
