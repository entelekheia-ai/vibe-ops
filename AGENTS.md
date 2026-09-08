# AGENTS.md — vibe-ops

**Two products from one tree.** [`plugin/`](plugin/AGENTS.md) is a [Claude Code](https://code.claude.com)
plugin — skills that scaffold born-organized repos and author their governance docs, with no build, loaded
straight from this tree. [`cli/`](cli/AGENTS.md) is an npm monorepo whose modules do the deterministic
half, from a terminal or over MCP. The repository root is the npm workspace, so there is exactly one
`node_modules`.

**Each half has its own `AGENTS.md`, and that is where its detail lives** — skills, hooks, the plugin
release and the install cache in `plugin/`; the module contract, the config cascade, the build order and
the npm release in `cli/`. **The two release separately**: the plugin by its version manifest, the
packages through changesets, and neither number moves the other. This file maps the tree and holds only
what belongs to neither half alone. Do not restate them here.

## Layout

A row earns its place by saying something `ls` does not.

| Path | What is not obvious about it |
|---|---|
| [`plugin/`](plugin/AGENTS.md) | The distributable. `.claude-plugin/plugin.json` is its manifest, and `${CLAUDE_PLUGIN_ROOT}` resolves *here*, not to the repository root. |
| [`cli/`](cli/AGENTS.md) | The npm packages. `cli/test/` is the exception to its own name: those are the **plugin's** shell tests, kept out of `plugin/` because they never ship. |
| [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) | Stays at the root while the manifest it points at moved — `source: "./plugin"`. The repository is the marketplace; `plugin/` is the plugin. |
| [`project/`](project/) | This repo's own governance records, and the one folder with a **path-scoped rule** ([`.agents/rules/governance.md`](.agents/rules/governance.md)) that auto-loads only while you work inside it. |

## How this repo works — not obvious from the code

The three "don't do this or it breaks" invariants are in
[`.agents/rules/repo-guardrails.md`](.agents/rules/repo-guardrails.md), which loads on its own.

- **A guard, not a line.** Anything mechanically checkable becomes a check fragment instead of a sentence
  here — and a line here that a new guard makes redundant gets deleted
  ([ADR-0004](project/adr/0004-budgeted-artifacts-and-guards.md)). This file is budgeted at 150 lines;
  over budget the fix is **relocation, not compression** — which is what produced the two nested files.
- **Every `AGENTS.md` has a sibling `CLAUDE.md` containing `@AGENTS.md`.** A nested `AGENTS.md` with no
  sibling and no `@`-import **never enters context on its own**, so its content is not merely unread, it
  is silently unread. The alternative is not writing the file: a path-scoped rule under `.agents/rules/`
  loads exactly when work touches those paths. See
  [`plugin/references/instruction-surfaces.md`](plugin/references/instruction-surfaces.md).
- **The gate is `vibe-ops check`**, and since Plan-038 Track 6 it composes both halves — the shell
  fragments still under `module-check/sh/checks/` and the TypeScript ops declared in `config.ops` — into
  one `N checks, M failed` line, the same composition a consumer's `pre-commit` runs.
  `claude plugin validate . --strict` is the first-party check and reads the manifest and frontmatter
  schemas; this gate is the layer on top, never a replacement.
- **Everything this plugin writes into a target repo is in English**, whatever language the conversation
  is in. That is a product guarantee, stated in the README.

## Agent config layout

`.agents/` is canonical, `.claude/` holds relative symlinks back into it — the same bridge the plugin
ships to other repos. The rules, the commands, the `test -L` check and the Windows fallback are in
[`plugin/references/instruction-surfaces.md`](plugin/references/instruction-surfaces.md), not repeated
here, because that file is also what this plugin tells *other* repos to follow.

## Source of truth

| For | Read |
|---|---|
| The plugin: skills, hooks, releasing, frontmatter | [`plugin/AGENTS.md`](plugin/AGENTS.md) |
| The CLI: modules, config, MCP, build order, npm release | [`cli/AGENTS.md`](cli/AGENTS.md) |
| What a skill does and how | that skill's own `SKILL.md` — never restate it |
| Which artifact answers which question | [`GOVERNANCE.md`](GOVERNANCE.md) |
| Artifact lifecycles, numbering, immutability | [`.agents/rules/governance.md`](.agents/rules/governance.md) |
| Plugin name, version, what's exposed | [`plugin/.claude-plugin/plugin.json`](plugin/.claude-plugin/plugin.json) |
| Install and usage | [`README.md`](README.md) |
| Decisions already settled | [`project/adr/`](project/adr/) |

## Keeping this file current

Updating it is **part of any task that changes the shape of the tree** — a stale map is what this plugin
exists to prevent. Triggers for *this* file specifically: a top-level folder appears or moves; the split
between the two halves changes; a fact stops belonging to both halves and should move down into one of
them. Anything about the plugin or the CLI alone belongs in that half's own `AGENTS.md`, not here.
