<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0007: `license-setup` never writes repo-scoped git config

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-31 |
| Deciders | Danilo Borges |

---

## Context

[Issue #12](https://github.com/entelekheia-ai/vibe-ops/issues/12) reported that `license-setup`'s Step 5,
at enforcement level `script`, instructed the agent to run `git config core.hooksPath .githooks` and add an
npm `"prepare": "git config core.hooksPath .githooks"` script so a fresh clone would re-wire the hook on
`npm install`.

`core.hooksPath` is repository-scoped and resolves relative to the worktree root regardless of which
directory the config was set from. In `dot-agent-spec`, an npm-workspaces monorepo, this meant an
`npm install` inside one package silently repointed git hooks for the **entire repository**, and the
tracked `apps/dot-agent-cli/.githooks/pre-commit` — written to look like it lived inside that package —
was never invoked once, because git only ever looked for `.githooks/` at the root. The failure was silent:
files were committed without headers and nothing errored. The config is also sticky — removing `prepare`
later does not unset `core.hooksPath` in a clone that already ran it.

Level `ci` compounded this by doing the hook wiring **and then** adding the CI workflow, making the hook
redundant at best for any repo that chose CI.

This is a reversal of a standing position: `project/plans/001-knowledge-lifecycle-retrofit.md` records that
this repo's own validator (`check-agents-md.sh`) chose CI over a git hook for exactly this class of failure
mode, and explicitly carved out `license-setup`'s pre-commit option as "a per-repository choice, not a
precedent for this." That carve-out is what this ADR revisits.

## Decision

**`license-setup` will never run `git config` or write an npm lifecycle script on the user's behalf.**

- **`script`** writes `scripts/ensure-license-headers.sh` and `.githooks/pre-commit` at the repository
  root — never from inside a workspace package — and then **prints** the one-line opt-in
  (`git config core.hooksPath .githooks`) for the user to run themselves. That same line is recorded in the
  target repo's `AGENTS.md` license-rules section, so a fresh clone finds it without having to ask.
- **`ci` means CI only.** No `.githooks/` is created at that level. `ci` becomes the default whenever the
  repo already has `.github/workflows/`, replacing the previous "script + CI" default — the two are now
  mutually exclusive choices, not an additive one.
- Nothing writes to `.git/config`. Wiring the hook is the maintainer's explicit, visible action, not a side
  effect of `npm install`.

## Options considered

- **Option A — keep `prepare`, unchanged.** Rejected: it is the mechanism that produced the defect. Sticky,
  repo-scoped, and silent on failure.
- **Option B — wire it automatically, but only from the repository root with a root-relative path** (what
  the issue's suggested fix describes literally). Rejected as the default: it removes the path-resolution
  bug but keeps the underlying objection — a package silently reconfiguring git for the whole repository is
  a side effect nobody installing a single workspace expects, independent of whether the path resolves
  correctly. `references/instruction-surfaces.md`'s enforcement ladder and this repo's own AGENTS.md rule
  ("a model-invocable skill must confirm before any irreversible step") both point the same direction.
- **Option C — drop `script` entirely, keep only `none`/`ci`.** Rejected: it removes local enforcement for
  every repo without CI, and the script's inject-on-commit behavior becomes permanently unreachable rather
  than opt-in.
- **Option D (chosen) — write the artifacts, print the opt-in, never configure.**

## Consequences

Easier: no package can ever again silently repoint git hooks for a monorepo it doesn't own. A `ci`-level
repo gets exactly one enforcement path instead of a redundant second one. The failure mode that took
`dot-agent-spec` an independent PR to find and fix cannot recur through this skill.

Harder: a fresh clone that wants the local hook must run one command by hand — the automatic re-wiring on
`npm install` is gone. This is an accepted, stated cost: `AGENTS.md`'s license-rules section is where that
command is recorded, so it is one read away rather than silent, and CI (when also enabled) does not depend
on it. A `script`-only repo (no CI) that nobody re-wires by hand gets no enforcement at all until someone
notices and runs the opt-in — the previous design's silent failure is traded for a silent no-op, which is a
smaller failure but not a zero one.

## Related

- [Issue #12](https://github.com/entelekheia-ai/vibe-ops/issues/12) — the report, including the
  `dot-agent-spec` incident and the `is_excluded` fix for the second defect (vendored/generated paths),
  which this ADR does not cover — that fix is uncontested and rides the CHANGELOG entry instead.
- [`skills/license-setup/SKILL.md`](../../skills/license-setup/SKILL.md) — Step 1 Q3 and Step 5, updated
  by this decision.
- `project/plans/001-knowledge-lifecycle-retrofit.md` (Decision Log, 2026-07-30 entry: "the validator runs
  in CI... `license-setup`'s pre-commit option remains a per-repository choice") — the prior position this
  ADR revisits.
- [`references/instruction-surfaces.md`](../../references/instruction-surfaces.md) — the general
  enforcement-ladder reasoning (hook / CI / type / lint) this decision draws on.
