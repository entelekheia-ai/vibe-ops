# Research — what belongs in an agent context file

Feeds [ADR-0001](../adr/0001-skill-taxonomy-target-state-vs-event.md) and
[ADR-0003](../adr/0003-instruction-file-architecture.md).

> **Attribution.** External findings are **linked inline at first use** — follow the link for the
> original claim. Anything *not* linked is our own analysis, derived from auditing ~30 context files
> across 7 repositories this plugin was built against. Full source list in
> [`ACKNOWLEDGEMENTS.md`](../../ACKNOWLEDGEMENTS.md).

## What the published research says

Three 2026 studies converge on the same uncomfortable result: more context is not better, and the wrong
context is worse than none.

- The [ETH Zurich evaluation](https://arxiv.org/abs/2602.11988) — 138 real-world tasks, four coding
  agents — found **LLM-generated context files reduced success rates by 0.5–2% while raising inference
  cost by 20–23%.** In five of eight configurations, an auto-generated file was worse than no file.
- Same paper, the mechanism: with all other repository documentation removed, those files suddenly
  *helped* (+2.7%). They had been duplicating what the agents already extracted on their own.
- Same paper: **codebase overviews specifically did not help.** Agents read the directory tree; with an
  overview present they often took *more* steps.
- The inverse result, from a [separate efficiency study](https://arxiv.org/abs/2601.20404): curated
  files with only three content categories (coding conventions, architecture, project description) cut
  median wall-clock time by 28% and output tokens by 16%.
- Adoption is early — an [MSR '26 survey of 10,000 repositories](https://arxiv.org/abs/2510.21413)
  found ~5% carry any context file.

## What practitioners recommend

[Roland Huß — *What Goes in AGENTS.md (and What Doesn't)*](https://ro14nd.de/what-goes-in-agents-md/)
turns the studies above into two lists and a ceiling of **~150 lines**. Both tables are his, condensed:

| Put in — "agents can't discover this on their own" | Leave out — "agents figure this out already" |
|---|---|
| Non-obvious build commands | Codebase overviews |
| Tool-specific choices ("use X, not Y") | Standard framework conventions |
| Testing strategy and its prerequisites | README content |
| Counterintuitive conventions | Dependency lists |
| Hard invariants (X must match Y) | File-by-file descriptions |
| Security boundaries | |
| PR and review expectations | |

His unifying test — **write what the agent cannot discover on its own** — is the one we adopt as the
content filter throughout this plugin.

The same post supplies the split we use between instruction files: `AGENTS.md` for what is universal
across agents, the agent-specific file for what only that agent understands. He measured roughly 55%
universal, 30% agent-specific, 15% universal advice written in agent-specific language, across 38
projects.

## How the file actually reaches the model

Two mechanical facts, both from sources:

- [Anthropic's memory documentation](https://code.claude.com/docs/en/memory) states the context file is
  delivered **as a user message after the system prompt**, not as part of it — so there is no guarantee
  of strict compliance, especially for vague or conflicting instructions. It also states that a rule
  **without** `paths:` frontmatter loads at launch *with the same priority as the context file*, and
  that an instruction which must run at a fixed lifecycle point should be a **hook** instead of a
  sentence.
- [HumanLayer — *Writing a good CLAUDE.md*](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
  documented the envelope: the file arrives wrapped in a system reminder saying the context *may or may
  not be relevant* and should not be acted on unless highly relevant to the task. Their conclusion
  follows directly — the more content in the file that is not universally applicable, the more likely
  the agent discounts it. We confirmed the envelope is still present as described.

**Our reading of the consequence:** because the relevance gate applies to the block *as a whole*, a size
budget is a **correctness** measure, not a cost measure. Padding does not merely cost tokens — it
degrades the instructions that were actually needed. That is a stronger argument for the 150-line ceiling
than the ceiling's original cost rationale.

**Our synthesis — an enforcement ladder**, assembled from the documented facts above and ordered
strongest first:

| Mechanism | Why it sits here |
|---|---|
| **Hook / CI / type / lint** | Executes regardless of what the agent decides. Not ignorable. |
| **Path-scoped rule** (`paths:`) | Loads only when matching files are in play, so it lands in a small, high-relevance block |
| **Always-on rule** ≡ **section of the context file** | Same documented load priority, same relevance gate — the choice between them is organizational, not a compliance difference |
| **Skill** | On demand, and only if the agent selects it |

The load-bearing conclusion is ours: **the only way to raise compliance is to move up this ladder, not
sideways along it.** Splitting an always-on rule out of the context file buys organization — one topic
per file, individually removable — and nothing else.

## An assessment scale

[Gábor Mészáros — *CLAUDE.md best practices: From Basic to Adaptive*](https://dev.to/cleverhoods/claudemd-best-practices-from-basic-to-adaptive-9lm)
([capability-level docs](https://github.com/reporails/rules/blob/main/docs/capability-levels.md))
defines a six-level ladder. Quoted:

```
L0  Absent      → no instruction file
L1  Basic       → a file exists, tracked
L2  Scoped      → project-specific constraints
L3  Structured  → external references, modular
L4  Abstracted  → path-scoped loading
L5  Maintained  → structural discipline
L6  Adaptive    → dynamic context, skills, MCP
```

His observation that the L4→L5 step is **upkeep, not features** is what made it useful to us as a
grading instrument: it names the failure mode where a setup is built once and then rots. We use the
scale to assess an existing repository and to name its next step.

## Field findings — our audit

Everything in this section is our own, from auditing ~30 context files across 7 repositories. The
patterns recur, and every one is **mechanically detectable** — which is our argument for shipping a
validator rather than a checklist.

1. **Terminology drift.** A file described the project's DSL using a file extension the repository had
   renamed away from: 4 mentions of the old name, 0 of the current one, against 0 files of the old type
   and 3 of the new on disk.
2. **Duplicated generated content.** A hand-maintained table reproduced a type definition that a code
   generator already emits into the build output. Two sources of truth, one guaranteed to lag.
3. **File-by-file descriptions.** The single largest section of the largest file — the exact category
   the ETH study identifies as inert.
4. **Runbooks in always-loaded files.** An eight-step troubleshooting procedure occupying permanent
   context to serve an occasional need.
5. **Nested files that never load.** Fifteen context files in subdirectories, none with a sibling
   agent-specific file and none imported by a parent — so none enter context automatically. Good
   content, wrong delivery mechanism.
6. **Byte-identical copies.** Two repositories carried the same 2.2 KB convention file, kept in sync by
   hand. That is a template, not a document.
7. **Pointers to superseded locations.** Three files linked to standalone repositories that had been
   consolidated into a monorepo; the canonical code sat two directories away.
8. **Scope leakage.** A committed repository's file referenced sibling repositories that do not exist
   for anyone who clones it alone.
9. **Programmed staleness.** Hardcoded "Current Status" prose and a manual "Last updated" line, both
   wrong within weeks.

**Our classification**, which is what turned the list into decisions: findings 1, 2, 7, 8 and 9 are
**drift**; 3, 4 and 6 are **misplacement**; 5 is a **delivery-mechanism error**. Only the drift class is
caught by a human re-reading the file — which is why a maintenance loop has to be paired with a script.

## Conclusions carried into decisions

1. **Content selection is the first-order concern, ahead of formatting**, and the filter is
   non-discoverability. *(Huß's test, adopted.)*
2. **A size budget is a correctness measure, not a cost measure.** *(Ours, from the documented relevance
   gate.)*
3. **Prefer a mechanical guard to a sentence** wherever the invariant can be enforced. *(Extends the
   documented hooks guidance into a general rule.)*
4. **A context file should be downstream of what was actually learned, not authored top-down.**
   *(Ours — see [`knowledge-lifecycle.md`](knowledge-lifecycle.md).)*
5. **The maintenance loop needs a validator**, because every finding above is greppable. *(Ours.)*
