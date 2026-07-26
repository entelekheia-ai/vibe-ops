# vibe-ops

A [Claude Code](https://code.claude.com) plugin that makes new repositories **start organized**. Install it
once and, in every repo you open, get a scaffolder for consistent repos and monorepos plus a set of skills
for authoring the governance and documentation a project needs — architecture decisions, RFCs, tasks, and
learnings — in English, from one shared source.

## What it does

- **Scaffolds** a born-organized repo or npm-workspaces monorepo: a TypeScript (ESM) package/build baseline,
  a `project/` governance skeleton, a `docs/` skeleton following the [Diátaxis](https://diataxis.fr/)
  framework, and an `AGENTS.md` map for AI collaborators.
- **Authors governance artifacts** through focused skills. Each skill reads the *target repo's own* templates
  and conventions, so one skill adapts to every repo instead of being copied and drifting.

## Skills

| Skill | What it does |
|---|---|
| `/vibe-ops:scaffold-new-repo` | Scaffold a new single-package repo or npm-workspaces monorepo — build baseline, a `project/` skeleton (ADR / RFC / tasks / research, each with a per-folder lifecycle `AGENTS.md`), a Diátaxis `docs/` skeleton, and the `AGENTS.md` / `CLAUDE.md` entry map. |
| `/vibe-ops:authoring-agents-md` | Create or refresh an `AGENTS.md` — the agent-facing entry map for a repo or workspace: self-contained scope, the `.agents/` ↔ `.claude/` config bridge, and a keep-it-current loop. |
| `/vibe-ops:new-adr` | Scaffold an Architecture Decision Record from the repo's own template and numbering scheme. |
| `/vibe-ops:new-rfc` | Scaffold an RFC (design proposal) from the repo's own template. |
| `/vibe-ops:new-task` | Open a task dossier linked one-to-one with a GitHub issue, following a hybrid Markdown-plus-issue workflow. |
| `/vibe-ops:new-learning` | Capture a durable, reusable lesson in `research/learnings/`. |

Skills are namespaced `/vibe-ops:<name>`, invocable by you or automatically by Claude when the task fits.

## How it fits together

The plugin ships the **skills**; each scaffolded repo keeps its **own** templates and per-folder lifecycle
docs, which the skills read. One installed plugin — no per-repo copies to maintain, and every repo's
conventions stay the repo's own.

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
