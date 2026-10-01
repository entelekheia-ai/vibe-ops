---
vibe-ops-template: plan@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-041: The CLI grows a render layer

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-09-08 |
| Author | Danilo Borges |
| Pipeline | track-lead |

---

## Summary

`vibe-ops` writes to two audiences through one pipe, and today it serves neither well. An agent reading
the output of `vibe-ops check` receives twelve lines to be told nothing failed, two of which are prompt
framing characters the library emits into a pipe it cannot see. A person at a terminal receives the same
twelve lines, flat, with no shape to read them by. This plan puts a single render layer between the
modules and standard output: it decides once whether the reader is a terminal or a machine, gives the
terminal a compact report block, and gives the machine the findings and nothing else.

## Goals

1. A clean `vibe-ops check` run in a pipe prints one line — the totals — and no framing or escape bytes.
2. A clean `vibe-ops check` run at an interactive terminal prints a report block: counts by state, then
   each finding with its location.
3. `--ui` and `--no-ui` override the terminal detection in both directions, and `--json` outranks both.
4. Every module that already returns `{ findings, skipped }` gets the report block without changing a
   line of its own code, and a module that does not is unaffected.
5. `@clack/prompts` is reduced to the one thing that needs an interactive terminal: the confirmation
   before a destructive command.

## Scope

### In scope

The terminal surface in `cli/packages/cli/src/bin.ts`; the two new render modules beside it; the report
shape in `cli/packages/core/src/report.ts`; and which lines `cli/packages/module-check/src/index.ts`
passes through by default.

### Out of scope

**The shell runner is not touched.** `cli/packages/module-check/sh/` keeps emitting everything it emits
today; this plan changes only which of those lines the wrapper repeats. A gate that runs the shell half
directly, with no Node, behaves exactly as it does now.

**Collapsing repeated findings of the same check is not part of this plan.** A repository whose records
predate the current templates reports one warning per record, and on a large corpus that is the bulk of
the output — but those warnings are migration debt with a ceremony of its own (`/vibe-ops:migrate`), and
suppressing them in the renderer would hide a backlog rather than clear it.

**The nouns keep the output they have.** `config`, `ownership` and `records` return rows and answers
rather than findings, so they gain colour and nothing else. Giving them a report view is a separate
decision, taken when one of them has findings to report.

## Design

The CLI's output problem is that no single place decides how anything is printed. `bin.ts` reaches for
`@clack/prompts` in nine places, the modules write through an unformatted `sink`, and the hook surfaces
write JSON payloads directly. The result is an output that is half framed and half raw, with the framing
on the half that a machine reads.

So the design is one door. `cli/packages/cli/src/render.ts` owns the decision — is this a terminal or a
machine — and exposes the writers everything human-facing goes through: `out.help()`, `out.error()`,
`out.summary()`, `out.result()`. Nothing else in the CLI decides about colour, framing or width. The
detection is a single predicate: an explicit `--ui` forces rich, and otherwise rich requires an
interactive stdout with no `--no-ui`, no `CI` and no `NO_COLOR`. Colour comes from Node's own
`util.styleText`, applied only once `render` has already chosen rich, so the layer adds no dependency and
no second place decides whether colour is wanted.

`out.result()` is where the two audiences separate:

```mermaid
flowchart TD
    R["ModuleResult { code, summary, data }"] --> J{"--json?"}
    J -->|yes| P["JSON on stdout, summary on stderr"]
    J -->|no| T{"rich?"}
    T -->|no| L["summary as one line"]
    T -->|yes| S{"isReport(data)?"}
    S -->|no| L
    S -->|yes| B["report block"]
```

`isReport()`, `readReport()` and the `Report` type live in `cli/packages/core/src/report.ts` because the
core is what already produces the shape: `runOps` in `cli/packages/core/src/ops.ts` returns
`{ findings, skipped, repaired, population }`, and `check` returns `findings` and `skipped` alongside its
own fields. The two name an entry's origin differently — `gate` in the ops, `check` once `check` has
merged them — so `readReport()` accepts either and normalises both to `id`, and the report view never
learns which producer it is drawing. The type is therefore a recognition of what exists rather than a
form modules must be migrated onto, which is why goal 4 costs no module edits. A module joins by returning the shape;
a module that returns something else falls through to the summary line and is not broken by the
addition.

`cli/packages/cli/src/report-view.ts` draws the block from a `Report` and is reached from nowhere
else. Keeping it separate from `render.ts` is what lets the block be reworked visually without touching
the surface that decides plain-versus-rich — the two change for different reasons and at different rates.

Two constraints bound the whole design. The first is that the hook surfaces —
`cli/packages/cli/src/hook.ts` and the `plan-*.ts`, `task-guard.ts`, `new-context.ts` and
`prefer-mcp.ts` modules beside it — write JSON payloads that another program parses, and they do not go
through `render`. That is not an omission to fix later; it is the boundary that keeps a colour code out
of a payload. The second is the line `N checks, M failed`. Consumer repositories grep that exact shape
from their own commit hooks to notice a composition that stopped composing, so the renderer may restyle
everything around it and must leave its text alone.

The default plain output narrows at the same time. `module-check` currently repeats any line beginning
with `composed` or two spaces, which passes through the composition preamble and its per-fragment source
listing on every invocation. Those move behind `--verbose`, where the rest of the run's detail already
lives. `FAIL` and `WARN` continue to print unconditionally, because a finding is what the caller asked
for; `SKIP`, like `ok`, stays behind `--verbose`, where it already is.

## Tracks

- [x] **Track 1 — The report contract.** `cli/packages/core/src/report.ts` gains the `Report` type, an
      `isReport()` guard and the `readReport()` normaliser, exported from the core's index, describing
      the shape `runOps` and `check` already return. Nothing consumes it yet. At the end, a type exists
      that both producers satisfy and a test proves the nouns' payloads do not, so the guard cannot
      silently widen. Task: tasks/012-the-report-contract.md

- [x] **Track 2 — The render layer, and the framing leaves the pipe.** `cli/packages/cli/src/render.ts`
      is written and the nine `@clack/prompts` call sites in `cli/packages/cli/src/bin.ts` move onto it,
      leaving `p.confirm` and its cancellation as the only clack usage. `--ui` and `--no-ui` are
      introduced as CLI-level flags, extracted from the argument list before the module's own strict
      parse and listed in `--help` under a section of their own. At the end, `vibe-ops check` piped into
      anything contains no escape bytes and no framing characters, and the orphaned `│` that a run with
      no `p.intro` emits today is gone. Task: tasks/013-the-render-layer.md

- [x] **Track 3 — The report block.** `cli/packages/cli/src/report-view.ts` draws counts by state
      followed by each finding with its location, and `out.result()` routes to it. At the end, a run at
      an interactive terminal shows the block, the same run piped shows the summary line, and `--json`
      shows neither. Task: tasks/014-the-report-block.md

- [x] **Track 4 — The plain default narrows.** The passthrough filter in
      `cli/packages/module-check/src/index.ts` stops repeating the composition preamble and its indented
      source lines, which move behind `--verbose`. At the end, a repository with no findings reports one
      line, and `--verbose` reports everything it reports today. Task: tasks/015-the-plain-default-narrows.md

- [x] **Track 5 — A rich run says it is running, styles its verbose lines, and names what it read.**
      Added after the first four landed, from the maintainer running them at a terminal. A rich run
      prints a status line on stderr while the module works and erases it before anything else is
      drawn; the lines a `--verbose` run prints are styled by the shapes runner and ops share (`ok`,
      `FAIL`, `WARN`, `SKIP`, the `[id]`, the composition preamble); and the block's title reads as a
      sentence naming the anchor of the analysis — the repository when it was one, the folder when it
      was not. In rich mode a module's warnings are held with its lines and keep their order and their
      stream. At the end, a pipe sees none of it. Task: tasks/016-a-rich-run-says-it-is-running.md

- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the tracking
      issue closed. The plan file itself is kept.

## Success criteria

Each command is run from a repository's own root, with no flags beyond the ones shown — what an ordinary
invocation reports, not what a specially configured one reports.

- `vibe-ops check 2>&1 | grep -c '│\|◆'` prints `0`. No framing character survives a pipe. Measured at
  `2` before this plan, which is the orphaned frame and the summary bullet.
- `vibe-ops check 2>&1 | cat -v | grep -c '\^\['` prints `0`. No colour survives a pipe either. This one
  already passes today and is a regression guard: the render layer is what makes it possible to fail.
- On a repository whose run has no findings, `vibe-ops check 2>&1 | wc -l` prints `1`, and that line
  matches `^[0-9]+ checks, [0-9]+ failed`.
- `vibe-ops check --verbose 2>&1 | grep -c '^composed'` is at least `1`. The preamble moved rather than
  disappeared.
- `vibe-ops check`, `vibe-ops check --verbose` and `vibe-ops check --audit`, each piped through
  `grep -cE '^[0-9]+ checks, [0-9]+ failed'`, print `1`. Consumer gates run the `--verbose` form, and a
  line that appears twice is read as two answers.
- `vibe-ops check --json | jq -e '.findings' >/dev/null` exits `0`. The payload is still a stream `jq`
  reads.
- `npm test` passes, including the three tests the tracks add: that a non-terminal run emits no framing
  and no escapes, that a finding-free run prints one line while `--verbose` prints the preamble, and that
  `isReport()` accepts both producers' payloads and rejects a noun's.
- `grep -o 'p\.[a-zA-Z.]*(' cli/packages/cli/src/bin.ts | sort -u` lists only `p.cancel`, `p.confirm` and
  `p.isCancel` — the confirmation and its cancellation. Measured before this plan, the same command also
  lists `p.note`, `p.log.error` and `p.log.success`.

---

## Decision Log

- Decision: The rich block renders from a module's structured `data`, recognised by a shape the core
  declares, rather than from a per-module renderer or a special case for `check`.
  Rationale: `check` and every ops already return `{ findings, skipped }`; recognising that shape gives
  six commands the block for no per-module work, while a `render?()` hook on the module definition would
  turn the CLI's appearance into as many decisions as there are modules and make every module import the
  render layer.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: The rich block is chosen by terminal detection, with `--ui` and `--no-ui` as explicit
  overrides in both directions, and `--json` outranking both.
  Rationale: The reader that must not be disturbed is the one that cannot ask — a hook, a commit gate,
  continuous integration, a pipe. All four are non-interactive, so detection separates the audiences
  without anyone typing anything. The overrides exist because a terminal can be wrong about itself, and
  `--json` outranks because a caller who named a machine format has stated the contract explicitly.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: `@clack/prompts` is kept for the destructive-command confirmation and dropped everywhere
  else.
  Rationale: Its framing is written unconditionally, including into a pipe, which is how a lone `│` came
  to precede the summary of every run — the library assumes an interactive session and the CLI is mostly
  not one. The confirmation is the one place that genuinely requires interactivity, and rewriting it by
  hand would buy nothing.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: The line `N checks, M failed` keeps its exact text.
  Rationale: Consumer repositories grep that shape from their commit hooks, and a repository whose gate
  silently stopped reporting still exits zero. Restyling it would blank that signal everywhere at once,
  which is the failure mode the line was given a fixed shape to prevent.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: How the work is carried out — what may go to a subagent, on which model, and what may not.
  Rationale: The render layer and the report view decide what a reader sees and how it looks, and that
  judgement has to agree with this plan's intent; a subagent does not hold the plan and returns something
  plausible that drifts. They stay with the author, as does the report contract in Track 1, since a type
  that widens by accident defeats the guard it exists to be. The mechanical remainder is delegable under
  a closed contract: the call-site substitutions in `bin.ts`, the filter change in `module-check`, and
  the three tests each go to a subagent on `sonnet` at `medium` effort behind `npm test` as the gate,
  escalating to `opus` at `xhigh` only if the gate fails. The adversarial review of the finished diff
  runs on `sonnet` at `high`; it moves to `opus` at `high` if the diff turns out to touch the totals
  line, which is the one output other repositories depend on.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: Colour comes from `util.styleText`, not `picocolors`.
  Rationale: `picocolors` is not in this repository's dependency tree — the design assumed a transitive
  copy that does not exist — and `render` already decides rich before any colour is applied, so a
  library's own `NO_COLOR` detection would be a second decider behind the first. The engines floor
  (`>=22.18`) already carries `styleText`.
  Date / Author: 2026-09-30 / ruled during the run of this plan (Claude)

- Decision: The report contract normalises an entry's origin to `id`, accepting `gate` or `check`.
  Rationale: The two producers share field names and not entry keys — `OpsFinding` carries `gate`, and
  `check` re-keys to `check` when it merges the ops' findings — so a guard over one spelling sends the
  other producer to the summary line, which is the narrowing the guard's test exists to prevent.
  Date / Author: 2026-09-30 / ruled during the run of this plan (Claude)

- Decision: `SKIP` stays behind `--verbose` in the plain default, as it is today.
  Rationale: The Design first said `SKIP` prints unconditionally, which is not the present behaviour —
  measured, a default run prints no `SKIP` line and `--verbose` prints eleven — and the module contract
  already keeps `SKIP` with `ok` under `--verbose`. Printing it would make goal 1 unreachable in any
  repository that declares a disablement.
  Date / Author: 2026-09-30 / ruled during the run of this plan (Claude)

- Decision: A delegated track runs on the model its agent definition fixes, and the brief names none.
  Rationale: The delegation entry above named per-call models; the implementer and reviewer definitions
  the run dispatches each fix their own, and a model passed on the call replaces the definition's, so a
  per-call model is kept for escalation after a failed gate. The adversarial review therefore runs on the
  reviewer definition's model rather than the `sonnet` at `high` written above.
  Date / Author: 2026-09-30 / ruled during the run of this plan (Claude)

- Decision: In rich mode the CLI holds a module's own lines back, and a drawn report block stands in for
  them.
  Rationale: `check` writes its findings through the module sink as it runs and returns the same findings
  in `data`, so a block drawn after them repeats every finding. Holding the lines only when the output is
  rich, and never under `--json`, `--print` or plain, leaves every stream a machine reads exactly as it
  was; `--verbose` and `--list` still print the held lines, because they asked for the whole run.
  Date / Author: 2026-09-30 / ruled during the run of this plan (Claude)

- Decision: A rich run shows a static status line while it works, not an animated spinner.
  Rationale: `check` runs its shell half through `spawnSync`, which blocks the event loop, so a spinner
  would freeze exactly where the wait is longest. Animating it means making that spawn asynchronous in
  the module whose totals line is a contract, which is a larger change than the feedback asks for.
  Date / Author: 2026-09-30 / Danilo Borges

- Decision: The block's title is a sentence — `result of <what ran> – <anchor>` — where the anchor is
  what the module analysed: the repository, named as the repository even from a linked working tree,
  or the folder when it was not one.
  Rationale: The title named the working tree's directory, which reads as a stray word beside the
  command; the reader wants to know what was examined.
  Date / Author: 2026-09-30 / Danilo Borges

- Decision: Track 5 runs through a track lead — its own worktree, red tests, implementer, reviewer and
  triage — rather than in the main loop.
  Rationale: The maintainer asked for the reviews to run with it; the lead owns them end to end, and the
  output a machine reads is frozen in the contract commit it starts from.
  Date / Author: 2026-09-30 / Danilo Borges

## Outcomes & Retrospective

**2026-09-30 — all four tracks landed on the plan's branch, unmerged.** Goals 1, 3, 4 and 5 are met as
the success criteria phrase them: a piped `check` carries no framing and no escape byte, the totals line
prints once in the default run, `--verbose` and `--audit`, `--ui`/`--no-ui` work anywhere before `--`,
and `bin.ts` keeps `@clack/prompts` for the confirmation alone. Goal 2 is met at a real pseudo-terminal
for `check` and for an ops. The full suite passes (772 of 772) with `VIBE_OPS_DENYLIST` unset; with it
set, two tests outside this plan fail for the reason recorded in Track 4's dossier.

What the design did not foresee cost three rounds of review. The success criteria measured only the
default run, and the consumer gates run `--verbose`, where the two tracks together printed the totals
twice. And the report block met output it had not been designed against: module lines held back in rich
mode were lost on a throw, on SIGINT, and whenever they were not findings, and `check` joins its lines
into one entry per half. Each was a BLOCKER or SHOULD-FIX found by an independent review and fixed on
the branch; the rulings that narrowed the holding decision twice are in Track 3's dossier.

**2026-09-30 — Track 5, and the branch-wide review.** The maintainer ran Tracks 1–4 at a terminal and
asked for a sign of life while a run works, for `--verbose` to follow the rich/plain decision, and for a
title naming what was analysed; Track 5 delivered all three in the track-lead pipeline, over two contract
commits, with the machine-read output compared per case against the contract (45 invocations, no
difference). A final review over the whole branch found every success criterion holding and no
unannounced byte changed in plain, `--json` or `--print` output, and one defect only the combination of
tracks produced: a Ctrl-C during a synchronous child was lost in a rich run. It is fixed with a test that
fails without the fix. The full suite passes, 812 of 812, with `VIBE_OPS_DENYLIST` unset.

---

## Open questions

*None. The design questions were settled before this file was written; what remains is the work.*

- Task dossiers closed and removed per the task lifecycle (`Planned → In Progress → Done → file removed, git history is the archive`):
  - `git show debd8b955dada9abd8c0cd252251f4bbd2f92c29:project/tasks/012-the-report-contract.md`
  - `git show debd8b955dada9abd8c0cd252251f4bbd2f92c29:project/tasks/013-the-render-layer.md`
  - `git show debd8b955dada9abd8c0cd252251f4bbd2f92c29:project/tasks/014-the-report-block.md`
  - `git show debd8b955dada9abd8c0cd252251f4bbd2f92c29:project/tasks/015-the-plain-default-narrows.md`
  - `git show debd8b955dada9abd8c0cd252251f4bbd2f92c29:project/tasks/016-a-rich-run-says-it-is-running.md`
