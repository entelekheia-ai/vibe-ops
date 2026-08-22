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

# Plan-036: The proxy grows

| Field | Value |
|---|---|
| Status | Backlog |
| Created | 2026-08-22 |
| Author | Danilo Borges |
| Depends on | [Plan-033](./shipped/033-one-artifact-one-governance.md) |
| Related | [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md) |

---

## Summary

Plan-033 made the CLI the proxy between the Claude plugin and the modular governance, and shipped its
first increment: the skills read norm data through `vibe-ops records norm`. This plan is the recorded
backlog of the increments the maintainer named as the end-state — the plugin working dynamically,
everything type-specific arriving from the governance packages through the CLI — none of which blocks
anything today.

## Goals

- **Skill text from the packages.** A governance package exports the snippets a common skill composes —
  the `/new` flow reads a shared writing guide, then `vibe-ops plan <verb>` for the type-specific rest —
  so the per-type halves of `/new-*` stop being plugin files at all. Kills the last hand-synced copy:
  `skills/setup/templates/project/templates/` (the `35-dogfooding-drift.sh` pairs) becomes generated at
  build or adoption, which is the half of old Plan-030 Track 5 that Plan-033 did not absorb.
- **Per-noun authoring verbs** (`vibe-ops plan guide` or a standard `defineGovernance` verb) as the
  sugar's next standard command, once the snippet shape exists.
- **Package-provided hook and skill configuration** — the `defineGovernance` options bag was born
  extensible for exactly these keys.
- **Part-2 seams**, opportunistically: `plan-fields.ts` and `closure.ts` out of `governance-base` once
  the base resolver's plan enrichment has a home; `module-records` census deriving its type list from
  the activated bindings; adr/rfc promoted into BUILTINS (two strings) when a bespoke verb earns it.

## Scope

### In scope

The increments above, each as a track refined at pick-up. This plan is a parking orbit with named cargo,
kept as one file so the pieces are found together.

### Out of scope

- Anything that writes committed configuration — [Plan-032](032-the-ownership-verb-and-the-configuration-it-writes.md)'s
  format RFC gates all of it, including governance install/update through the setup verbs.
- The ops work — [Plan-034](./shipped/034-the-ops-become-data-and-the-governances-feed-them.md) /
  [Plan-035](035-the-audience-boundary.md).

## Read these first

1. **`cli/packages/governance-base/src/define-governance.ts`** — the options bag every increment here
   extends, born with one open-ended contract for exactly this. `STANDARD_COMMANDS` is where a
   per-noun authoring verb joins; a package's own command replaces a standard one of the same name.
2. **`cli/packages/module-check/sh/checks/35-dogfooding-drift.sh`** — its `pair` list is the debt Track 1
   erases: five templates held in step by hand between `cli/packages/governance-<t>/templates/` and
   `plugin/skills/setup/templates/project/templates/`. The standing success criterion is that this list
   is empty.
3. **`cli/packages/module-records/src/index.ts`**, the `norm` verb — the proxy's first increment,
   shipped. Every later one is the same shape: the plugin asks the CLI, the CLI asks the activated
   governance.

## Tracks

- [ ] **Track 1 — Snippets and the generated setup copies.** (refine at pick-up)
- [ ] **Track 2 — Per-noun authoring verbs.** (refine at pick-up)
- [ ] **Track 3 — Package-provided hook/skill configuration.** (refine at pick-up)
- [ ] **Track 4 — Part-2 seams.** (refine at pick-up)
- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the file kept.

## Success criteria

*Set per track at pick-up; the standing one:* `35-dogfooding-drift.sh` has no hand-maintained pair left
to compare.

---

## Decision Log

- Decision: these increments are one backlog plan, not four stubs.
  Rationale: each is small, none is urgent, and their common thread — the proxy — is the thing worth
  finding in one place; four files would scatter it.
  Date / Author: 2026-08-22 / Danilo Borges

## Outcomes & Retrospective

(No outcomes yet.)

---

## Related

- [Plan-033](./shipped/033-one-artifact-one-governance.md) — the proxy's first increment, and the
  Decision Log entry naming this end-state.
