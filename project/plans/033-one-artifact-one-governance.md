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

# Plan-033: One artifact, one governance package

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-22 |
| Author | Danilo Borges |
| Supersedes | [Plan-030](030-the-type-unit-and-the-compositions-derived-from-it.md) Tracks 3–6 |
| Related | [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) · [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md) |

---

## Summary

A course correction made mid-execution of Plan-030 Track 3, and larger than that track: the norm does
not travel as **one** npm package, and the modules serving each record type do not stay separate from
the data they serve. **One artifact gets one governance package** — `governance-{adr,rfc,plan,task,log}`
— each self-contained: the type's manifest, template, authoring rules, migration notes, an ownership
fragment covering its artifact, and the TypeScript coupled to its format. The CLI is sliced into layers:
the CLI base, a reusable **governance-base** whose primitives are *sugared* per type so equal behaviour
is written once, and the governances on top. Discovery and activation are the repository's
`vibeops.config` — the config is the registry, and the CLI routes by it.

The end-state this builds toward: **vibe-ops manages the modules and lets the Claude plugin work
dynamically — a proxy between the plugin and the modular governance.**

## Goals

- Five governance packages, each the sole home of its artifact's data and coupled code; a sixth
  (`dot-agent`'s freeze-status) can arrive later with no edit here.
- `module-plan`, `module-task`, `module-log` collapse into their governances — no parallel module and
  data package for one artifact.
- A base package (`governance-base`, ex `records`) whose `defineGovernance` sugar makes a
  behaviour-equal governance a one-liner (`governance-adr`, `governance-rfc`).
- The harness, which has no governance, is internalized as a CLI package (`@entelekheia/vibe-ops-harness`).
- Activation via `config.types` overlaying shipped defaults; the CLI routes nouns and resolves facets
  through that map. `CLAUDE_PLUGIN_ROOT` becomes a legacy pin, not the primary source.
- An npm-only install (no Claude plugin, `CLAUDE_PLUGIN_ROOT` unset) resolves every shipped type.

## Scope

### In scope

The five packages and the data moves; the base layer and its sugar; the module collapse; harness
internalization; config-driven routing and facet resolution; the `records norm` verb the plugin skills
call; the shell checks and skills that named the old paths.

### Out of scope

- **Ops as canonical `.json`** (TS packages as typing sugar) — decided direction, own plan. Verified
  2026-08-22: the three ops' entries contain zero functions, so the conversion is mechanical.
- `vibe-ops governance install/update` writing `types` keys — needs the committed-state-file answer
  first (Plan-030 Open questions carries it).
- Per-noun authoring verbs (`vibe-ops plan guide`), governance-exported skill snippets and hook
  configs — the proxy's later increments.
- adr/rfc in BUILTINS/MCP; Plan-031 ownership semantics beyond the naive fragment compose;
  `template-version-research`'s removal.

## Design

### Layers

```
cli base:   core (contract, config, document model) · cli (dispatch, MCP, hook) · harness (internal module)
            module-check · gates · ops-agents-md · ops-governance · ops-self · module-records
base:       governance-base — the reusable record primitives + defineGovernance sugar
governance: governance-adr · governance-rfc · governance-plan · governance-task · governance-log
```

Inside each `governance-<t>/`: `type.json` at the package root (package-relative facet paths),
`templates/<t>.md`, `migrations/` (only that type's notes), `authoring.md`, `ownership.json` fragment,
`src/index.ts`. adr and rfc are pure sugar; plan, task and log also carry the source files that read
their formats (`plan-fields/plan-file/plan-lifecycle/status`, `close/closure`, `log`) and the verbs of
the module they absorb. Module **ids stay** `plan`/`task`/`log`: settings keys, MCP tool names, skills
and BUILTINS are untouched — only packages move.

### Activation: the config is the registry

The effective governance map = shipped defaults (`{adr,rfc,plan,task,log} → @entelekheia/governance-<t>`)
overlaid per key by `config.types` (Plan-029's binding table). Values keep RFC-0003's id format: a
package name, plus `#<type>` when the package's type name differs from the local key. The CLI routes a
noun by the map and imports the bound package; `defineGovernance` stamps the package root and parsed
unit onto the plugin, so one import answers verbs **and** facets. Importing is acceptable here because a
config binding is the repository's explicit trust declaration — unlike the anonymous `node_modules`
scan, which leaves the resolution path entirely (ADR-0019 supersedes ADR-0018).

A facet resolves: **repository's own `types/` → the activated package → pinned tree
(`harness.source` → `--source` → `CLAUDE_PLUGIN_ROOT`)**. The aggregated `types/index.json`, its
generator and the `type-index-drift` gate are deleted: with the manifest beside its facets and the
version read from the template at use time, there is nothing left to drift.

## Tracks

- [ ] **Track 1 — The base layer.** `records` → `governance-base` (`@entelekheia/governance-base`),
  imports updated, `defineGovernance` added, foundation build order adjusted. Exists at the end: clean
  build and full tests green under the new name.
- [ ] **Track 2 — Five governance packages.** Scaffolds plus the data moves out of `plugin/`
  (templates, authoring, migrations split per type, `type.json` re-rooted), ownership split into
  fragments, aggregate-index machinery deleted. adr/rfc sugar-complete. Acceptance: `vibe-ops self .`
  differs from the baseline only by the deleted `type-index-drift` line.
- [ ] **Track 3 — The collapse.** plan/task/log coupled sources and module verbs move into their
  governances; `module-plan`/`module-task`/`module-log` deleted; the CLI routes bare nouns through the
  effective map. Acceptance: noun regression — `plan resolve/status`, `task resolve`, `log lint`,
  `records census/handling/show` byte-identical to before.
- [ ] **Track 4 — Harness internalized.** `module-harness` → `harness`
  (`@entelekheia/vibe-ops-harness`); base ownership fragment lives there; `sync` composes norm content
  and ownership from the activated governances; `status` reads versions from their templates.
- [ ] **Track 5 — Resolution and `records norm`.** The map-driven facet resolution threaded through
  `resolveTypeUnit`, `migrationsDir` (one copy, per-type), `expandTemplateToken`; the `norm` verb with
  tests. Acceptance: the npm-only install case — pack, install into an empty repo, no plugin,
  `CLAUDE_PLUGIN_ROOT` unset; `records norm --type adr`, `plan resolve`, `harness status` all answer.
- [ ] **Track 6 — Skills, checks, docs.** `migrate`/`new`/`new-log` read via `vibe-ops records norm`;
  `new-migration` writes into the type's governance package; checks 35/55/80 retarget;
  `cli/AGENTS.md`, `plugin/AGENTS.md`, `README.md`, `CHANGELOG.md`. Acceptance:
  `vibe-ops governance .` byte-identical to the pre-change baseline; 17 shell checks green.
- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the file kept.

## Success criteria

- One `git grep` finds no path under `plugin/templates/`, `plugin/references/records/`,
  `plugin/skills/migrate/migrations/` or `plugin/types/` referenced as live instruction anywhere.
- A repository with the npm CLI and no Claude plugin resolves all five types end to end.
- `vibe-ops governance .` output unchanged from before this plan; `self .` differs only by the deleted
  gate's line.
- Adding a sixth governance package requires: publish the package, add one `types` key in the consuming
  repository. No edit to this repository.
- No behaviour-equal code appears twice across the five governances — the sugar carries it.

---

## Decision Log

- Decision: One governance package per artifact, never one package for the set. The layering is
  cli base → reusable base components (sugared per type) → governances.
  Rationale: maintainer direction, 2026-08-22, redirecting Plan-030 Track 3 mid-execution — the
  `governance-policies` single package (one commit, since dropped) coupled five types' evolution into
  one version stream and left the module/data split (`module-plan` vs the plan data) standing.
  Recorded in [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md).
  Date / Author: 2026-08-22 / Danilo Borges

- Decision: Activation and discovery are the repository's `vibeops.config` (shipped defaults overlaid
  by `config.types`), and the CLI routes by that map. The `node_modules` scan leaves the resolution
  path; ADR-0018's manifest marker is superseded.
  Rationale: the config is already the binding table (Plan-029) and the id format is already defined
  (RFC-0003 `pkg#type`); a scanner answers "who could serve this type", which activation makes moot —
  the repository says who does. Under an explicit binding the scan's ambiguity case cannot arise.
  Date / Author: 2026-08-22 / Danilo Borges

- Decision: adr and rfc are sugar-only governances now — no entries in BUILTINS, verbs stay reachable
  through `records`.
  Rationale: their behaviour is entirely the shared primitives'; a noun is added when there is bespoke
  behaviour to hang on it, and promotion later is two strings.
  Date / Author: 2026-08-22 / Danilo Borges

- Decision: Ops remain collections and their canonical form becomes `.json`, with the TS package kept
  as typing sugar — deferred to its own plan.
  Rationale: measured 2026-08-22 — the three ops' entry lists contain zero functions (fixtures are
  string maps), so nothing in this plan blocks or is blocked by the conversion.
  Date / Author: 2026-08-22 / Danilo Borges

- Decision: The vibe-ops CLI is the proxy between the Claude plugin and the modular governance — the
  plugin reads norm data only through CLI verbs, starting with `records norm`.
  Rationale: an installed plugin is a copy of `plugin/` alone and cannot reach npm packages by path
  (`70-plugin-root-paths.sh`); the plugin already presumes the CLI on PATH (its MCP server is
  `command: "vibe-ops"`). Skill snippets, hook configs and `governance install/update` are later
  increments of the same seam, listed out of scope.
  Date / Author: 2026-08-22 / Danilo Borges

## Outcomes & Retrospective

(No outcomes yet — filled at each major track completion and at the end.)

---

## Open questions

- Whether `vibe-ops governance install/update` writes `types` into a committed state file or the
  operator edits `vibeops.config.ts` by hand forever — depends on the committed-state answer Plan-030's
  Open questions already carries for `harness.applied`.
- What a governance package exports for the proxy's later increments — skill text fragments, hook
  configuration — and whether those are files the package ships or values `defineGovernance` returns.

## Related

- [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) — the model; this plan is its
  package-topology half.
- [Plan-030](030-the-type-unit-and-the-compositions-derived-from-it.md) — Tracks 1–2 (the type unit,
  the header schema as data) shipped and stand; Tracks 3–6 superseded here.
- [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md) — the topology and
  activation decision; supersedes ADR-0018.
