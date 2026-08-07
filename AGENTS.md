# AGENTS.md — vibe-ops

A [Claude Code](https://code.claude.com) **plugin**, not a library: it ships skills that scaffold
born-organized repos and author their governance docs. There is no build and no `package.json` — the
repo *is* the distributable, loaded by Claude Code straight from this tree.

## Layout

A row earns its place here by saying something `ls` does not. Folders whose names explain themselves are
deliberately absent; where a file is the authority on something, it is named in **Source of truth** below
instead of twice.

| Path | What is not obvious about it |
|---|---|
| [`skills/<name>/SKILL.md`](skills/) | **The product** — what the plugin ships and what Claude Code loads. A `templates/` folder beside a SKILL.md holds files that skill copies at runtime; it is never inlined into the SKILL.md. A skill may also ship tooling it *runs* rather than copies — `license-setup/get-license.sh` + its pinned `licenses/`, the only sanctioned way a LICENSE is produced ([ADR-0008](project/adr/0008-license-text-is-fetched-and-verified.md)). |
| [`hooks/`](hooks/) | The plugin's only always-on surface — auto-discovered from `hooks/hooks.json`, no manifest entry. Everything else here is opt-in and costs nothing until invoked; a hook fires in **every** repository where the plugin is installed, so each one carries its own cheap exit as its first act. Why this surface exists at all: [`project/research/positioned-context-and-hooks.md`](project/research/positioned-context-and-hooks.md). |
| [`references/`](references/) | Shared policy the skills point at instead of restating — the single copy of any rule governing more than one skill. |
| [`project/`](project/) | This repo's own governance records, and the one folder with a **path-scoped rule** ([`.agents/rules/governance.md`](.agents/rules/governance.md)) that auto-loads only while you are working inside it. |
| [`scripts/`](scripts/) | Two kinds of tooling that must not be confused. `resolve-governance.sh` and `session-touched-repos.sh` are **runtime** — the plugin runs them inside a target repo; the former is what `/new` calls instead of rediscovering the repo, the latter is what the `Stop` hook calls to attribute a turn's writes to a repository from the session transcript, never from `cwd`. `check-agents-md.sh` is **development** — the guard for everything below. Checks **the repo you point it at**, composing one fragment per check from [`scripts/checks/`](scripts/checks/); `--list` shows what it assembled, `--self-test` asserts it still fails on a broken repo. `measure-nudge-noise.sh` is development too, and is the only instrument for the one thing a hook cannot observe about itself: what the model did after it fired. |

## How this repo works — not obvious from the code

The three hard "don't do this or it breaks" invariants — the `skills/` folder, template copying, and
template filenames — are in [`.agents/rules/repo-guardrails.md`](.agents/rules/repo-guardrails.md),
which loads on its own. Not repeated here.

- **Adding a skill = adding a folder.** `plugin.json` points at the directory; there is no per-skill
  manifest entry. The only other place to update is this file's skill table.
- **A hook is not a cheaper way to write a line.** It earns its place only by delivering something a line
  cannot: state read from disk at that instant, or context placed at a moment an instruction file cannot
  reach. It must also be testable without a release. `claude --plugin-dir <this tree>` is the intended
  way; **it did not deliver a `Stop` hook in a headless `-p` run** (measured 2026-08-06 on
  claude-code@2.1.221 — no such attachment reached the transcript at all), and a session-scoped hook has
  a second problem on top of that: each `-p` invocation ends its session, so `SessionEnd` clears the
  per-session state and every resumed turn arrives as a *first* event. Exercise anything session-scoped
  in a real session, or against fixtures through `scripts/checks/` — `27-nudge-behaviour.sh` runs a hook
  end to end with a synthetic payload and is the pattern to copy.
- **Skills delegate instead of duplicating** — `repo-setup` orchestrates `license-setup` →
  `authoring-agents-md` → `authoring-readme` by name. A rule that governs more than one skill lives in
  [`references/`](references/README.md) and is *pointed at*, never copied into a `SKILL.md`.
- **Every skill declares its kind** — target-state (convergent, idempotent, has an `audit` mode) or event
  (append-only, no update mode). See [`references/convergence-policy.md`](references/convergence-policy.md).
- **Everything this plugin writes into a target repo is in English**, regardless of the conversation's
  language. That is a product guarantee, stated in the README.
- **No release is being cut, and that is the current policy, not a backlog.** The version stays at the
  `plugin.json` value; work accumulates under `[Unreleased]` and reaches no marketplace. The plugin is
  installed from a **directory source** and exercised in place — `installLocation` is this tree, skills
  load from it, every edit is live in the next session. So: **do not bump `plugin.json` or
  `marketplace.json`**, and treat "delivered only once a release is cut" as suspended while the freeze
  holds — here, the tree *is* the install. The freeze ends when the maintainer decides what shape this
  plugin is derived into, not when enough features pile up.
- **When releasing resumes, that rule comes straight back.** From a git-source marketplace the plugin is a
  clone pinned to the version in `plugin.json` (`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`)
  and `${CLAUDE_PLUGIN_ROOT}` resolves *there*, not into this tree — so a feature whose invocation path is
  a new file is unreachable in every install until the version moves. That the path exists here is checked
  by `plugin-root-paths`; that it existed at the last release is the part you have to think about.
- **`claude plugin validate . --strict` is the first-party check**, and it is the only one that reads the
  manifest and frontmatter schemas — `check-agents-md.sh` is this repo's own layer on top, never a
  replacement. Setting `version` in both manifests is what the docs warn against; `manifest-sync` keeping
  them equal is what makes it safe here.
- **A guard, not a line.** Anything mechanically checkable becomes a fragment under `scripts/checks/`
  instead of being written here — and a line here that a new guard makes redundant gets deleted
  ([ADR-0004](project/adr/0004-budgeted-artifacts-and-guards.md)). This file is budgeted at 150 lines; over
  budget, relocate content and leave a pointer rather than compressing prose.
- **Frontmatter fields Claude Code honors** in a `SKILL.md`: `name`, `description`, `model`, `effort`,
  `allowed-tools`, `disallowed-tools`, `argument-hint`, `disable-model-invocation`, `user-invocable`,
  `shell`, `when_to_use`. `model` and `effort` are **per skill** — scaffolding a template and routing a
  learning do not deserve the same budget.
- **No skill sets `disable-model-invocation`.** The flag removes a skill from the model's listing
  entirely — zero context cost, and in exchange it can only ever fire from a typed `/command`, including
  when the user asks for exactly that job in plain language. That failure is silent and looks like the
  skill not working. Every skill here is model-invocable. **A model-invocable skill must confirm before any
  irreversible step**, since the user may not have asked for the run.
- **The skill listing is a fraction of the context window, shared with every other installed plugin — not
  a fixed budget and not this plugin's to spend.** `skillListingBudgetFraction` defaults to 1% of the
  context window in characters, with a 1,536-character cap per skill, so quoting a fixed number here would
  be wrong on a different model. That sharing is why the four record-creating skills became one
  `/new <type>`: they cost 1,436 characters between them and now cost ~380, and the space goes back to
  whatever else the user has installed. Measure before adding a skill with
  `claude plugin details vibe-ops@<marketplace>`, which reports the projected always-on cost per
  component; hooks are harness-only and cost nothing here.
- **Never set `model:` in a shipped skill.** It silently overrides the user's own session choice. `effort`
  is a per-task budget hint and is fine; the model is the user's call. A small model in particular
  fabricates sections to fill a template even with no source material — exactly what `/new`'s plan
  migration mode warns against — so pinning one there would install the failure it documents.
- **Don't use `when_to_use`.** The listing renders it as `description - when_to_use`, so it becomes a
  second home for trigger text. Keep the triggers in `description`; one copy.

## Skills

| Skill | Does |
|---|---|
| [`repo-setup`](skills/repo-setup/SKILL.md) | Brings a repo to the standard baseline — package/build, `project/`, docs, the rules bridge, `AGENTS.md`. Orchestrates the skills below. |
| [`authoring-agents-md`](skills/authoring-agents-md/SKILL.md) | Writes or refreshes an `AGENTS.md` (+ its `CLAUDE.md`). |
| [`authoring-readme`](skills/authoring-readme/SKILL.md) | Writes or cleans up a README as presentation and usage, not process history. |
| [`license-setup`](skills/license-setup/SKILL.md) | `LICENSE`, `NOTICE`/`AUTHORS` for a fork, and optional header enforcement (CI, or an opt-in local hook). |
| [`new`](skills/new/SKILL.md) | Creates one governance record of any of the four kinds, using the *target repo's* own template and numbering. The body holds only what all four share; what diverges lives in [`references/records/<type>.md`](references/records/) and is delivered by the resolver, so only the one matching the argument is ever read. |
| [`close`](skills/close/SKILL.md) | Closes the loop for a task or a plan: write back, propagate to living docs, route the learnings. A task dossier is distilled and deleted; a plan's file **is not deleted** — retrospective against the goals, the demotion check, issue closed, file kept. |

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
