# Acknowledgements

This file credits the **external** work this plugin builds on: the formats it emits, the studies that
shaped what goes into them, and the practitioners who published the patterns.

It is not the whole story, and the boundary matters. The plugin's own model — the taxonomy of
target-state versus event skills and the four convergence verbs, the learning-promotion test and its
demotion counterpart, the enforcement ladder, and the diagnosis that a repository's empirical learnings
have no defined home — is our own work, derived from auditing real repositories rather than from any
source below. Where the two meet, the seam is marked: the research notes in
[`project/research/`](project/research/) link every external claim inline at first use and state
explicitly which conclusions are ours, and the decisions themselves are recorded in
[`project/adr/`](project/adr/).

## Specifications and official documentation

- **[AGENTS.md](https://agents.md/)** — the open format itself, under the
  [Agentic AI Foundation](https://aaif.io/projects/agents-md/). Reference repository:
  [openai/agents.md](https://github.com/openai/agents.md).
- **Anthropic — [How Claude remembers your project](https://code.claude.com/docs/en/memory)** (Claude
  Code docs). The memory hierarchy, `@` imports, `.claude/rules/` with `paths:` frontmatter, the
  `CLAUDE.md` ↔ `AGENTS.md` relationship, and the guidance to replace a vague instruction with a
  specific one — or with a hook when it must run at a fixed point.
- **OpenAI — [Using PLANS.md for multi-hour problem solving](https://developers.openai.com/cookbook/articles/codex_exec_plans)**
  (OpenAI Cookbook). The ExecPlan contract: a self-contained plan, and the four living sections that
  must stay current — `Progress`, `Surprises & Discoveries`, `Decision Log`,
  `Outcomes & Retrospective`.

## Community analysis

- **Roland Huß — [What Goes in AGENTS.md (and What Doesn't)](https://ro14nd.de/what-goes-in-agents-md/)**.
  The "what goes in / what stays out" tables, the ~150-line ceiling, and the split between AGENTS.md
  (universal) and CLAUDE.md (agent-specific), measured across 38 projects.
- **Gábor Mészáros — [CLAUDE.md best practices: From Basic to Adaptive](https://dev.to/cleverhoods/claudemd-best-practices-from-basic-to-adaptive-9lm)**.
  The L0–L6 capability ladder ([docs](https://github.com/reporails/rules/blob/main/docs/capability-levels.md)).
- **Gábor Mészáros — [The backbone.yml Pattern](https://dev.to/cleverhoods/claudemd-best-practices-the-backboneyml-pattern-30fi)**.
  A map read on demand rather than loaded every session; expressing patterns, relationships, and
  boundaries instead of listing directories; and the warning that structure which rots is worse than
  no structure.
- **Gábor Mészáros — [Mermaid for Workflows](https://dev.to/cleverhoods/claudemd-best-practices-mermaid-for-workflows-khb)**.
  Diagram for topology, prose for rationale.

## Research

- **[ETH Zurich — an evaluation of context files](https://arxiv.org/abs/2602.11988)** across 138
  real-world tasks and four coding agents. LLM-generated context files *reduced* success rates by
  0.5–2% and raised inference cost by 20–23%; codebase overviews did not help; with all repository
  documentation removed, the generated files suddenly did help (+2.7%) — evidence they were
  duplicating what the agents already extracted on their own.
- **[Curated, minimal AGENTS.md files](https://arxiv.org/abs/2601.20404)** — three content categories
  (coding conventions, architecture, project description) cut median wall-clock time by 28% and output
  tokens by 16%.
- **[MSR '26 — a survey of 10,000 repositories](https://arxiv.org/abs/2510.21413)** on context-file
  adoption.
- **[FlowBench — Xiao et al., EMNLP 2024](https://arxiv.org/abs/2406.14884)** — the same workflow
  knowledge given as natural language, pseudo-code, and flowcharts across 51 scenarios: flowcharts gave
  the best trade-off, and combining formats beat any single format.
- **[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119.html)** — the MUST / MUST NOT / SHOULD / NEVER
  keywords.
