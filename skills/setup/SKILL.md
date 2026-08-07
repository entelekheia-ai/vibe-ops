---
name: setup
description: 'Bring a repository to a standard baseline, in one of two modes. "repo" is the born-organized baseline — single-package or npm-workspaces monorepo, English docs: the package/build baseline, a project/ governance skeleton (ADR/RFC/tasks/plans/research/log, governed by a path-scoped rule), the .agents/.claude rules bridge, a license, a docs/ Diátaxis skeleton, and the AGENTS.md config map. "harness" is the guide-and-sensor apparatus — a fragment directory composed into the governance runner, the manual entrypoint, the optional commit gate, the fixture convention, and the artifact path a signal reports through. Sets up or reconciles either; use when creating/bootstrapping a repo or package, when adding mechanical checks to one that only has prose, or when an existing repo has drifted — pass "audit" to report the gaps without writing.'
argument-hint: "<repo|harness> [<repo-name>] [audit]"
effort: inherit
---

# /setup — a repo born organized, and a harness that can tell whether it worked

Two modes, because a repository baseline and a *harness* baseline are different jobs that shared a name
for too long:

| Mode | Brings to baseline | Read first |
|---|---|---|
| `repo` | the repository — package/build, `project/`, docs, the rules bridge, `AGENTS.md`, a license | Steps 0–7 below |
| `harness` | what steers the agent and what verifies it — fragments, runner wiring, fixtures, the artifact path | [`harness-pair.md`](../../references/harness-pair.md), then Step H |

**If the user did not say which, ask.** Do not infer from the topic: "set up this repo" means `repo` about
as often as it means "it has an `AGENTS.md` and nothing checks it", and the two write into different
places. `/vibe-ops:setup repo <name>` and `/vibe-ops:setup harness` are the two invocations.

A light **orchestrator** either way: it lays down a consistent, English-documented skeleton from templates
and delegates detailed authoring to sibling skills, so that every repo carries the same governance, docs
and config. It is run just as often on a repo that already exists and has drifted as on an empty
directory — the baseline is the target either way.

**Templates live in the plugin** at `${CLAUDE_PLUGIN_ROOT}/skills/setup/templates/`. Copy from
there; never invent structure from memory. Files named `gitignore`/`editorconfig`/`gitkeep` are copied to
`.gitignore`/`.editorconfig`/`.gitkeep` — and `templates/harness/githooks/` lands as `.githooks/`;
`{{PLACEHOLDERS}}` are substituted (Step 3).

**This is a target-state skill, in both modes.** The templates *are* the target state, and it is applied
to repositories that already exist as often as to new ones — an empty directory is simply the maximum-gap
case. Read
[`${CLAUDE_PLUGIN_ROOT}/references/convergence-policy.md`](../../references/convergence-policy.md) before
touching anything that is already there; the `adopt` verb is what stops this skill from flattening a
convention the repo settled on deliberately.

---

## Mode `repo` — Steps 0 to 7

## Step 0 — Survey what already exists

Skip only if the target directory does not exist. Otherwise, before writing anything, produce a **gap
list** against the target state described in Steps 2–5 — each entry marked *missing*, *divergent*, *extra*
or *conflicting*, with the verb to apply:

```bash
ls -a "$TARGET"; ls "$TARGET/project" "$TARGET/.agents/rules" "$TARGET/.claude/rules" 2>/dev/null
"${CLAUDE_PLUGIN_ROOT}/scripts/check-agents-md.sh" "$TARGET"   # skip if $TARGET is not a git repo yet
```

The script reports the mechanical part of the drift — the `AGENTS.md` budget, links that no longer
resolve, and a `.claude/` entry that is a real file where a symlink belongs. Its findings are **part of
the gap list**, not a separate report; each one still needs a verb. It reads the target and writes
nothing into it.

Two divergences are `adopt` by default, not `migrate` — a governance folder that uses a different but
consistent name (`rfcs/` for `rfc/`, a top-level `plans/`), and a `project/` subfolder holding something
other than what the governance rule expects but referenced as authoritative by the repo's own docs. Rename
neither. Report the gap list and the verbs, and **confirm before writing** — this is the point where the
run is destructive if the judgement is wrong.

If the user asked for an `audit`, stop here: report the gap list and write nothing.

## Step 1 — Gather inputs

Ask (accept the `/setup repo` argument as the repo name):

1. **Repo name** (kebab-case) and **target path** (default: a sibling dir `../<repo-name>`, or the user's choice).
2. **Shape** — single-package **or** monorepo (npm workspaces). Default to what the user describes; if they
   say "several packages / monorepo", use monorepo.
3. **npm scope** — default `@entelekheia`. Full package name is `<scope>/<name>`.
4. **One-line description** (for README + package.json).
5. **First package(s)** — for a monorepo, at least one under `packages/`; for single-package, the root is the package.

Confirm the plan (shape + names + path) before writing.

## Step 2 — Lay down the tree

Create the target directory and copy templates. `TPL=${CLAUDE_PLUGIN_ROOT}/skills/setup/templates`.

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
- Verify the baseline mechanically — the checks run against tracked files, so this comes after staging:

  ```bash
  "${CLAUDE_PLUGIN_ROOT}/scripts/check-agents-md.sh" "$TARGET"
  ```

  A red run here means the skeleton this skill just laid down is broken — most often a `.claude/` symlink
  that git checked out as text on a machine with `core.symlinks=false`. Fix it before handing off; a
  baseline handed over broken is worse than none, because it looks done.

- **Offer the CI copy — do not install it.** Ask once, and take no for an answer:

  > CI cannot reach an installed plugin, so running this check on every push means copying it into the
  > repository. The copy is a **snapshot**: it will not receive later fixes, and refreshing it is a manual
  > re-copy. Add it?

  Only if the user accepts:

  ```bash
  mkdir -p scripts .github/workflows
  cp "${CLAUDE_PLUGIN_ROOT}/scripts/check-agents-md.sh" scripts/
  cp -R "${CLAUDE_PLUGIN_ROOT}/scripts/checks" scripts/
  chmod +x scripts/check-agents-md.sh
  cp "${CLAUDE_PLUGIN_ROOT}/skills/setup/templates/github/workflows/check.yml" .github/workflows/
  ./scripts/check-agents-md.sh --self-test && ./scripts/check-agents-md.sh
  ```

  Both must pass before you stage them — a CI job added red is a broken window on day one. Declining is a
  normal outcome and writes nothing; the skill still works without it, because the skills that change
  instruction surfaces run the check from the plugin.
- Print next steps: review `AGENTS.md`, `npm install && npm run typecheck`, `gh repo create` when ready, and
  "agent tooling is the `vibe-ops` plugin — no per-repo skill copies; closing a task goes through
  `/vibe-ops:close task`, not a plain delete."

## Mode `harness` — Step H

Read [`${CLAUDE_PLUGIN_ROOT}/references/harness-pair.md`](../../references/harness-pair.md) first. It is
the contract; this step is the installation.

### H0 — Survey, and decide whether a gate is even available

```bash
git -C "$TARGET" remote -v                    # no remote → CI is not an option; say so, do not offer it
git -C "$TARGET" config core.hooksPath        # where hooks would live, if any
ls "$TARGET/scripts/checks/" 2>/dev/null      # fragments already here?
ls "$TARGET/scripts/check-agents-md.sh" 2>/dev/null   # a runner snapshot already copied in?
```

Produce the gap list, verb per gap, exactly as Step 0 does. If the user asked for `audit`, stop here.

**A repository with no remote cannot have CI**, and that is the single most common wrong recommendation
in this area — it survives review because "add CI" sounds correct everywhere. For those repositories the
commit gate is the *only* enforcement available, which raises its value rather than lowering it.

### H1 — The apparatus

`TPL=${CLAUDE_PLUGIN_ROOT}/skills/setup/templates/harness`.

- `TPL/checks/_run.sh` → `scripts/checks/_run.sh`. Composition plus the integrity assertion, shared by
  every caller. **This is the load-bearing file**: without it, a bare run of the runner composes only the
  built-ins, omits every fragment the repository owns, and still reports success.
- `TPL/check.sh` → `scripts/check.sh`, `chmod +x`. The manual entrypoint, so the correct invocation has a
  name shorter than the mistake.
- `TPL/githooks/pre-commit` → `.githooks/pre-commit`, `chmod +x` — **offer, do not assume**. Then
  `git config core.hooksPath .githooks`, which is local config that no clone inherits.
- `scripts/checks/` — create it. It holds this repository's own fragments and starts empty.

**The runner has to be reachable from a hook, and a hook has no `CLAUDE_PLUGIN_ROOT`.** So a repository
that wants the gate also needs the runner copied in — the same snapshot Step 7 offers for CI, and with
the same caveat stated out loud: it does not update itself, and refreshing it is a deliberate re-copy.
`_run.sh` prefers that copy when it exists and falls back to the plugin otherwise, so an agent-run check
and a hook-run check are the same code in a repository that has both.

```bash
mkdir -p "$TARGET/scripts"
cp "${CLAUDE_PLUGIN_ROOT}/scripts/check-agents-md.sh" "$TARGET/scripts/"
cp -R "${CLAUDE_PLUGIN_ROOT}/scripts/checks" "$TARGET/scripts/"    # the built-in fragments
chmod +x "$TARGET/scripts/check-agents-md.sh"
```

### H2 — Prove it before handing it over

```bash
"$TARGET/scripts/check-agents-md.sh" --self-test    # the runner still fails a broken repository
"$TARGET/scripts/check.sh"                          # this repository is green through the real path
```

Both must pass. **A gate handed over red is worse than none, because it looks done** — and the first
thing anyone does with a red gate they did not cause is `--no-verify`, which switches off every other
check at the same time.

Then prove the composition assertion is real, which no green run can show you:

```bash
mv "$TARGET/scripts/checks" "$TARGET/scripts/checks.off" && "$TARGET/scripts/check.sh"; \
  mv "$TARGET/scripts/checks.off" "$TARGET/scripts/checks"
```

That must **fail**, naming the missing directory. If it passes, the gate would silently report success
while running none of the repository's own rules, which is the exact failure `_run.sh` exists to prevent.

### H3 — One worked example, or an honest empty

A harness with no fragments is scaffolding. Offer `/vibe-ops:new-signal` for the first one, and take no
for an answer — a repository whose rules are not yet written down has nothing to guard, and that is a
real answer rather than a gap.

Do **not** write a fragment from here. Naming a rule, writing the guard, and building the fixture it
fails are one act with its own skill; reproducing it inline is how the fixture requirement gets dropped.

### H4 — Report

Say which of the four the repository now has — fragment directory, manual entrypoint, commit gate,
runner snapshot — and which it declined. Name `core.hooksPath` explicitly if the gate was installed: it
is local config, it does not travel with a clone, and a tracked hook nobody wired is silently absent.

## Checklist — mode `harness`

- [ ] The mode was chosen by the user, not inferred
- [ ] `scripts/checks/_run.sh` present; `scripts/check.sh` present and executable
- [ ] Runner snapshot copied in **if** a hook was installed, and its snapshot nature stated out loud
- [ ] `--self-test` passes and `check.sh` is green **before** hand-off
- [ ] The composition assertion was proven by moving `scripts/checks/` away and observing a failure —
      not by reading `_run.sh`
- [ ] If the gate was installed: `core.hooksPath` set, and named in the report as local-only config
- [ ] No fragment was written from this skill; `new-signal` was offered and its refusal recorded
- [ ] No CI was recommended for a repository with no remote

## Checklist — mode `repo`

- [ ] Target has `README.md`, `GOVERNANCE.md`, `AGENTS.md`, `CLAUDE.md`(@AGENTS.md), `LICENSE`, `.gitignore`, `.editorconfig`
- [ ] Build baseline present; monorepo root `package.json` has `workspaces`, each package has its own `package.json` + tsconfig(.build)
- [ ] `project/` skeleton present (`adr rfc tasks plans research log templates`, each non-empty via `.gitkeep`
      if no content yet); `project/templates/{adr,rfc,task,plan}.md` present; **no** per-folder `AGENTS.md`
      (that's the rule's job)
- [ ] `.agents/rules/{governance,repo-guardrails}.md` exist, each symlinked from `.claude/rules/`; `.agents/skills/` present (empty)
- [ ] `docs/` Diátaxis skeleton present
- [ ] No `{{PLACEHOLDER}}` remains (`grep -rn '{{'`)
- [ ] `license-setup` completed (real `LICENSE` text, not the plugin's own; `AGENTS.md` license-rules section present)
- [ ] `check-agents-md.sh` run against the target after staging, and green
- [ ] The CI copy was **offered once**; if accepted, both CI steps pass locally before staging — if
      declined, the target has no `scripts/` and no `.github/workflows/check.yml`
- [ ] `AGENTS.md` passes the `authoring-agents-md` before-commit checklist (self-contained; no personal-memory slugs)
- [ ] `README.md` (and each package's) passes the `authoring-readme` checklist
- [ ] `git init` done; not committed unless asked
