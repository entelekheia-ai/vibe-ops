# AGENTS.md — vibe-ops

A [Claude Code](https://code.claude.com) **plugin**, not a library: it ships skills that scaffold
born-organized repos and author their governance docs. There is no build and no `package.json` — the
repo *is* the distributable, loaded by Claude Code straight from this tree.

## Layout

| Path | What it is |
|---|---|
| [`skills/<name>/SKILL.md`](skills/) | **The product.** One folder per skill; `templates/` beside a SKILL.md holds files that skill copies at runtime. |
| [`references/`](references/) | Shared policy the skills point at instead of restating — the single copy of any rule governing more than one skill. |
| [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) | Manifest — name, version, `"skills": "./skills/"`. |
| [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) | Marketplace entry for installing this plugin. |
| [`project/`](project/) | This repo's own governance records (ADR / RFC / tasks / plans / research / log). |
| [`scripts/check-agents-md.sh`](scripts/check-agents-md.sh) | The guard for everything below — budget, link resolution, the symlink bridge, rule frontmatter. Run it before committing a change to any instruction file; `--self-test` asserts it still fails on a broken repo. |
| [`.github/workflows/`](.github/workflows/) | CI: the validator and its self-test, on every push and PR. |
| [`.agents/`](.agents/) | This repo's own agent config (rules), mirrored into `.claude/` by relative symlink. |
| [`GOVERNANCE.md`](GOVERNANCE.md) | Which artifact answers which question. |

## How this repo works — not obvious from the code

The three hard "don't do this or it breaks" invariants — the `skills/` folder, template copying, and
template filenames — are in [`.agents/rules/repo-guardrails.md`](.agents/rules/repo-guardrails.md),
which loads on its own. Not repeated here.

- **Adding a skill = adding a folder.** `plugin.json` points at the directory; there is no per-skill
  manifest entry. The only other place to update is this file's skill table.
- **Skills delegate instead of duplicating** — `repo-setup` orchestrates `license-setup` →
  `authoring-agents-md` → `authoring-readme` by name. A rule that governs more than one skill lives in
  [`references/`](references/README.md) and is *pointed at*, never copied into a `SKILL.md`.
- **Every skill declares its kind** — target-state (convergent, idempotent, has an `audit` mode) or event
  (append-only, no update mode). See [`references/convergence-policy.md`](references/convergence-policy.md).
- **Everything this plugin writes into a target repo is in English**, regardless of the conversation's
  language. That is a product guarantee, stated in the README.
- **A guard, not a line.** Anything mechanically checkable goes into `scripts/check-agents-md.sh` instead
  of being written here — and a line here that a new guard makes redundant gets deleted
  ([ADR-0004](project/adr/0004-budgeted-artifacts-and-guards.md)). This file is budgeted at 150 lines; over
  budget, relocate content and leave a pointer rather than compressing prose.
- **Frontmatter fields Claude Code honors** in a `SKILL.md`: `name`, `description`, `model`, `effort`,
  `allowed-tools`, `disallowed-tools`, `argument-hint`, `disable-model-invocation`, `user-invocable`,
  `shell`, `when_to_use`. `model` and `effort` are **per skill** — scaffolding a template and routing a
  learning do not deserve the same budget.
- **`disable-model-invocation: true` removes a skill from the model's listing entirely** — it costs zero
  context, and in exchange the model can never trigger it. Only `repo-setup` omits it, because it is the
  entry point. So a new user-invoked skill is free: adding one is not a context decision.
  `description` still matters — it is what the *user* reads, and what triggers the one skill that can be
  triggered.

## Skills

| Skill | Does |
|---|---|
| [`repo-setup`](skills/repo-setup/SKILL.md) | Brings a repo to the standard baseline — package/build, `project/`, docs, the rules bridge, `AGENTS.md`. Orchestrates the skills below. |
| [`authoring-agents-md`](skills/authoring-agents-md/SKILL.md) | Writes or refreshes an `AGENTS.md` (+ its `CLAUDE.md`). |
| [`authoring-readme`](skills/authoring-readme/SKILL.md) | Writes or cleans up a README as presentation and usage, not process history. |
| [`license-setup`](skills/license-setup/SKILL.md) | `LICENSE`, `NOTICE`/`AUTHORS` for a fork, and optional header enforcement (pre-commit + CI). |
| [`new-adr`](skills/new-adr/SKILL.md) · [`new-rfc`](skills/new-rfc/SKILL.md) · [`new-plan`](skills/new-plan/SKILL.md) · [`new-task`](skills/new-task/SKILL.md) | Create one governance record, using the *target repo's* own template and numbering. |
| [`close-task`](skills/close-task/SKILL.md) | Closes the loop: write back to the source doc, propagate to living docs, spawn an ADR, route the learnings, then distill and delete the dossier. |
| [`close-plan`](skills/close-plan/SKILL.md) | The same routing for a plan, which **is not deleted** — retrospective against the goals, the demotion check, issue closed, file kept. |

## Source of truth

| For | Read |
|---|---|
| What a skill does and how | that skill's own `SKILL.md` — never restate it here |
| Which artifact answers which question | [`GOVERNANCE.md`](GOVERNANCE.md) |
| Artifact lifecycles, numbering, immutability | [`.agents/rules/governance.md`](.agents/rules/governance.md) (auto-loads inside `project/`) |
| Plugin name, version, what's exposed | [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) |
| Install and usage | [`README.md`](README.md) |
| Decisions already settled | [`project/adr/`](project/adr/) |

## Agent config layout

This repo uses the same bridge the plugin ships: `.agents/` is canonical, `.claude/` holds relative
symlinks back into it. The rules, the commands, the `test -L` check and the Windows fallback are in
[`references/instruction-surfaces.md`](references/instruction-surfaces.md) — not repeated here, because
that file is also what this plugin tells *other* repos to follow.

## Keeping this file current

Updating this file is **part of any task that changes the plugin's shape** — a stale map is what this
plugin exists to prevent.

1. **Notice drift.** Whenever you `ls skills/` or `ls project/`, compare disk against the tables above.
   A skill listed here that no longer exists, or a folder on disk that isn't described, is the signal.
2. **Trigger conditions:** a skill is added, renamed, or removed; a skill gains or loses a `templates/`
   folder; a file is added to `references/` or a skill stops pointing at one; an invariant above stops
   being true; a rule is added under `.agents/` (verify it follows the bridge); a check is added to or
   removed from the validator; the plugin gains a build step or a manifest field worth knowing about.
3. **Update in place** — adjust the one affected line, keep entries to one line, point at the real
   source of truth instead of restating it.
4. **Fold it into the current task** and mention the edit.
