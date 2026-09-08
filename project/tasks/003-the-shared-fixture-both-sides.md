---
vibe-ops-template: task@3
---

# Task: The shared fixture, both sides

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-07 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/038-concluding-the-fragment-migration-and-the-measurement-that-l.md, Track 3 |

---

## Context

Tracks 1 and 2 wired nine `fragment-parity` entries comparing a shell fragment against its port. Every
comparison so far has run on this repository's own checkout, which is clean — the two sides have never
been observed agreeing (or disagreeing) on an input where either actually fails.

The track's own text called for running `vibe-ops check` over the fixture `check-agents-md.sh --self-test`
already builds. That framing turned out wrong: `vibe-ops check` **is** the shell runner
(`cli/packages/module-check/src/index.ts:20` spawns `sh/check-agents-md.sh`), so pointing it at the
fixture re-runs the fragments and never touches a port. The nine ports live in four ops packages
(`ops-governance`, `ops-agents-md`, `ops-exposure`, `ops-mirror`), none of which accept a positional
repository root.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Extract the fixture out of `self_test()` into `build_fixture` | S |
| 2 | P0 | `--emit-fixture <dir>` seam on the shell runner | S |
| 3 | P0 | Second self-test phase in `module-check/src/index.ts` running the four ops in-process | M |
| 4 | P0 | Prove acceptance by deliberate breakage | S |
| 5 | P1 | Fold into Plan-038 | S |

### 1–3

**What:** One fixture definition (shell), one two-sided assertion (TypeScript). `build_fixture <dir>`
factored out of `self_test()`; `--emit-fixture` calls it and exits; `module-check`'s `--self-test` gains
a `ports` suite that builds the fixture via `--emit-fixture`, runs `governance`/`agents-md`/`exposure`/
`mirror` in-process against it with `config: {}`, and asserts all nine proved-comparable rule ids
(`links`, `budget`, `bridge`, `frontmatter`, `skill-frontmatter`, `memory-slug`, `file-path`,
`template-attribution`, `dogfooding-drift`) appear as `FAIL`.
**Why:** Reuses the one fixture definition instead of a second hand-written copy that could drift from
it unnoticed — the exact failure mode Track 3 exists to close.
**Change:** `cli/packages/module-check/sh/check-agents-md.sh`, `cli/packages/module-check/src/index.ts`.

### 4. Acceptance, proved

**What:** Commented out `budget`'s only detection line (`if (n > max)` → `if (n > max * 1000)`),
rebuilt, re-ran `check --self-test`: failed naming `ports: did not fail on the shared fixture: budget`.
Restored, rebuilt, confirmed green.
**Why:** The track's acceptance criterion is "removing a detection line from any wired port makes
`--self-test` fail naming that port" — asserted here rather than taken on trust.
**Change:** none surviving; the breakage was temporary.

## Implementation order

- [x] P0 — `build_fixture` extracted, `self_test()` calls it, behaviour unchanged
- [x] P0 — `check-agents-md.sh --self-test` green after the extraction
- [x] P0 — `--emit-fixture <dir>` added, verified: builds and exits 0
- [x] P0 — `ports` suite added to `module-check/src/index.ts`'s `--self-test` chain
- [x] P0 — `rm -rf cli/packages/*/dist && npm run build` clean
- [x] P0 — `check --self-test` green, prints `ports: all 9 proved-comparable fragments failed on the
      shared fixture`
- [x] P0 — Acceptance proved: broke `budget`'s detection, `ports` failed naming `budget`; restored
- [x] P1 — `npm test` — 643/643; `npm run typecheck` — clean
- [x] P1 — Plan-038 updated: Track 3 checkbox, text, Decision Log
- [ ] P1 — Commit

## Surprises & Discoveries

- Observation: the track's own written text ("run `vibe-ops check` over the same fixture") was wrong —
  `vibe-ops check` is the shell runner itself, not a TypeScript composition. Found by reading
  `cli/packages/module-check/src/index.ts:20` before writing any code, via a delegated subsystem read
  rather than by trial and error.
  Evidence: `module-check/src/index.ts:18-20` — `RUNNER` resolves to `sh/check-agents-md.sh`, spawned by
  every non-`--list`/`--self-test`/`--explain` invocation.
- Observation: no `ops-*` module accepts a positional repository root — only `check` and `harness`
  declare `repoFromFirstArg`. Reaching the four ops against a synthetic fixture requires building a
  `ModuleContext` in-process, the same pattern `ops-agents-md/test/ops.test.ts` already uses for tests.
  Evidence: `cli/packages/cli/src/run.ts:151`, `cli/packages/cli/src/bin.ts` module definitions.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
