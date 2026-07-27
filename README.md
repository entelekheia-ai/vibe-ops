# vibe-ops

A [Claude Code](https://code.claude.com) plugin that makes new repositories **start organized**. Install it
once and, in every repo you open, get a scaffolder for consistent repos and monorepos plus a set of skills
for authoring the governance, license, and documentation a project needs — architecture decisions, RFCs,
tasks, licensing, and READMEs — in English, from one shared source.

## What it does

- **Scaffolds** a born-organized repo or npm-workspaces monorepo: a TypeScript (ESM) package/build baseline,
  a `project/` governance skeleton driven by a single path-scoped rule (not a file per folder), a license, a
  `docs/` skeleton following the [Diátaxis](https://diataxis.fr/) framework, and an `AGENTS.md` map for AI
  collaborators.
- **Authors governance artifacts** through focused skills. Each skill reads the *target repo's own* templates
  and conventions, so one skill adapts to every repo instead of being copied and drifting.
- **Closes the loop.** A task doesn't just get deleted when it's done — closing it writes back to the doc
  that started the work, so plans stay honest about what actually shipped.

## Skills

| Skill | What it does |
|---|---|
| `/vibe-ops:scaffold-new-repo` | Scaffold a new single-package repo or npm-workspaces monorepo — build baseline, a `project/` skeleton (ADR / RFC / tasks / research / log) governed by a path-scoped rule, the `.agents`/`.claude` rules bridge, a license, a Diátaxis `docs/` skeleton, and the `AGENTS.md` / `CLAUDE.md` entry map. |
| `/vibe-ops:authoring-agents-md` | Create or refresh an `AGENTS.md` — the agent-facing entry map for a repo or workspace: self-contained scope, the `.agents/` ↔ `.claude/` config bridge, and a keep-it-current loop. |
| `/vibe-ops:authoring-readme` | Write or clean up a README as pure presentation and usage — strips decision history, process leakage, and status narrative into the right place instead. |
| `/vibe-ops:new-adr` | Scaffold an Architecture Decision Record from the repo's own template and numbering scheme. |
| `/vibe-ops:new-rfc` | Scaffold an RFC (design proposal) from the repo's own template. |
| `/vibe-ops:new-task` | Open a task dossier linked one-to-one with a GitHub issue, following a hybrid Markdown-plus-issue workflow. |
| `/vibe-ops:close-task` | Close a finished task: write back to the doc that started it, propagate to living docs, spawn an ADR if a decision emerged, then distill and delete the dossier. |
| `/vibe-ops:license-setup` | Set up `LICENSE` (+ `NOTICE`/`AUTHORS` for a fork with dual attribution), the license-rules section of `AGENTS.md`, and optional pre-commit + CI header enforcement. |

Skills are namespaced `/vibe-ops:<name>`, invocable by you or automatically by Claude when the task fits.

## How it fits together

The plugin ships the **skills**; each scaffolded repo keeps its **own** templates, license choice, and a
single path-scoped rule carrying its governance lifecycle — which the skills read. One installed plugin —
no per-repo copies to maintain, and every repo's conventions stay the repo's own.

## Install

```bash
# Try it from a local checkout:
claude --plugin-dir ./vibe-ops
claude plugin details vibe-ops

# From the marketplace:
claude plugin marketplace add entelekheia-ai/vibe-ops
claude plugin install vibe-ops@entelekheia
```

## Requirements

- Claude Code with plugin support.
- Scaffolded repos target Node ≥ 22 and TypeScript (ESM) by default — adjust to taste.

## License

Apache-2.0 — see [LICENSE](LICENSE).
