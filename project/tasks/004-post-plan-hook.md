<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: A `PostToolUse` hook on `ExitPlanMode` — copy the approved plan to its right home, and say so

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-08-03 |
| Author | Danilo Borges |
| Issue | pending |

<!-- Status lifecycle: Planned → In Progress → Done → (dossier removed; git history is the archive) -->

---

## Context

`plan-mode-context.sh` already places the right plan format at the moment a plan-mode plan is written, but
the plan itself lands under `~/.claude/plans/<slug>.md` and stays there unless the user separately asks for
`/vibe-ops:new plan`. Requested: a hook that copies an approved plan-mode plan into its repository's
`project/plans/` and tells the model it moved.

**Shipped:** `hooks/plan-approved-copy.sh`, registered `PostToolUse` matching `ExitPlanMode`;
`scripts/test-plan-approved-copy.sh` (12 assertions, structural — exercises the hook's own logic against
the documented payload shape); the `| Repository |` row added to both plan templates and
`references/records/plan.md`, requested by `plan-mode-context.sh` only when there is real ambiguity to
resolve; `hooks.json` updated (registration + accurate "Six guards" count). One honest residual gap: no
CLI automation can deliver a real `ExitPlanMode` approval (see Surprises), so this ships verified at the
script level against the documented contract, not against one live interactive approval — a cheap,
optional smoke test the maintainer can run at their own pace, not a blocker.

**Step 1 gates everything else in this task.** Verified from this session's own transcript:
`ExitPlanMode`'s tool input is `{plan, planFilePath}` (`planFilePath` absolute, under `~/.claude/plans/`),
and the result is distinguishable — a JSON object `{"plan": …}` on approval, a string beginning `Error: …`
on rejection or "stay in plan mode, here are comments". **Not yet verified:** whether `PostToolUse` fires
for `ExitPlanMode` at all, and what its `tool_response` shape is. If it does not fire, this task's design
is wrong and the finding gets reported rather than worked around.

Also verified: one `planFilePath` serves a whole session, not one plan. In this very session the same file
`entao-monta-um-plano-delightful-patterson.md` was approved twice — once as what became Plan-005, once as
Plan-006. A per-session marker keyed to the source path would wrongly suppress the second copy; idempotence
must key on the **target** path instead.

Full design: `/Users/danilo/.claude/plans/entao-monta-um-plano-delightful-patterson.md`, Task 004.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Measure: does `PostToolUse` fire for `ExitPlanMode`, and what's in `tool_response` | S |
| 2 | P0 | Cheap-exit gate: approval + H1 + metadata table with a `Status` row | S |
| 3 | P0 | `| Repository | … |` row in plan templates + `references/records/plan.md`, requested by `plan-mode-context.sh` | M |
| 4 | P0 | Copy (never move/overwrite) to `$DIR/$NEXT-<slug>.md`, idempotent on target | M |
| 5 | P0 | `additionalContext` telling the model what happened and where to edit next | S |
| 6 | P0 | Fix the now-false sentence in `plan-mode-context.sh` | S |
| 7 | P1 | Register in `hooks.json`, update its "Five guards" description count | S |

### 1. Measure first — P0 — resolved via documentation, not a live session

**What:** A throwaway probe hook on `PostToolUse` matching `ExitPlanMode`, run via
`claude --plugin-dir .` the way Plan-006 Track 0 measured `block` vs `additionalContext`. Dump the raw
payload.
**Why:** Nothing past this point can be designed correctly without knowing whether the event fires at all,
whether it fires on rejection too, and the exact shape of `tool_response`.
**Change:** Attempted headlessly first (`claude -p --permission-mode plan`, both text and
`--input-format/--output-format stream-json`) and found this cannot be measured by CLI automation at
all — `ExitPlanMode` does not exist as a callable tool in headless mode, by design (see Surprises). That
looked like a hard block on the whole task. A documentation research pass resolved it instead: the
maintainer's own hint ("olha na documentação") pointed at the right question, and two research passes
against `docs.claude.com/en/docs/claude-code/hooks` found the headless failure was specific to headless
mode (no `PreToolUse` force-allow means the tool call never resolves, so `PostToolUse` has nothing to
fire on) and does not apply to ordinary interactive sessions, where the docs state directly:
*"In `PostToolUse`, `tool_response` is an object with `plan` and `filePath` fields holding the approved
plan."* A rejection produces no `PostToolUse` firing at all (`PostToolUseFailure` and `PermissionDenied`
both explicitly exclude manual denial) — so the hook needs no outcome branching: firing at all already
means approved. Design proceeded from this, at high confidence per direct doc citations rather than
inference.

### 2. Cheap-exit gate — P0

**What:** Approval only, and only when the approved plan text has an H1 and a metadata table with a
`Status` row.
**Why:** ADR-0009 obligation 1 (exit on the cheap condition first); `plan-mode-context.sh` already tells
the model to use the table only *"if this planning turn is going to produce a durable design record rather
than a one-off change"* — a throwaway plan has no table and is never copied.
**Change:** Shipped as designed — `grep -qE '^# '` then a `| Status |` row test on `tool_response.plan`
before any filesystem or resolver call. Verified: `test-plan-approved-copy.sh` cases "no H1: silent" and
"no Status row: silent".

### 3. Repository row — P0

**What:** Optional `| Repository | … |` row, same shape as the existing `Depends on` row (*"remove this
row unless…"*).
**Why:** Resolving from `cwd`'s git toplevel is wrong from an umbrella workspace root — already observed
twice this session: `plan-mode-context.sh` reported `012` (the umbrella's next number) for a plan that
became `vibe-ops`'s `005`.
**Change:** Shipped as designed, with one refinement: `plan-mode-context.sh` requests the row only when
its own resolved git toplevel differs from `$CLAUDE_PROJECT_DIR` — real ambiguity, not every planning
turn — so a single-repo session never sees the extra sentence. Row format specified as a bare absolute
path, nothing else in the cell (existing plans in this session wrote it as prose; that predates this
hook and is not itself parsed). Fallback to `git -C "$CWD" rev-parse --show-toplevel` when the row is
absent. Verified: `test-plan-approved-copy.sh` case "Repository row: filed into the named repo, not the
umbrella cwd".

### 4. Copy, idempotent on target — P0

**What:** Re-run the resolver **inside the resolved repo**, target `$DIR/$NEXT-<slug>.md` (slug from the
H1). Copy, never move — the source under `~/.claude/plans/` is Claude Code's own and the tool result
already tells the model it can refer back to it. If the target exists, do nothing and say so.
**Why:** One `planFilePath` serves a whole session and can be approved more than once (observed this
session); keying idempotence on the source would wrongly suppress the second, legitimately different plan.
**Change:** Shipped as designed. One correction found while writing the test suite: because `NEXT` is
always freshly resolved as one past the highest existing numbered file, `TARGET` can never coincide with
an existing file on a normal single firing — the `[ -f "$TARGET" ]` guard is real defensive code (insurance
against a genuine duplicate hook delivery or registration) but is structurally unreachable through the
honest single-invocation flow, so it is not what protects the "approved twice" scenario. That scenario is
protected for free by fresh `NEXT` resolution instead — verified directly:
`test-plan-approved-copy.sh` "two approvals from one source get two different targets, neither
overwritten".

### 5. additionalContext — P0

**What:** Tell the model: which repository was resolved and how (declared row vs. git toplevel), the exact
target path, that the record is now the copy — edits go there, not to `~/.claude/plans/` — that the number
in the metadata table may need correcting to the real one, and that the slug is a guess.
**Why:** This is the "avisar da movimentação" half of the request, and it is what makes a wrong guess
cheap to correct rather than silently misleading.
**Change:** Shipped as designed, built via `jq -nc` (not hand-escaped `printf`) since plan text is
untrusted multi-line prose — the same reasoning that made jq non-optional for parsing `tool_response.plan`
in the first place. Verified: the message's exact target path, repo, resolution method, and (when
applicable) the stale-number note, checked directly in the test suite's assertions.

### 6. Fix the contradiction — P0

**What:** `plan-mode-context.sh` currently ends *"saving it into `$PLAN_DIR` happens only if the user asks,
through `/vibe-ops:new plan`."*
**Why:** After this hook ships, that sentence is false — two hooks would contradict each other in the same
session.
**Change:** Shipped — replaced with a sentence stating the automatic copy and narrowing `/vibe-ops:new
plan`'s remaining purpose to a plan written outside plan mode, or an older plan-mode file this hook never
saw.

### 7. Registration — P1

**What:** Add to `hooks.json`, fix its description's literal hook count.
**Why:** Same drift Task 002 item 2 already flags.
**Change:** Shipped — registered under `PostToolUse` with `matcher: "ExitPlanMode"`; description's leading
word corrected `Five` → `Six`. `scripts/checks/25-hooks-registration.sh` (Task 002's own guard) confirms
the count is accurate, and confirms the new script is both registered and exists — a real, if incidental,
cross-task verification.

## Implementation order

```
P0:  1 (gates everything else), 2, 3, 4, 5, 6
P1:  7
```

## Surprises & Discoveries

- Observation: `ExitPlanMode` is unavailable to `claude -p` (headless/print mode) entirely — not merely
  auto-rejected or auto-approved, but absent from the tool registry. The model itself discovers this by
  trying and reports back: *"ExitPlanMode is disabled for this session, in subagents as well as here."*
  This holds under plain text I/O and under `--input-format stream-json --output-format stream-json`
  alike — the SDK-style streaming mode that programmatic multi-turn drivers use does not change it.
  Evidence: `/tmp/probe-stream.jsonl` (this run's own transcript) —
  `{"type":"tool_result","content":"<tool_use_error>Error: No such tool available: ExitPlanMode.
  ExitPlanMode is disabled for this session, in subagents as well as here.</tool_use_error>..."}`.
  Two live API calls made (~$0.31 total), one text-mode and one stream-json-mode, both conclusive.
  This makes architectural sense in hindsight: `ExitPlanMode`'s only function is requesting human
  approval, which has no meaning where no human can respond — but it was not obvious in advance that the
  tool would be *absent* rather than, say, auto-approved for a scripted flow (which is genuinely
  ambiguous the way `--dangerously-skip-permissions` reads).
  Why it matters for this task: no amount of additional CLI scripting can close Step 1 by itself — but see
  the next entry, which closed it a different way.
  **Routed:** true in any repository (headless Claude Code sessions cannot deliver `ExitPlanMode`, and no
  amount of scripting substitutes for reading the docs when a live test is unavailable) — the maintainer's
  own practice, not vibe-ops's knowledge. Not duplicated here.

- Observation: The headless dead-end was resolved by reading the actual hooks documentation, not by a
  live session — `docs.claude.com/en/docs/claude-code/hooks` states directly that `PostToolUse`'s
  `tool_response` carries `{plan, filePath}` on an approved `ExitPlanMode`, and that manual denial never
  fires `PostToolUse`, `PostToolUseFailure`, or `PermissionDenied`. A second, separate finding worth
  keeping: `PermissionRequest` matching `ExitPlanMode` — the mechanism a first research pass proposed as
  *the* documented answer — is a *decide-now* hook (the docs' own example uses it to auto-approve,
  bypassing the human prompt), not an outcome notifier; it was the wrong tool for "react after a human's
  real decision," and `PostToolUse` was the right one all along.
  Evidence: two research agent passes, both citing `docs.claude.com/en/docs/claude-code/hooks` directly
  (the `ExitPlanMode` tool-input section, the `PostToolUseFailure` and `PermissionDenied` exclusion
  clauses, the `PreToolUse → PermissionRequest → PostToolUse` ordering).
  **Routed:** true in any repository (when a live test is structurally unavailable, the documentation is
  the next-best source of truth, checked directly rather than inferred from a single example) — the
  maintainer's own practice. The repo-specific residue is not prose to promote; it is already the hook's
  own header comment in `hooks/plan-approved-copy.sh`, which cites the same two doc sections this entry
  does.

## Closure

- [x] Run `/vibe-ops:close task` — do not just delete this file.
