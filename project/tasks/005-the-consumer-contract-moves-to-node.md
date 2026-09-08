---
vibe-ops-template: task@3
---

# Task: The consumer contract moves to Node

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-09-08 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | plans/038-concluding-the-fragment-migration-and-the-measurement-that-l.md, Track 5 |

---

## Context

Every consumer's commit gate invoked `check-agents-md.sh` by path — the shipped harness template
resolved it from three places (`_run.sh`'s `resolve_runner()`), and this repository's own
`.githooks/pre-commit` and `scripts/check.sh` named it directly. The deletion track removes that file,
so the contract had to move before it could go.

Two facts found by reading, both of which shaped the result: the CLI is **not published**
(`npm view @entelekheia/vibe-ops-cli` → E404), so a target cannot declare a dependency on it; and
`vibe-ops check` is still only the shell runner, so this track moves **who composes**, not what runs.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `_run.sh` resolves `vibe-ops` from PATH, no fallback | M |
| 2 | P0 | This repository's own gate moves to `vibe-ops check` | S |
| 3 | P0 | `setup` stops copying the runner and fragments into a target | M |
| 4 | P1 | The two claims a consumer reads | S |

### 1–2

**What:** `resolve_runner()` and `RUNNER_IN_CHECKOUT` deleted; `run_composed_checks()` runs
`VIBE_OPS_CHECK_DIRS="$check_dir" vibe-ops check --verbose "$root"`, refusing with the install recipe
when the binary is absent. This repository's own `.githooks/pre-commit` and
`cli/packages/module-check/sh/check.sh` gained the same guard and the same invocation; the hook's
fragment-changed branch became `vibe-ops check --self-test`, which also chains the ops fixtures and
Track 3's `ports` phase.
**Why:** the fragments were the only reason a gate could work without an install. Keeping a Node-free
path after they go means keeping a second implementation of every check.
**Change:** `plugin/skills/setup/templates/harness/checks/_run.sh`, `.../check.sh`,
`.../githooks/pre-commit`, `.githooks/pre-commit`, `cli/packages/module-check/sh/check.sh`.

### 3–4

**What:** `setup`'s H1 lost the three-source narrative and the snapshot block; H2 checks
`command -v vibe-ops` first; H4 and both checklists follow. `cli/AGENTS.md:19` retires "Node-free and
standalone"; `README.md` states the requirement in `Requirements` and beside the gate description.
**Why:** the track's own acceptance is that a consumer reads the requirement before hitting it.
**Change:** `plugin/skills/setup/SKILL.md`, `cli/AGENTS.md`, `README.md`.

## Implementation order

- [x] P0 — `_run.sh` rewritten; `resolve_runner()` and the three-source block gone
- [x] P0 — This repository's own gate and hook moved, both with the PATH guard
- [x] P0 — Negative test proved: with `vibe-ops` off `PATH` both refuse, rc=2, naming the recipe
- [x] P0 — Positive test proved: a scratch repo scaffolded from the templates runs 18 checks (17
      built-in + its own fragment) and commits through the real `pre-commit`
- [x] P0 — `setup` stops copying; `SKILL.md` H1/H2/H4 and both checklists updated
- [x] P1 — `cli/AGENTS.md` and `README.md` state the requirement
- [x] P1 — `rm -rf cli/packages/*/dist && npm run build`; `npm test` 643/643; `npm run typecheck` clean
- [x] P1 — Plan-038 updated: Track 5, the new Track 6, the deletion track renumbered to 7, Decision Log
- [ ] P1 — Commit

## Surprises & Discoveries

- Observation: `--verbose` on the gate's own invocation is load-bearing, and for the opposite reason it
  appears to be. `vibe-ops check`'s default output filter (`index.ts:310`) **keeps** the composition
  list — all seventeen lines — and **drops** the summary `N checks, M failed`, because the CLI returns
  that as the module's summary and renders it with a prefix, so the bare form `check.sh` and the hook
  grep for never appears. Without `--verbose` a clean run prints nothing at all and exits 0: a gate
  that says nothing whether or not it ran. The first version of the comment explaining this stated the
  mechanism backwards (that the composition list was what got dropped) and was corrected only because
  the claim was measured instead of reasoned about.
  Evidence: `vibe-ops check "$PWD" | grep -cE '^\s{2}\S+@[0-9]+'` → 17;
  `… | grep -cE '^[0-9]+ checks, [0-9]+ failed'` → 0. A scratch repo with `--verbose` removed from its
  `_run.sh` printed nothing and exited 0.

- Observation: the CI offer is now the one surface still copying fragments into a target, and it has no
  answer available. CI cannot reach an installed plugin (its original reason for the snapshot) and now
  cannot reach the CLI either — the package is unpublished, and a CI runner has neither a vibe-ops
  checkout to `npm link` from nor a registry to install from. The snapshot is the only shape CI can
  take until the CLI is publishable, which makes publication a precondition of the deletion track
  rather than a separate wish.
  Evidence: `npm view @entelekheia/vibe-ops-cli` → E404; `plugin/skills/setup/SKILL.md:255-262` copies
  `check-agents-md.sh` and `sh/checks/` and runs them directly, bypassing `_run.sh` entirely.

- Observation: this repository's own `scripts/` is a symlink to `cli/packages/module-check/sh/`, so its
  own `check.sh` lives **inside** the directory the deletion track removes. Moving it out is not this
  track's job, but nothing recorded that it had to happen at all.
  Evidence: `ls -l scripts` → `scripts -> cli/packages/module-check/sh`.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
