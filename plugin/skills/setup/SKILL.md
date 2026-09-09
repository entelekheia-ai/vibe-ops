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
| `harness` | what steers the agent and what verifies it — fragments, runner wiring, fixtures, the artifact path | the harness-pair policy (`vibe-ops harness policy --name pair --print`), then Step H |

**`harness audit` is the assessment, and it is a mode of this skill rather than a skill of its own.**
Auditing a repository as a harness and installing one into it are the same knowledge asked two ways: what
the apparatus should be. Splitting them gave two surfaces that both had to know it, and the survey step of
each was the same four shell commands written twice. It reads
the harness-model policy (`vibe-ops harness policy --name model --print`) and writes nothing.

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
`vibe-ops records norm --type base --facet policy --name convergence --print` before
touching anything that is already there; the `adopt` verb is what stops this skill from flattening a
convention the repo settled on deliberately.

---

> **Prefer the MCP tool over the terminal.** This plugin ships its own `vibe-ops` MCP server
> (`.claude-plugin/plugin.json`), so the verbs below are tools, and a tool returns its report as
> structured data instead of terminal text to read back. The tool's full name depends on how the server
> was registered — `mcp__vibe-ops__<noun>` from a project `.mcp.json`, `mcp__plugin_vibe-ops_vibe-ops__<noun>`
> when it comes from the plugin. **If neither is listed, the CLI is correct**: the shell forms shown below
> are the same command, and the server may simply not be running in this session.

## Mode `repo` — Steps 0 to 7

## Step 0 — Survey what already exists

Skip only if the target directory does not exist. Otherwise, before writing anything, produce a **gap
list** against the target state described in Steps 2–5 — each entry marked *missing*, *divergent*, *extra*
or *conflicting*, with the verb to apply.

**Delegate the survey to the `vibe-ops:governance-auditor` agent**, passing the four inputs
`vibe-ops records norm --type base --facet policy --name convergence --print` names — the target path, *this file with
Steps 2–5 as the target state*, that policy, and whether this is an `audit` or the survey ahead of a full
run. It reads the disk with no writing tool, and returns the gap list without spending your context on the
listings. Run the commands below yourself only if the agent is not in the session's listing:

```bash
ls -a "$TARGET"; ls "$TARGET/project" "$TARGET/.agents/rules" "$TARGET/.claude/rules" 2>/dev/null
(cd "$TARGET" && vibe-ops check .)   # skip if $TARGET is not a git repo yet
```

The script reports the mechanical part of the drift — the `AGENTS.md` budget, links that no longer
resolve, and a `.claude/` entry that is a real file where a symlink belongs. Its findings are **part of
the gap list**, not a separate report; each one still needs a verb. It reads the target and writes
nothing into it.

Two divergences are `adopt` by default, not `migrate` — a governance folder that uses a different but
consistent name (`rfcs/` for `rfc/`, a top-level `plans/`), and a `project/` subfolder holding something
other than what the governance rule expects but referenced as authoritative by the repo's own docs. Rename
neither; an adopted folder name is recorded in Step 3a as `records.dirs.<type>`, so every resolver and
gate finds it without the repository restating the default. Report the gap list and the verbs, and
**confirm before writing** — this is the point where the run is destructive if the judgement is wrong.

**The governance bindings are part of the gap list**, one row per `types.<name>` the target needs beyond
the shipped defaults (`license`, `classification`, a type a package brings), read with
`vibe-ops config get types.<name>`: `create` when no layer binds the name; `adopt` when the hand-written
`vibeops.config.ts` already binds it, or the managed file binds it to another package — reported, left
untouched, and the run still exits 0; `leave` for a name the target's own docs bind on purpose to something
else. A binding *is* the install of a governance ([RFC-0004](../../../project/rfc/implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md) §5):
there is no install verb, only this write.

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

**Consult the ownership boundary before writing over anything that exists** (Plan-031). For every
destination the Step 0 survey found already present, ask `vibe-ops records handling <path>…` — it
reports `ownership: <class>` for any path, records or not. A destination whose class is `repo` is
reported and left untouched, whatever the survey concluded; `seed` is written only when absent, which
the survey already enforces and the declaration now grounds; `shaped` belongs to migration, so adoption
may create its skeleton but never rewrites a file that exists there. This check is yours, never the
scaffolder's — its contract is that nothing is left for it to decide.

**Steps 2 and 3 are dispatched to the `vibe-ops:scaffolder` agent**, once the plan is confirmed. Hand it
the target path, the copy list below resolved for the shape chosen in Step 1, the substitution table from
Step 3, and — per destination — what the Step 0 survey decided about anything already there. Nothing is
left for it to decide, which is why it is the one surface here pinned to a cheaper model.

**Its verifier is named, as [ADR-0013](../../../project/adr/0013-the-model-a-shipped-plugin-may-pin.md)
requires:** the `grep -rn '{{'` in Step 3 returning empty, and the Step 7 checklist, which you run
yourself and never delegate. A scaffold that went wrong is red within the minute; that is the whole
licence for the pin, and it lapses if the checklist stops being run.

Do it inline if the agent is not in the session's listing.

**Root (always):**
- `TPL/root/README.md` → `README.md`, `TPL/root/GOVERNANCE.md` → `GOVERNANCE.md`
- `TPL/root/editorconfig` → `.editorconfig`, `TPL/root/gitignore` → `.gitignore`
- `CLAUDE.md` moved out of `TPL` into `@entelekheia/governance-instructions`'s own `scaffold/root/CLAUDE.md`
  (Plan-040 Track 5) — it is the package's scaffold contribution now, not a plugin template; copy it from
  there until `setup scaffold` (Track 6) writes it as part of the composition.

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
`vibe-ops records norm --type instructions --facet policy --name surfaces --print` (see "The `.agents/` ↔
`.claude/` bridge")):
- `TPL/agents/rules/governance.md` → `.agents/rules/governance.md`; symlink
  `ln -s ../../.agents/rules/governance.md .claude/rules/governance.md`
- `repo-guardrails.md` and `agents/skills/.gitkeep` moved out of `TPL` into
  `@entelekheia/governance-instructions`'s own `scaffold/` (Plan-040 Track 5) — copy them from there until
  `setup scaffold` (Track 6) writes them as part of the composition:
  - `scaffold/agents/rules/repo-guardrails.md` → `.agents/rules/repo-guardrails.md` (seed file — leave its
    `TODO` placeholder for the user to fill in or delete, don't invent guardrails); same symlink pattern
    into `.claude/rules/repo-guardrails.md`
  - `scaffold/agents/skills/gitkeep` → `.agents/skills/.gitkeep` (empty — repo-specific skills land here
    later)

**`docs/` Diátaxis skeleton:** `TPL/docs/**` → `docs/` (index + `reference/ explanation/ how-to/ tutorials/` READMEs).

## Step 3 — Substitute placeholders

Replace across the copied files:
- `{{REPO_NAME}}` → repo name · `{{PKG_NAME}}` → `<scope>/<name>` (per package) ·
  `{{PKG_DESCRIPTION}}` / `{{ONE_LINE_DESCRIPTION}}` → the descriptions · `{{LICENSE_ID}}` → the license
  chosen in Step 4 (default `Apache-2.0`).
Verify no `{{` remains: `grep -rn '{{' <repo>` should be empty.

## Step 3a — Bind the governance types

Yours, never the scaffolder's, after Step 3 and before the license. For every binding the Step 0 survey
marked `create`:

```bash
(cd "$TARGET" && vibe-ops config set types.<name> <package>)        # e.g. types.license @entelekheia/governance-license
(cd "$TARGET" && vibe-ops config set records.dirs.<type> <folder>)   # a folder the survey adopted, e.g. records.dirs.rfc project/rfcs
```

It writes one key into `vibeops.config.json` — the **managed** layer, committed, the only config file a
tool writes — and prints `written managed:vibeops.config.json`, plus `shadowed by <layer>:<file>` when a
nearer file still holds the key. A refusal naming a file (the hand-written config already binds the name)
or two packages (the managed file binds it elsewhere) is the survey's `adopt` row arriving late: report it,
touch nothing, exit 0. Write only names whose binding differs from the shipped defaults — a default
restated is a diff that says nothing.

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
  (cd "$TARGET" && vibe-ops check .)
  ```

  A red run here means the skeleton this skill just laid down is broken — most often a `.claude/` symlink
  that git checked out as text on a machine with `core.symlinks=false`. Fix it before handing off; a
  baseline handed over broken is worse than none, because it looks done.

- Verify the bindings landed where Step 3a says: `vibe-ops config list --show-origin` names
  `managed:vibeops.config.json` behind every `types.<name>` written there (and `declared:` behind an adopted
  one), and `vibeops.config.json` is staged — an unstaged managed file is what the
  `config-managed-committed` gate exists to catch.

- **Promulgate the norm, so the repository ends with the managed layer written.** The baseline above lays
  down the templates but records nowhere which template versions were applied or which ownership boundary
  this clone agreed to — that record is `vibeops.config.json`'s `harness.{applied,boundary,agreed}`, and
  only `harness sync` writes it. A repository handed over without it looks finished and is not: `harness
  status` answers *never promulgated to*, and nothing fails. (Measured 2026-09-06: a repository set up
  through both modes of this skill and green on every check still had no managed layer.)

  ```bash
  (cd "$TARGET" && vibe-ops harness sync --dry-run --confirm)                     # what it would write
  (cd "$TARGET" && vibe-ops harness sync --confirm --accept-boundary <installed>)  # <installed> from the dry-run's boundary
  (cd "$TARGET" && git merge --no-ff vibe-ops/norm-<n>)                            # sync stops at a branch on purpose
  (cd "$TARGET" && vibe-ops harness resolve . && vibe-ops config list --show-origin)
  ```

  `sync` is half a ceremony by design — it ends at a branch and a tag and never merges — so the merge is
  this step's, and a first promulgation on a fresh repository is an ordinary fast-forward-sized diff (the
  norm's copies of the five templates plus the managed file). `harness resolve` must then report the
  managed file present and `config list --show-origin` must name `managed:vibeops.config.json` behind
  every `harness.*` key. Do this **before** the CI offer and before hand-off: a promulgation deferred to
  "later" is the one that never happens, because nothing reports its absence.

- **Offer the CI copy — do not install it.** Ask once, and take no for an answer:

  > CI cannot reach an installed plugin, so running this check on every push means copying it into the
  > repository. The copy is a **snapshot**: it will not receive later fixes, and refreshing it is a manual
  > re-copy. Add it?

  Only if the user accepts:

  ```bash
  mkdir -p scripts .github/workflows
  cp "${CLAUDE_PLUGIN_ROOT}/../cli/packages/module-check/sh/check-agents-md.sh" scripts/  # plugin-root-paths: allow
  cp -R "${CLAUDE_PLUGIN_ROOT}/../cli/packages/module-check/sh/checks" scripts/  # plugin-root-paths: allow
  chmod +x scripts/check-agents-md.sh
  cp "${CLAUDE_PLUGIN_ROOT}/skills/setup/templates/github/workflows/check.yml" .github/workflows/
  ./scripts/check-agents-md.sh --self-test && ./scripts/check-agents-md.sh
  ```

  Both must pass before you stage them — a CI job added red is a broken window on day one. Declining is a
  normal outcome and writes nothing; the skill still works without it, because the skills that change
  instruction surfaces run the check from the plugin.

  **This is the one surface still copying fragments, and it is deliberate.** The commit gate moved to
  `vibe-ops check` (Plan-038 Track 5), but CI cannot follow: the CLI is not published to a registry, and
  a CI runner has neither a vibe-ops checkout to link from nor an installed plugin to reach. Until it is
  publishable, a snapshot is the only shape CI can take, and stating that is better than offering a job
  that cannot start.
- Print next steps: review `AGENTS.md`, `npm install && npm run typecheck`, `gh repo create` when ready, and
  "agent tooling is the `vibe-ops` plugin — no per-repo skill copies; closing a task goes through
  `/vibe-ops:close-task`, not a plain delete."

## Mode `harness` — Step H

Read the harness-pair policy first: `vibe-ops harness policy --name pair --print`. It is
the contract; this step is the installation.

### H0 — Survey, with commands rather than composed shell

Four facts decide which recommendations are even available, and getting any of them wrong invalidates
everything after. **Do not compose shell to obtain them** — three verbs answer, and each carries tests
against the specific way its measurement used to go wrong:

```bash
vibe-ops harness resolve "$TARGET"   # which harness surfaces exist here, and which are absent
vibe-ops harness shape   "$TARGET"   # remote, hooks path, CI workflows, churn by top-level directory
vibe-ops harness catalog "$TARGET"   # every gate and fragment this install ships and nothing composes
```

Produce the gap list, verb per gap, exactly as Step 0 does — including the delegation to
`vibe-ops:governance-auditor`, with the harness-pair policy (`vibe-ops harness policy --name pair --print`) and this step as
the target state it is given.

**A repository with no remote cannot have CI**, and that is the single most common wrong recommendation
in this area — it survives review because "add CI" sounds correct everywhere. `harness shape` reports the
remote; read it before offering anything that needs one. For those repositories the commit gate is the
*only* enforcement available, which raises its value rather than lowering it.

**Churn by top-level directory is the least obvious of the four and the most useful:** it says what the
repository is actually *for*. One whose commits are 90% documentation is not under-tested — it is a
governance repository, and the sensors it needs are not the sensors a service needs.

### H0a — If the user asked for `audit`, this is the whole run

Stop before writing anything and report instead. Read
`vibe-ops harness policy --name model --print` — the two axes,
the lifecycle positions, the three tests that turn a gap into a recommendation, and the list of ways this
audit has produced confident nonsense before.

`vibe-ops harness audit "$TARGET"` gives the inventory the grid is filled from: guides with an exact line
count and an always-on/scoped split, sensors with the lifecycle position each fires at, and the governance
overlay. **Every number in the report comes from that command.** One that does not is one somebody
estimated, and the model file's last section is what estimating has cost.

Lead with the grid and one sentence naming which cell is empty. Then the recommendations, each carrying
the command that produced its evidence, a *wire-it* or *build-it* estimate, and where in the lifecycle it
belongs. Then the gaps considered and dropped, with the reason each failed. Then **state what was not
examined** — an audit that reports only findings reads as complete, and no audit of a real repository is.

Write nothing. If the gaps justify sustained work, offer `/vibe-ops:new plan` and stop: number, lifecycle
and template belong to that skill, and reproducing them by hand drops whatever it knows that you skimmed.

### H1 — The apparatus

`TPL=${CLAUDE_PLUGIN_ROOT}/skills/setup/templates/harness`.

- `TPL/checks/_run.sh` → `scripts/checks/_run.sh`. Composition plus the integrity assertion, shared by
  every caller. **This is the load-bearing file**: without it, a bare `vibe-ops check` composes only the
  built-ins, omits every fragment the repository owns, and still reports success.
- `TPL/check.sh` → `scripts/check.sh`, `chmod +x`. The manual entrypoint, so the correct invocation has a
  name shorter than the mistake.
- `TPL/githooks/pre-commit` → `.githooks/pre-commit`, `chmod +x` — **offer, do not assume**. Then
  `git config core.hooksPath .githooks`, which is local config that no clone inherits.
- `scripts/checks/` — create it. It holds this repository's own fragments and starts empty.

**The gate is `vibe-ops` on `PATH`, and nothing is copied into `$TARGET`.** `_run.sh` runs
`vibe-ops check`; there is no snapshot to take, no sibling checkout to resolve, and nothing that goes
stale — which is what three resolution branches and a copied-in runner existed to manage.

State the requirement out loud, because it is the one thing that can leave a repository without a gate:

> The commit gate runs the `vibe-ops` CLI. A machine without it on `PATH` gets a refusal, not a silent
> pass — including a contributor who clones this repository on its own. Install it with
> `npm link -w @entelekheia/vibe-ops-cli` from a vibe-ops checkout.

This is the same precondition the plugin already carries everywhere else — its MCP server is started as
`vibe-ops mcp` from `PATH`, and its skill-scoped hooks name the same binary — so a machine that can run
this skill can already run the gate. Verify it anyway rather than assuming: `command -v vibe-ops`.

### H2 — Prove it before handing it over

```bash
command -v vibe-ops                                 # the gate's only requirement, checked first
vibe-ops check --self-test                          # every detector still fails a broken fixture
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

**Then confirm the managed layer exists.** `vibe-ops harness resolve "$TARGET"` reports `managed:
vibeops.config.json`; absent means the repository was never promulgated to, and the gate above is running
against templates whose applied versions nobody recorded. Run the promulgation from Step 7 of mode `repo`
(`harness sync` dry-run, sync with the boundary accepted, merge the branch) — it is idempotent on a
repository already promulgated to, and `harness status` must report nothing behind afterwards.

### H3 — One worked example, or an honest empty

A harness composing only the built-ins is a repository that has not yet written down a rule of its own,
which is a real answer rather than a gap. Offer `/vibe-ops:new-signal` for the first one and take no for
an answer.

**Say what that offer can and cannot deliver here.** A detector is a gate now, and a gate must import
`@entelekheia/vibe-ops-core`, which is not published — so outside the vibe-ops checkout `new-signal`
writes the guide and stops, naming the guard as waiting on publication. That is a complete and useful
half; presenting it as a whole one is what makes someone go looking for a gate file that was never
written.

Do **not** write a fragment from here. Naming a rule, writing the guard, and building the fixture it
fails are one act with its own skill; reproducing it inline is how the fixture requirement gets dropped.

### H4 — Report

Say which of the three the repository now has — fragment directory, manual entrypoint, commit gate — and
which it declined. Name `core.hooksPath` explicitly if the gate was installed: it is local config, it
does not travel with a clone, and a tracked hook nobody wired is silently absent. Name the `vibe-ops`
requirement too: it is the one thing that can leave a fully-installed harness unable to run.

## Checklist — mode `harness`

- [ ] The mode was chosen by the user, not inferred
- [ ] `scripts/checks/_run.sh` present; `scripts/check.sh` present and executable
- [ ] `command -v vibe-ops` resolves, and the requirement was stated out loud in the report
- [ ] `vibe-ops check --self-test` passes and `check.sh` is green **before** hand-off
- [ ] The composition assertion was proven by moving `scripts/checks/` away and observing a failure —
      not by reading `_run.sh`
- [ ] If the gate was installed: `core.hooksPath` set, and named in the report as local-only config
- [ ] `harness resolve` reports the managed `vibeops.config.json` present; `harness status` reports nothing behind
- [ ] No detector was written from this skill; `new-signal` was offered, with its publication limit stated, and its refusal recorded
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
- [ ] Every non-default `types.<name>` from the survey is bound (`create` written to the managed file, `adopt`
      reported untouched); `config list --show-origin` confirms the origin; `vibeops.config.json` is staged
- [ ] `license-setup` completed (real `LICENSE` text, not the plugin's own; `AGENTS.md` license-rules section present)
- [ ] `vibe-ops check "$TARGET"` run after staging, and green
- [ ] The norm was promulgated and merged: `vibeops.config.json` carries `harness.applied` for every
      template type, `harness.boundary`, and `harness.agreed`; `harness status` reports nothing behind
- [ ] The CI copy was **offered once**; if accepted, both CI steps pass locally before staging — if
      declined, the target has no `scripts/` and no `.github/workflows/check.yml`
- [ ] `AGENTS.md` passes the `authoring-agents-md` before-commit checklist (self-contained; no personal-memory slugs)
- [ ] `README.md` (and each package's) passes the `authoring-readme` checklist
- [ ] `git init` done; not committed unless asked
