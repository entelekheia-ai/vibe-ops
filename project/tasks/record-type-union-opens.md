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

# Task: The record-type union opens

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/029-a-record-type-becomes-a-resolved-name.md](../plans/029-a-record-type-becomes-a-resolved-name.md), Track 1 |

---

## Context

`RecordType` in `cli/packages/core/src/config.ts` is `"adr" | "rfc" | "plan" | "task"`, and
`RecordsConfig` keys `dirs` and `templates` by it — verified this week when a repository declaring
`records: { dirs: { policy: … } }` failed to type-check. The plan's Design section records the load-bearing
fact: 24 files mention the type `plan`, but most are data keyed by type that stays put as shipped
defaults. This dossier is the mechanical opening of the union.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `RecordType` becomes an open name; `RecordsConfig` keys by it | S |
| 2 | P0 | Consumers of the union compile against the open type; shipped-four data becomes defaults | M |
| 3 | P1 | Fixture: a custom type name flows config → tokens → census | S |

### 1. Open the type — P0

**What:** `RecordType` becomes `string` (or a branded string type, decided at the keyboard), keeping the
name so the 24 mentioning files keep reading naturally.
**Why:** the closed union is the single compile-time wall (verified by the failing config above).
**Change:** `cli/packages/core/src/config.ts` — the type alias and both `Partial<Record<RecordType, …>>`
maps; `HarnessConfig.applied` keys by `RecordType | "log"` today and simplifies.

### 2. Consumers compile; the four become defaults — P0

**What:** every signature taking `RecordType` accepts the open name; `CANDIDATE_DIRS`/`CANDIDATE_TEMPLATES`
/`DEFAULT_PAD`/`DEPTH` (`cli/packages/records/src/layout.ts`) and the status chains become the shipped
defaults consulted for the four names, with the generic fallback (already shipped in core's
`recordDirCandidates`/`templateCandidates`) answering for every other name.
**Why:** `layout.ts` already builds its candidate maps from core's generic functions (verified — commits
`a4d01e7`/`50ad03e`), so the split default-vs-generic already exists; this item finishes it.
**Change:** sweep the union's consumers — `records/src/*`, `module-records/src/census.ts`,
`gates/src/record-header` (schema stays validated per entry), `module-harness/src/status.ts`.

### 3. The fixture — P1

**What:** a temp repository with `records.dirs.policy` and files under `project/policy/`, asserting
resolution through `<records:policy>` and appearance in `records census`.
**Why:** the acceptance named by the plan track; without it the opening is only a typecheck.
**Change:** a test beside `cli/packages/core/test/files.test.ts` and one in `module-records`.

## Implementation order

- [ ] P0 — Item 1 (not delegable: the branded-vs-plain decision is the one judgment here)
- [ ] P0 — Item 2 (delegable under contract: mechanical retype, old behaviour byte-identical for the
      shipped four, `rm -rf cli/packages/*/dist && npm run build && npm test` green — the clean build is
      mandatory, incremental builds hide cross-package staleness)
- [ ] P1 — Item 3 (delegable: fixture per the plan's acceptance wording)

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
