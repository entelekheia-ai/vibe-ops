# Task: The template-version gate resolves the wrong templates/ path in a flat consumer repo

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Issue | pending |

---

## Context

`packages/ops-governance` declares each `template-version` entry with `options.template:
"<plugin>/templates/<type>.md"`. `<plugin>/` expands via `expandPluginToken`
(`packages/core/src/files.ts`) to `plugin/` when the target repo has its own
`plugin/.claude-plugin/plugin.json` (this repo's own shape), and to the **target repo's root** otherwise —
the "flat" branch. So for any consumer repo that does not itself ship a Claude Code plugin, the token
resolves to `<repo-root>/templates/<type>.md`.

`/vibe-ops:setup repo`'s own Step 2, however, always writes the governance templates to
`project/templates/{adr,rfc,task,plan}.md` — never to a root-level `templates/`. Every repo actually
scaffolded by this skill therefore has its templates at a path the gate never looks at. The gate's own
"absent template" branch reads this as "this repository keeps no records of that type" and SKIPs
silently — indistinguishable, in `--verbose` output, from a repository that genuinely has none.

Confirmed live: every consumer repo checked (several, all set up via `/vibe-ops:setup repo`, none
declaring a `vibeops.config.ts` override for `template`) shows `SKIP [template-version-*] no
templates/<type>.md — this repository keeps no records of that type` for all six entries
(`adr`/`plan`/`rfc`/`task`/`log`/`research`), despite each holding real, populated record directories.
The gate has been inert in every repository it was composed into since `template-version` was added
(Plan-012).

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Fix the path mismatch between what `setup repo` writes and what `ops-governance` reads | S |
| 2 | P1 | Confirm no repo relies on the current (broken) skip behavior | S |

### 1. Fix the path mismatch — P0

**What:** Either point `ops-governance`'s `template:` options at
`<plugin>/project/templates/<type>.md`, or change `/vibe-ops:setup repo` Step 2 to place templates at
`<plugin>/templates/<type>.md` (root-relative in a flat repo) instead of `project/templates/`. The former
is the smaller, more localized change and matches every existing consumer repo's actual layout; the
latter would require moving `project/templates/` in every already-scaffolded repo.
**Why:** Without this, `template-version-behind` / `template-version-undeclared` never fire anywhere
outside this repo, and `/vibe-ops:migrate`'s census (`vibe-ops records census`) is the only surviving
signal for version drift — accurate, but not wired into the commit-gate/CI surface the way the design
intends.
**Change:** `packages/ops-governance/src/index.ts`, the six `options: { template: "<plugin>/templates/…" }`
entries. Add or extend a gate/ops test fixture shaped like a *flat* consumer repo (`project/templates/`,
no `plugin/` dir) so the regression cannot reappear silently — the existing self-test fixtures are shaped
like this repo itself, which is exactly why this went unnoticed.

### 2. Confirm no repo relies on the current (broken) skip behavior — P1

**What:** Re-run `vibe-ops governance --verbose` against every consumer repo after the fix and check
that `template-version-*` starts reporting real findings (`behind`/`undeclared`) rather than `SKIP`, and
that none of those findings are themselves wrong (e.g. a repo whose templates were deliberately never
declared).
**Why:** A gate that has been silently off may have let real drift accumulate; turning it on for the
first time can be noisy. Worth knowing the shape of that noise before treating a red gate as a fresh
regression.
**Change:** No code change — a verification pass.

## Implementation order

- [ ] P0 — Decide which side moves: `ops-governance`'s template path, or `setup repo`'s write location
- [ ] P0 — Apply the fix in `packages/ops-governance/src/index.ts` (or the setup skill's Step 2)
- [ ] P0 — Add a flat-repo-shaped fixture to the gate/ops test suite so this regresses loudly next time
- [ ] P1 — `vibe-ops governance --verbose` against each consumer repo; record what newly surfaces

## Surprises & Discoveries

- Observation: `expandPluginToken`'s two-layout design (`plugin/` vs. flat root) was built for `skills/`,
  `references/`, and similar plugin-internal paths, where "flat" correctly means "this repo's root is
  where a copied plugin surface would live." `template-version` reuses the same token for a path that
  `/vibe-ops:setup repo` puts under `project/`, not the repo root — the token's two branches don't cover
  where governance templates actually live in either layout.
  Evidence: `packages/core/src/files.ts:25-29` (`resolvePluginDir`) vs.
  `plugin/skills/setup/SKILL.md` Step 2 (`project/templates/{adr,rfc,task,plan}.md`).

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
