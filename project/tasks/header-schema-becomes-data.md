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

# Task: The header schema becomes data

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/030-the-type-unit-and-the-compositions-derived-from-it.md](../plans/030-the-type-unit-and-the-compositions-derived-from-it.md), Track 2 |

---

## Context

Plan-030 Track 2. Track 1 gave every type a manifest declaring `schema: { carrier, required }`, and
nothing reads it. `record-header` still holds a closed union of four type names and a hardcoded field
map, throwing on anything else — so the field lists exist twice, and a type a package brings cannot get
a header entry without editing this repository.

**The `frontmatter` carrier gets its own gate.** `check-frontmatter` is not it, and is not made into it:
its three schemas are per-schema logic rather than field lists, its population is the instruction surface
rather than records, and two `fragment-parity` entries pin its behaviour to the shell fragments it is
being compared against. `record-frontmatter` is a symmetric sibling of `record-header`, so each carrier
maps onto exactly one gate.

**What must not move.** The finding `rule` and the entry `label` are both `record-header-<type>` and
coincide by construction. Repository configuration keys on them and not on the gate's options —
`ignore`, `disabled` and `--fix` on the label; `level` on the rule first, then the label, then `"*"`;
the emitted artifact on both. Holding the pair fixed is what keeps this change invisible to every
consumer.

## Work items

Every `Why` below was run before it was written, per `references/records/task.md`.

| # | Priority | Item | Why (measured) | Effort |
|---|---|---|---|---|
| 1 | P0 | `record-header` takes `options.type` (free-form) and `options.required`; `REQUIRED` and `SCHEMAS` deleted | The gate throws today on any type outside `adr/plan/rfc/task`, so no package can contribute one. Both evidence strings already interpolate the type and the field list, so they read correctly for a type nobody hardcoded. | M |
| 2 | P0 | The four `ops-governance` entries carry `type` + `required` | Their labels stay `record-header-<t>`, which is what `--list`, `ignore`, `disabled` and `--fix` key on. The root `vibeops.config.ts` references no `record-header-*` key at all, so nothing there needs touching. | S |
| 3 | P0 | A guard holding those `required` lists to `plugin/types/index.json` | Item 2 duplicates what the manifests already declare, and Track 3 removes the duplication. Until then a manifest edited without its entry diverges silently — both files stay individually well-formed. Deleted together with the literals in Track 3. | S |
| 4 | P0 | New gate `record-frontmatter`, `options.type` + `options.required`, over `readFrontmatter().keys` | `readFrontmatter` returns keys in document order and handles a multi-line plain scalar and a sequence like `log`'s `path:` — both occur in real entries here. (It did **not** handle a `>`/`|` block scalar; that gap surfaced during this work and was fixed, see Surprises.) | M |
| 5 | P0 | Compose `record-frontmatter-log` into `ops-governance`, with a fixture | A gate proved only against a fixture is proved against a tree written to make it fire. **The first `Why` here was wrong** — a grep for `^kind:` said all ten real entries were complete; the gate said one was not, and the gate was right (see Surprises). Nine of ten land green and the tenth was a real, live defect. | S |
| 6 | P0 | `ignore` for `record-frontmatter-log` in `vibeops.config.ts` | `project/log/README.md` is generated and `RETIRED.md` is a ledger; neither is a record. `template-version-log` already excludes both by label. It goes in config because a gate must never filter its own population by a repository-specific rule (RFC-0001). | S |
| 7 | P1 | Gate tests, including an invented type | `cli/packages/gates/test/record-header.test.ts` has six tests and none asserts the unknown-schema throw, so nothing pins the behaviour being removed. Its `ctx()` helper already types `schema` as a bare `string`. | M |
| 8 | P1 | The prose that describes the old shape | `cli/AGENTS.md` states `record-header` "demands `options.schema` (`adr`/`plan`/`rfc`/`task`) and throws without it" and counts "four `record-header` entries"; `gates/README.md` and `ops-governance/README.md` carry the same two facts. | S |

### Notes for the implementation pass

- **`schema` becomes `type` in `record-header` only.** `check-frontmatter` keeps `schema`, because there
  it genuinely selects behaviour — `rule`, `skill` and `agent` are not record types.
- `cli/packages/ops-governance/test/ops.test.ts` asserts the `--list` labels in order and one
  `FAIL  [record-header-adr]` line. The first changes with the added entry; the second must not.
- Presence only, in both gates. A value vocabulary exists but reading it is a different act with its own
  scope — the boundary `record-header` already draws, and `vibe-ops plan status` is where the other side
  of it lives.
- The gate throws when `type` or `required` is absent or empty. That preserves today's property: a
  misconfigured entry fails loudly rather than examining a population against nothing.

## Implementation order

- [x] P0 — items 1–3, `record-header` and its entries (the rule/label invariant is the risk, not the edit)
- [x] P0 — items 4–6, the new gate and its one composed entry
- [x] P1 — item 7, the tests, including the invented type that is this track's whole point
- [x] P1 — item 8, the prose

## Surprises & Discoveries

- Observation: The `Why` for work item 5 was measured with the wrong instrument, and the gate caught it
  on its first real run. `grep -E "^kind:"` answers "is the line in the file"; the gate answers "does the
  parser see the key". A real log entry passed the grep and failed the gate.
  Evidence: `project/log/asking-resolveplugindir-where-the-tool-keeps-its-own-files.md` opened its
  `description:` with a backtick — a RESERVED INDICATOR in YAML, which a plain scalar may not start with —
  so the parse died at that line and `kind`, `path`, `attempted` and `source` were silently dropped.
  `readFrontmatter` returned three keys where a control entry returned seven. Consequences already live:
  `vibe-ops log lint` reported three findings nobody had run, and the entry was **absent from
  `project/log/README.md`** entirely, so the trap it records was reaching nobody. Fixed by moving the
  description to a folded block scalar; `log lint` and `log index` both clean afterwards.

- Observation: Fixing that entry exposed a second defect one layer down — `readFrontmatter` folds a block
  scalar's HEADER into the value, so the description travelled as `>- the actual sentence`.
  Evidence: `project/log/README.md` rendered exactly that after the regeneration. The file's own doc
  comment claims folded scalars are handled, and they are — but "folded" there means a multi-line PLAIN
  scalar, which has no header to strip; YAML's `>`/`|` block form was never covered. Fixed in
  `frontmatter.ts` with `stripBlockScalarHeader`, and pinned by two tests in `records/test/log.test.ts`:
  one for the header, one asserting the backtick case breaks a plain scalar and survives the block form.
  Worth routing at closure — any repository writing `>-` in frontmatter hit this silently.
  > Promoted to learning on 2026-08-21

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file.
