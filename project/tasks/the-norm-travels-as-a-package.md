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

# Task: One artifact, one governance package

> Rewritten 2026-08-22. This dossier previously planned Plan-030 Track 3 (one `governance-policies`
> package for the five types); the maintainer superseded that architecture mid-execution and the file
> now serves [Plan-033](../plans/033-one-artifact-one-governance.md). The filename is kept — a dossier
> is deleted only through `task close`.

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/033-one-artifact-one-governance.md](../plans/033-one-artifact-one-governance.md) |

---

## Context

The design, its rationale and the decisions are in Plan-033 and ADR-0019 — not restated here. This
dossier carries the execution order, the measured facts the steps depend on, and what each step proves.

Facts measured before the work, which the steps below rely on:

- **Build order hazard:** npm workspaces build in directory order. `gates` and `governance-adr` sort
  before `governance-base`, and both import it statically — so `governance-base` must build in the
  `build:foundation` pass, like `core`. `cli` imports `harness` statically (`harness-status.ts`).
- **`records/src` splits cleanly by coupled template:** `plan-fields.ts`+`plan-file.ts`+
  `plan-lifecycle.ts`+`status.ts` → plan; `close.ts`+`closure.ts` → task; `log.ts` → log; the other
  sixteen files name no particular template and stay in the base.
- **The ops entries are pure data** — zero functions; fixtures are string maps. Nothing here blocks the
  future ops-as-JSON plan.
- **`expandTemplateToken`'s candidate list ends at the plugin dir**, which is how THIS repository's own
  `template-version` entries resolve today. The moment `plugin/templates/` empties, that expansion must
  consult the activated governance packages or the repository's own governance run breaks — the
  byte-identical acceptance depends on this edit landing with the move.
- **A scaffolded package needs its first source file in the same commit**: `cli/packages/*` is the
  workspace glob and an empty `src/` breaks `npm run build` (learned on the dropped first cut).
- **Baselines captured** before any change: `gov-before.txt` and `self-before.txt` (session scratchpad;
  re-capture with `node cli/packages/cli/dist/bin.js governance . --verbose` on a clean tree if lost).

## Implementation order

- [x] Step 0 — reset: the `governance-policies` commit dropped, tree restored.
- [x] Step 1 — records first: Plan-033, ADR-0019 (supersedes ADR-0018), Plan-030 tracks 3–6 marked
      superseded, this dossier rewritten.
- [ ] Step 2 — `records` → `governance-base`, imports updated, `defineGovernance` added, foundation
      order fixed. Clean build + tests green.
- [ ] Step 3 — five `governance-<t>` packages; data moved out of `plugin/` (templates, authoring,
      migrations split per type, `type.json` re-rooted); ownership fragments split; aggregate-index
      machinery (index.json, `type-index.ts`, generator, `type-index-drift` gate + `ops-self` entry)
      deleted. `self .` differs from baseline only by the deleted gate line.
- [ ] Step 4 — the collapse: plan/task/log sources + module verbs into their governances;
      `module-plan`/`module-task`/`module-log` deleted; CLI routes bare nouns through the effective
      map (shipped defaults ⊕ `config.types`). Noun regression against this repository.
- [ ] Step 5 — `module-harness` → `harness`; base ownership fragment; `sync`/`status` compose from the
      activated governances.
- [ ] Step 6 — facet resolution threaded (`resolveTypeUnit`, one `migrationsDir`,
      `expandTemplateToken`); `records norm --type <t> --facet … [--print]` with tests. npm-only
      acceptance: pack + install into an empty repo, no plugin, `CLAUDE_PLUGIN_ROOT` unset.
- [ ] Step 7 — skills (`migrate`, `new`, `new-log`, `new-migration`) read/write via the CLI; checks
      35/55/80 retargeted; `cli/AGENTS.md`, `plugin/AGENTS.md`, `README.md`, `CHANGELOG.md`.
      `governance .` byte-identical to baseline; 17 shell checks green.

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
