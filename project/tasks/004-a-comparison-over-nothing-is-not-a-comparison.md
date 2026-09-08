---
vibe-ops-template: task@3
---

# Task: A comparison over nothing is not a comparison

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-07 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/038-concluding-the-fragment-migration-and-the-measurement-that-l.md, Track 4 |

---

## Context

`fragment-parity` returned `examined: files.length` unconditionally and reported `ok` on a clean run —
including when `files.length === 0`. `classification` and `mirror` already treat a zero population as
`skipped`, not a pass (`gates/src/classification/index.ts:122`, `gates/src/mirror/index.ts:279`);
`fragment-parity` was the one gate in the composition still printing `ok` for having examined nothing.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Add the zero-population skip to `fragment-parity` | S |
| 2 | P0 | Fix the ops-mirror test the change breaks | S |

### 1–2

**What:** A `files.length === 0` check before the shell runner is spawned, returning the same
`skipped` shape the other two gates use. Fixed `ops-mirror/test/ops.test.ts`'s
"every fragment-parity entry actually compared" test, which asserted `(compared ` for
`fragment-parity-bridge` — a label that, on THIS repository's own checkout, legitimately has a
zero population (`.claude/**` fully covered by the ops's own `ignore`) and now correctly SKIPs
instead of printing `ok 0 examined`.
**Why:** The acceptance criterion is that a scoped-to-nothing entry never prints `ok`. It fired on
real data during implementation, not only in a synthetic fixture — `fragment-parity-bridge` had been
silently passing vacuously in this very repository the whole time.
**Change:** `cli/packages/gates/src/fragment-parity/index.ts`, `cli/packages/ops-mirror/test/ops.test.ts`.

## Implementation order

- [x] P0 — Zero-population skip added to `fragment-parity`, matching `classification`'s message shape
- [x] P0 — `rm -rf cli/packages/*/dist && npm run build` clean
- [x] P0 — `fragment-parity-bridge` now reports `SKIP` naming the empty population on this repo's own
      checkout (previously silent `ok 0 examined, 2 ignored`)
- [x] P0 — `ops-mirror/test/ops.test.ts` updated: `fragment-parity-bridge` moved out of the
      `(compared ` loop into its own `SKIP` assertion
- [x] P1 — `npm test` 643/643, `npm run typecheck` clean
- [x] P1 — Plan-038 updated: Track 4 checkbox, Decision Log
- [ ] P1 — Commit

## Surprises & Discoveries

- Observation: `fragment-parity-bridge` had a zero population in this repository's own checkout the
  whole time — `.claude/**` (its declared paths) is entirely covered by the ops's own `ignore` — and
  was reporting a silent `ok 0 examined, 2 ignored`, not a synthetic edge case. The fix's acceptance
  criterion fired on real data during implementation.
  Evidence: `node cli/packages/cli/dist/bin.js mirror --verbose` before the change:
  `ok    [fragment-parity-bridge] 0 examined, 2 ignored (compared bridge@2 vs bridge@1)`; after:
  `SKIP  [fragment-parity-bridge] bridge: no file in the population — zero examined is not a reading`.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
