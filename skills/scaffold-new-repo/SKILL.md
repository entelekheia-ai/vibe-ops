---
name: scaffold-new-repo
description: Scaffold a new repository — single-package or npm-workspaces monorepo — born organized, with English docs. Creates the package/build baseline, a project/ governance skeleton (ADR/RFC/tasks/research with per-folder AGENTS.md), a docs/ Diátaxis skeleton, and the AGENTS.md config map. Use when the user asks to create/start/bootstrap/scaffold a new repo, monorepo, or package.
argument-hint: "<repo-name>"
effort: inherit
---

# /scaffold-new-repo — a repo born organized

A light **orchestrator**: it lays down a consistent, English-documented skeleton from templates and delegates
the detailed authoring to sibling skills. The goal is that every new repo/package starts with the same
governance, docs, and config so nothing has to be retrofitted later.

**Templates live in the plugin** at `${CLAUDE_PLUGIN_ROOT}/skills/scaffold-new-repo/templates/`. Copy from
there; never invent structure from memory. Files named `gitignore`/`editorconfig` are copied to
`.gitignore`/`.editorconfig`; `{{PLACEHOLDERS}}` are substituted (Step 3).

---

## Step 1 — Gather inputs

Ask (accept the `/scaffold-new-repo` argument as the repo name):

1. **Repo name** (kebab-case) and **target path** (default: a sibling dir `../<repo-name>`, or the user's choice).
2. **Shape** — single-package **or** monorepo (npm workspaces). Default to what the user describes; if they
   say "several packages / monorepo", use monorepo.
3. **npm scope** — default `@entelekheia`. Full package name is `<scope>/<name>`.
4. **One-line description** (for README + package.json).
5. **First package(s)** — for a monorepo, at least one under `packages/`; for single-package, the root is the package.

Confirm the plan (shape + names + path) before writing.

## Step 2 — Lay down the tree

Create the target directory and copy templates. `TPL=${CLAUDE_PLUGIN_ROOT}/skills/scaffold-new-repo/templates`.

**Root (always):**
- `TPL/root/README.md` → `README.md`, `TPL/root/GOVERNANCE.md` → `GOVERNANCE.md`, `TPL/root/CLAUDE.md` → `CLAUDE.md`
- `TPL/root/editorconfig` → `.editorconfig`, `TPL/root/gitignore` → `.gitignore`
- `${CLAUDE_PLUGIN_ROOT}/LICENSE` → `LICENSE` (Apache-2.0)

**Package/build baseline:**
- **Monorepo:** `TPL/pkg/package.workspace.json` → root `package.json`; for each package
  `packages/<name>/`: `TPL/pkg/package.pkg.json` → `package.json`, `TPL/pkg/tsconfig.base.json` →
  `tsconfig.json`, `TPL/pkg/tsconfig.build.json` → `tsconfig.build.json`, plus `src/index.ts` and
  `test/` (empty), and a short `README.md` (OSS-quality, written for an outsider).
- **Single-package:** `TPL/pkg/package.pkg.json` → root `package.json`; `TPL/pkg/tsconfig.base.json` →
  `tsconfig.json`; `TPL/pkg/tsconfig.build.json` → `tsconfig.build.json`; `src/index.ts`; `test/`.

**`project/` governance skeleton:**
- `TPL/project/templates/{adr,rfc,task}.md` → `project/templates/`
- `TPL/project/adr/AGENTS.md` → `project/adr/AGENTS.md`
- `TPL/project/rfc/AGENTS.md` → `project/rfc/AGENTS.md`; create `project/rfc/implemented/.gitkeep` and `project/rfc/rejected/.gitkeep`
- `TPL/project/tasks/AGENTS.md` → `project/tasks/AGENTS.md`
- `TPL/project/pre-release/AGENTS.md` → `project/pre-release/AGENTS.md`
- `TPL/project/research/AGENTS.md` → `project/research/AGENTS.md`; create `project/research/learnings/.gitkeep`

**`docs/` Diátaxis skeleton:** `TPL/docs/**` → `docs/` (index + `reference/ explanation/ how-to/ tutorials/` READMEs).

## Step 3 — Substitute placeholders

Replace across the copied files:
- `{{REPO_NAME}}` → repo name · `{{PKG_NAME}}` → `<scope>/<name>` (per package) ·
  `{{PKG_DESCRIPTION}}` / `{{ONE_LINE_DESCRIPTION}}` → the descriptions.
Verify no `{{` remains: `grep -rn '{{' <repo>` should be empty.

## Step 4 — Author AGENTS.md (+ CLAUDE.md is already `@AGENTS.md`)

Follow the **`authoring-agents-md`** skill to write the repo's root `AGENTS.md` — self-contained to this
repo (no references to any parent workspace), a map of the layout (packages, `project/`, `docs/`), the
source-of-truth table, and the "keeping this file current" loop. For a monorepo, note each package has its
own `AGENTS.md`/README. The `.agents/`↔`.claude/` bridge section applies **only if** this repo adds
repo-wide rules/skills later — document it, don't create empty dirs now. The per-folder `project/*/AGENTS.md`
already carry the lifecycle guidance (they load on-demand in-folder).

## Step 5 — Seed first records (optional)

Offer to create the first ADR (e.g. the stack/shape decision) via **`new-adr`**, and an initial RFC via
**`new-rfc`** if there's an open design. Skip if the user prefers to start empty.

## Step 6 — Initialize & hand off

- `git init`; stage; **do not commit** unless the user asks.
- Print next steps: review `AGENTS.md`, `npm install && npm run typecheck`, `gh repo create` when ready, and
  "agent tooling is the `vibe-ops` plugin — no per-repo skill copies."

## Checklist

- [ ] Target has `README.md`, `GOVERNANCE.md`, `AGENTS.md`, `CLAUDE.md`(@AGENTS.md), `LICENSE`, `.gitignore`, `.editorconfig`
- [ ] Build baseline present; monorepo root `package.json` has `workspaces`, each package has its own `package.json` + tsconfig(.build)
- [ ] `project/` skeleton with per-folder `AGENTS.md` (adr, rfc, tasks, pre-release, research) each linking `../../GOVERNANCE.md`; `project/templates/{adr,rfc,task}.md` present
- [ ] `docs/` Diátaxis skeleton present
- [ ] No `{{PLACEHOLDER}}` remains (`grep -rn '{{'`)
- [ ] `AGENTS.md` passes the `authoring-agents-md` before-commit checklist (self-contained; no personal-memory slugs)
- [ ] `git init` done; not committed unless asked
