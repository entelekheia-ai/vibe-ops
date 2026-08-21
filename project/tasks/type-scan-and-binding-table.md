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

# Task: The type scan and the binding table

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/029-a-record-type-becomes-a-resolved-name.md](../plans/029-a-record-type-becomes-a-resolved-name.md), Track 2 |

---

## Context

Plan-029 Track 2. With the union open (sibling dossier `record-type-union-opens.md`), a bare type name
needs an owner. RFC-0003's rule is fixed: scan installed packages; one claimant resolves, zero reports
absence, two or more is a finding naming every claimant, and the repository breaks ties in config
(`types: { policy: "<qualified id>" }`). Two constraints carry over from shipped work: a declared binding
is used even when it does not resolve (zero examined, attributable), and ambiguity is a finding, never an
aborting error.

## Work items

| # | Priority | Item | Why (measured) | Effort |
|---|---|---|---|---|
| 1 | P0 | The marker: `"vibeOps": { "types": "types" }`, a DIRECTORY not a name list | A manifest field has precedent in this very package — `grammars.ts` reads a grammar's own `"tree-sitter"` array out of its `package.json`. Pointing at the directory rather than listing names keeps the names in one place; a list beside the directory is a second copy to hold in step, which is the drift `type-index-drift` already exists to catch. | M |
| 2 | P0 | The enumeration, walking `node_modules` upward, reading and never importing | npm hoists: in this workspace every dependency resolves from the ROOT `node_modules`, one directory above `cli/`, so a scan anchored at one package finds nothing. Reading rather than importing is what RFC-0003's "a type ships as data" requires — learning that a package declares a type must not run its code, and it is what lets the scan see a package that would fail to import at all. | M |
| 3 | P0 | The one/none/many rule as `resolveTypeName` in core | Fixed by RFC-0003 and not redesigned here. Zero is absence, not failure: the generic `project/<type>` convention still answers. Two or more names every claimant and says how to break the tie. | M |
| 4 | P0 | `types` in `VibeOpsConfig`, merged PER KEY | Decided against the cascade's own tests: `records.dirs` merges per key and `harness.applied` wins whole. Two bindings naming two different types are independent facts, so a home file binding one must not be discarded by a repository binding another — whole-key would make the nearer file's silence an answer. | S |
| 5 | P1 | Fixtures: two claimants → named; binding resolves; unresolvable binding → no fallback | Eight tests in `core/test/type-scan.test.ts`, including the general shape the maintainer named: `@scope/governance-policies` claiming two types beside `dot-agent-freeze` claiming one. | M |

### What is deliberately not here

- **Where a resolution finding lands.** The dossier asked whether it goes to the channel `check` uses.
  `resolveTypeName` returns the reason as data (`unresolved`) and throws nothing, so the surface belongs
  to whoever calls it — an ops reports it as a finding, a verb as a line. Deciding it here would have
  fixed one caller's shape onto every other.

## Implementation order

- [x] P0 — refinement pass producing the final item list (not delegable)
- [x] P0 — items 1–4, the marker, the scan, the rule and the config key
- [x] P1 — item 5, the fixtures

## Surprises & Discoveries

- Observation: The marker's shape was decided by an existing convention rather than invented, and the
  alternative would have re-created a drift this repository already guards against.
  Evidence: `core/src/grammars.ts` reads tree-sitter grammars' own `package.json` field, and its header
  records that TWO manifest conventions coexist (a `"tree-sitter"` array, or a standalone
  `tree-sitter.json`). Listing type NAMES in the manifest would put a second copy of the directory
  listing beside the directory — the same shape `type-index-drift` was written to catch two commits ago.
  Pointing at the directory leaves one source.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
