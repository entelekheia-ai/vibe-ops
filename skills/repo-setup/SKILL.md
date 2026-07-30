---
name: repo-setup
description: Bring a repository to the standard born-organized baseline — single-package or npm-workspaces monorepo, English docs. Sets up or reconciles the package/build baseline, a project/ governance skeleton (ADR/RFC/tasks/plans/research/log, governed by a path-scoped rule), the .agents/.claude rules bridge, a license, a docs/ Diátaxis skeleton, and the AGENTS.md config map. Use when the user asks to create/start/bootstrap a new repo, monorepo or package, AND when an existing repo has drifted from the baseline or is missing part of it — pass "audit" to report the gaps without writing.
argument-hint: "<repo-name> [audit]"
effort: inherit
---

# /repo-setup — a repo born organized

A light **orchestrator**: it lays down a consistent, English-documented skeleton from templates and delegates
the detailed authoring to sibling skills, so that every repo carries the same governance, docs and config.
It is run just as often on a repo that already exists and has drifted as on an empty directory — the
baseline is the target either way.

**Templates live in the plugin** at `${CLAUDE_PLUGIN_ROOT}/skills/repo-setup/templates/`. Copy from
there; never invent structure from memory. Files named `gitignore`/`editorconfig`/`gitkeep` are copied to
`.gitignore`/`.editorconfig`/`.gitkeep`; `{{PLACEHOLDERS}}` are substituted (Step 3).

**This is a target-state skill.** The templates below *are* the target state, and it is applied to
repositories that already exist as often as to new ones — an empty directory is simply the maximum-gap
case. Read
[`${CLAUDE_PLUGIN_ROOT}/references/convergence-policy.md`](../../references/convergence-policy.md) before
touching anything that is already there; the `adopt` verb is what stops this skill from flattening a
convention the repo settled on deliberately.

---

## Step 0 — Survey what already exists

Skip only if the target directory does not exist. Otherwise, before writing anything, produce a **gap
list** against the target state described in Steps 2–5 — each entry marked *missing*, *divergent*, *extra*
or *conflicting*, with the verb to apply:

```bash
ls -a "$TARGET"; ls "$TARGET/project" "$TARGET/.agents/rules" "$TARGET/.claude/rules" 2>/dev/null
```

Two divergences are `adopt` by default, not `migrate` — a governance folder that uses a different but
consistent name (`rfcs/` for `rfc/`, a top-level `plans/`), and a `project/` subfolder holding something
other than what the governance rule expects but referenced as authoritative by the repo's own docs. Rename
neither. Report the gap list and the verbs, and **confirm before writing** — this is the point where the
run is destructive if the judgement is wrong.

If the user asked for an `audit`, stop here: report the gap list and write nothing.

## Step 1 — Gather inputs

Ask (accept the `/repo-setup` argument as the repo name):

1. **Repo name** (kebab-case) and **target path** (default: a sibling dir `../<repo-name>`, or the user's choice).
2. **Shape** — single-package **or** monorepo (npm workspaces). Default to what the user describes; if they
   say "several packages / monorepo", use monorepo.
3. **npm scope** — default `@entelekheia`. Full package name is `<scope>/<name>`.
4. **One-line description** (for README + package.json).
5. **First package(s)** — for a monorepo, at least one under `packages/`; for single-package, the root is the package.

Confirm the plan (shape + names + path) before writing.

## Step 2 — Lay down the tree

Create the target directory and copy templates. `TPL=${CLAUDE_PLUGIN_ROOT}/skills/repo-setup/templates`.

**Root (always):**
- `TPL/root/README.md` → `README.md`, `TPL/root/GOVERNANCE.md` → `GOVERNANCE.md`, `TPL/root/CLAUDE.md` → `CLAUDE.md`
- `TPL/root/editorconfig` → `.editorconfig`, `TPL/root/gitignore` → `.gitignore`

**Package/build baseline:**
- **Monorepo:** `TPL/pkg/package.workspace.json` → root `package.json`; for each package
  `packages/<name>/`: `TPL/pkg/package.pkg.json` → `package.json`, `TPL/pkg/tsconfig.base.json` →
  `tsconfig.json`, `TPL/pkg/tsconfig.build.json` → `tsconfig.build.json`, plus `src/index.ts` and
  `test/` (empty).
- **Single-package:** `TPL/pkg/package.pkg.json` → root `package.json`; `TPL/pkg/tsconfig.base.json` →
  `tsconfig.json`; `TPL/pkg/tsconfig.build.json` → `tsconfig.build.json`; `src/index.ts`; `test/`.

**`project/` governance skeleton:**
- `TPL/project/templates/{adr,rfc,task,plan}.md` → `project/templates/`
- `TPL/project/{adr,rfc,tasks,plans,research,log}/.gitkeep` → same paths — empty folders that need a placeholder
  to survive git; there is **no per-folder `AGENTS.md`** (see the rules bridge below, which replaces them)
- Create `project/rfc/implemented/.gitkeep` and `project/rfc/rejected/.gitkeep`

**Rules bridge** (replaces per-folder `AGENTS.md`s with one path-scoped rule; mechanics, the `test -L`
verification and the Windows fallback are in
[`${CLAUDE_PLUGIN_ROOT}/references/instruction-surfaces.md`](../../references/instruction-surfaces.md#the-agents--claude-bridge)):
- `TPL/agents/rules/governance.md` → `.agents/rules/governance.md`; symlink
  `ln -s ../../.agents/rules/governance.md .claude/rules/governance.md`
- `TPL/agents/rules/repo-guardrails.md` → `.agents/rules/repo-guardrails.md` (seed file — leave its `TODO`
  placeholder for the user to fill in or delete, don't invent guardrails); same symlink pattern into
  `.claude/rules/repo-guardrails.md`
- `TPL/agents/skills/.gitkeep` → `.agents/skills/.gitkeep` (empty — repo-specific skills land here later)

**`docs/` Diátaxis skeleton:** `TPL/docs/**` → `docs/` (index + `reference/ explanation/ how-to/ tutorials/` READMEs).

## Step 3 — Substitute placeholders

Replace across the copied files:
- `{{REPO_NAME}}` → repo name · `{{PKG_NAME}}` → `<scope>/<name>` (per package) ·
  `{{PKG_DESCRIPTION}}` / `{{ONE_LINE_DESCRIPTION}}` → the descriptions · `{{LICENSE_ID}}` → the license
  chosen in Step 4 (default `Apache-2.0`).
Verify no `{{` remains: `grep -rn '{{' <repo>` should be empty.

## Step 4 — License

Run **`license-setup`** (defaults: Apache-2.0, not a fork; ask enforcement level per that skill's own Step 1
question 3) to write `LICENSE` and the `AGENTS.md` license-rules section. Do this **before** Step 5 so the
license section exists when `authoring-agents-md` assembles the rest of the file.

## Step 5 — Author AGENTS.md and READMEs

- Follow **`authoring-agents-md`** to write the repo's root `AGENTS.md` — self-contained to this repo, a map
  of the layout (packages, `project/`, `docs/`, the `.agents/`↔`.claude/` bridge already in place from Step
  2), the source-of-truth table, and the "keeping this file current" loop. For a monorepo, note each package
  has its own `AGENTS.md`/README.
- Follow **`authoring-readme`** to fill in `README.md` (root, and each package's README for a monorepo) —
  it defines the canonical section order and strips the anti-patterns (decision history, process leakage)
  that tend to leak into a freshly-written README.

## Step 6 — Seed first records (optional)

Offer to create the first ADR (e.g. the stack/shape decision) via **`new-adr`**, and an initial RFC via
**`new-rfc`** if there's an open design. Skip if the user prefers to start empty.

## Step 7 — Initialize & hand off

- `git init`; stage; **do not commit** unless the user asks.
- Print next steps: review `AGENTS.md`, `npm install && npm run typecheck`, `gh repo create` when ready, and
  "agent tooling is the `vibe-ops` plugin — no per-repo skill copies; closing a task goes through
  `/vibe-ops:close-task`, not a plain delete."

## Checklist

- [ ] Target has `README.md`, `GOVERNANCE.md`, `AGENTS.md`, `CLAUDE.md`(@AGENTS.md), `LICENSE`, `.gitignore`, `.editorconfig`
- [ ] Build baseline present; monorepo root `package.json` has `workspaces`, each package has its own `package.json` + tsconfig(.build)
- [ ] `project/` skeleton present (`adr rfc tasks plans research log templates`, each non-empty via `.gitkeep`
      if no content yet); `project/templates/{adr,rfc,task,plan}.md` present; **no** per-folder `AGENTS.md`
      (that's the rule's job)
- [ ] `.agents/rules/{governance,repo-guardrails}.md` exist, each symlinked from `.claude/rules/`; `.agents/skills/` present (empty)
- [ ] `docs/` Diátaxis skeleton present
- [ ] No `{{PLACEHOLDER}}` remains (`grep -rn '{{'`)
- [ ] `license-setup` completed (real `LICENSE` text, not the plugin's own; `AGENTS.md` license-rules section present)
- [ ] `AGENTS.md` passes the `authoring-agents-md` before-commit checklist (self-contained; no personal-memory slugs)
- [ ] `README.md` (and each package's) passes the `authoring-readme` checklist
- [ ] `git init` done; not committed unless asked
