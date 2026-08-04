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
- **ODNI — [Intelligence Community Directive 203, *Analytic Standards*](https://www.intelligence.gov/assets/documents/intelligence-community-directives/ICD_203.pdf)**.
  The three moves the research template takes: separating fact from assumption from judgment (with the
  load-bearing assumption stated alongside what changes if it fails), keeping confidence in a judgment
  distinct from the likelihood of an outcome and never fusing them in one sentence, and requiring
  alternatives to be analysed with the indicator that would shift the choice. Read for this plugin through
  a [secondary explainer](https://legalclarity.org/icd-203-analytic-standards-for-all-source-intelligence/),
  because the primary PDF did not yield extractable text.
- **PRISMA-S, via [Imperial College's systematic-review guide](https://library-guides.imperial.ac.uk/systematic-review/documenting_search)**.
  A search is reported **as run** — literal query, tool, date executed, result count — never paraphrased.

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
- **Microsoft — [Technical Spike template](https://microsoft.github.io/code-with-engineering-playbook/design/design-reviews/recipes/templates/template-technical-spike/)**
  (Engineering Fundamentals Playbook). `Conclusions` as a mandatory section that answers the question the
  spike opened with.
- **Maggie Appleton — [Epistemic Disclosure](https://maggieappleton.com/epistemic-disclosure)**, tracing
  the convention from muflax through gwern to Slate Star Codex. The lightweight form of stating how much
  effort went into a piece and how sure the author is.
- **Nielsen Norman Group — [Research Repositories](https://www.nngroup.com/articles/research-repositories/)**
  and Dovetail — [Atomic Research](https://dovetail.com/blog/atomic-research/). Both argue the same point
  about the index rather than the document: a repository of findings is useless if the finding is not
  legible without opening the file. Their tagging-taxonomy advice was considered and not adopted.
- **[`academic-research-skills`](https://github.com/imbad0202/academic-research-skills)** — the largest
  research-skill suite for coding agents, surveyed as prior art. Its pipeline decomposition informed the
  question; its paper-production machinery (rubrics, citation-format conversion, simulated peer review) was
  examined and deliberately not adopted.

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
- **[The Turing Way — Research Compendia](https://book.the-turing-way.org/reproducible-research/compendia/)**
  — data, methods and output separated in a conventional layout with the computational environment
  declared. Surveyed and rejected for this artifact type at its current scale; the trigger that would
  reopen it is recorded in
  [`project/research/research-document-format.md`](project/research/research-document-format.md).
