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
| [`.agents/`](.agents/) | This repo's own agent config (rules), mirrored into `.claude/` by relative symlink. |
| [`GOVERNANCE.md`](GOVERNANCE.md) | Which artifact answers which question. |

## How this repo works — not obvious from the code

The three hard "don't do this or it breaks" invariants — the `skills/` folder, template copying, and
template filenames — are in [`.agents/rules/repo-guardrails.md`](.agents/rules/repo-guardrails.md),
which loads on its own. Not repeated here.

- **Adding a skill = adding a folder.** `plugin.json` points at the directory; there is no per-skill
  manifest entry. The only other place to update is this file's skill table.
- **Skills delegate instead of duplicating** — `scaffold-new-repo` orchestrates `license-setup` →
  `authoring-agents-md` → `authoring-readme` by name. A rule that governs more than one skill lives in
  [`references/`](references/README.md) and is *pointed at*, never copied into a `SKILL.md`.
- **Every skill declares its kind** — target-state (convergent, idempotent, has an `audit` mode) or event
  (append-only, no update mode). See [`references/convergence-policy.md`](references/convergence-policy.md).
- **Everything this plugin writes into a target repo is in English**, regardless of the conversation's
  language. That is a product guarantee, stated in the README.
- **Frontmatter fields Claude Code honors** in a `SKILL.md`: `name`, `description`,
  `disable-model-invocation`, `argument-hint`, `effort`. `description` is what triggers the skill — it
  must name the situations the skill applies to, not just what it does.

## Skills

| Skill | Does |
|---|---|
| [`scaffold-new-repo`](skills/scaffold-new-repo/SKILL.md) | Brings a repo to the standard baseline — package/build, `project/`, docs, the rules bridge, `AGENTS.md`. Orchestrates the skills below. |
| [`authoring-agents-md`](skills/authoring-agents-md/SKILL.md) | Writes or refreshes an `AGENTS.md` (+ its `CLAUDE.md`). |
| [`authoring-readme`](skills/authoring-readme/SKILL.md) | Writes or cleans up a README as presentation and usage, not process history. |
| [`license-setup`](skills/license-setup/SKILL.md) | `LICENSE`, `NOTICE`/`AUTHORS` for a fork, and optional header enforcement (pre-commit + CI). |
| [`new-adr`](skills/new-adr/SKILL.md) · [`new-rfc`](skills/new-rfc/SKILL.md) · [`new-plan`](skills/new-plan/SKILL.md) · [`new-task`](skills/new-task/SKILL.md) | Create one governance record, using the *target repo's* own template and numbering. |
| [`close-task`](skills/close-task/SKILL.md) | Closes the loop: write back to the source doc, propagate to living docs, spawn an ADR, then distill and delete the dossier. |

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
   being true; a rule is added under `.agents/` (verify it follows the bridge); the plugin gains a build
   step or a manifest field worth knowing about.
3. **Update in place** — adjust the one affected line, keep entries to one line, point at the real
   source of truth instead of restating it.
4. **Fold it into the current task** and mention the edit.
