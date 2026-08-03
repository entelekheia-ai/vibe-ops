<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0009: Hooks are a third delivery surface, admitted only for state or timing

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-03 |
| Deciders | Danilo Borges |

---

## Context

Until now this plugin delivered instructions two ways, and [ADR-0004](0004-budgeted-artifacts-and-guards.md)
sorted them: anything mechanically checkable becomes a **guard** in CI, everything else is a **line** in an
instruction file, and a line a new guard makes redundant is deleted.

That taxonomy has a gap, found by measurement rather than argument
([`positioned-context-and-hooks.md`](../research/positioned-context-and-hooks.md)). A corpus of 40 plans
written in plan mode shows the descriptive half of this plugin's plan format appearing on its own —
a context section in 100%, a verification section in 93% — and the governance half appearing **never**:
no metadata table, no goals, and none of the four living sections, in any of the forty. The format was
available the whole time. It was in a template the model could read and in a rule the repository loads.
It was not present *at the moment the plan was written*, and that is the only difference that mattered.

Neither existing surface can close that gap. A line cannot choose when it arrives. A CI guard runs after
the artifact exists, which for a plan-mode plan is after the only moment worth influencing. And some of
what the instruction needs to carry — the next record number, whether `gh` is authenticated, whether a
dossier's closure box is ticked — is state on disk that no static text can know.

Everything a hook buys is also paid for by every repository the plugin is installed in, because hooks are
the plugin's only always-on surface. That is the cost this decision is really about.

## Decision

We will admit **hooks as a third delivery surface**, and a hook earns its place only by delivering
something the other two cannot: **state read from disk at that instant**, or **context placed at a moment
an instruction file cannot reach**. A hook that only restates a line is rejected, whatever it costs.

Every hook this plugin ships must additionally:

1. **Exit on its own condition as its first act**, before doing any work — a permission-mode comparison, a
   substring test on the payload. A hook that is silent in the common case costs a process spawn.
2. **Never be the only implementation of anything.** Where a hook and a skill do the same job, the skill
   calls a script and the hook calls the same script. `UserPromptExpansion` fires only on a typed command,
   so a hook-only design silently does nothing exactly when the user asks in plain language.
3. **Fail closed, or fail silent — never fail open while appearing to work.** A guard whose payload
   parsing returns nothing must be indistinguishable from a guard that did not apply.
4. **Be exercised before the release that ships it**, with `claude --plugin-dir <this tree>`.

## Options considered

- **Option A — keep two surfaces, write the instruction more firmly.** Cheapest, and refuted by the
  corpus: the instruction was already present in two places and produced the governance half zero times
  out of forty.
- **Option B — a session-start injection instead of a per-turn one.** Rejected on measurement: the
  `SessionStart` payload carries no permission mode, so at session start nothing knows whether the session
  will ever plan anything. It would pay context in every repository to serve a small fraction of turns.
- **Option C (chosen) — admit hooks, bounded by what only they can do.** Accepts an always-on surface in
  exchange for the two capabilities the other surfaces lack, and bounds it with the four obligations
  above.
- **Option D — hooks with no stated bound.** Rejected: without a test for admission, "a hook would be
  convenient here" becomes the argument, and the plugin's cost in every repository grows with no ceiling.

## Consequences

**Easier.** A plan written in plan mode can arrive in this plugin's format, carrying the real next number
instead of a guessed one. A task dossier cannot be deleted with its learnings inside it, because the
refusal fires at the deletion rather than being written down near it. Obligation 2 pushed the shared logic
into `scripts/resolve-governance.sh`, which then removed four copies of the discovery cascade and let the
plan-mode hook shed its own duplicate.

**Harder.** The plugin now costs something in every repository where it is installed, including
repositories that never adopted any of these conventions — that is what "always-on" means and it does not
have an off switch short of uninstalling. Hooks load at session start, so a change needs a restart rather
than a re-run, which makes them the slowest thing here to iterate on. And a hook is invisible when it
works, so a broken one is discovered by the absence of an effect nobody was watching for.

**Accepted cost.** The bound in this ADR is a judgement, not a check. Nothing mechanically prevents adding
a hook that merely repeats a line; the reviewer applying this ADR is the enforcement.

## Related

- [ADR-0004](0004-budgeted-artifacts-and-guards.md) — the guard-versus-line rule this extends.
- [`project/research/positioned-context-and-hooks.md`](../research/positioned-context-and-hooks.md) —
  the measurements, and what in them is still unmeasured.
- [Plan-005](../plans/005-collapse-record-skills-and-make-closure-run.md) — the work that applied it.
