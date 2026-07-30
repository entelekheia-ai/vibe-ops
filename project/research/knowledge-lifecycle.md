# Research — where knowledge goes after the work is done

Feeds [ADR-0002](../adr/0002-knowledge-lifecycle.md).

> **Attribution.** External findings are **linked inline at first use** — follow the link for the
> original claim. Anything *not* linked is our own analysis, derived from auditing the repositories this
> plugin was built against and from reading this plugin's own skills and governance rule. Full source
> list in [`ACKNOWLEDGEMENTS.md`](../../ACKNOWLEDGEMENTS.md).
>
> The diagnosis in the first section, the promotion test, and the two format verdicts are ours. The
> ExecPlan contract is OpenAI's; the format research is cited where used.

## Our diagnosis: three pipelines, and one of them has no home

This section is original analysis, from auditing several codebases and reading this plugin's own
`new-plan`, `close-task` and `project/**` governance rule.

A repository that records its work well still tends to have exactly two working pipelines:

| Pipeline | Artifact | Typical state |
|---|---|---|
| **Working memory** — lives while the work does | plan, task dossier | has a template, a skill, a lifecycle |
| **Durable structured knowledge** — decisions | ADR, RFC | has a template, a lifecycle, immutability rules |
| **Empirical learning** — the non-obvious fact discovered mid-flight | — | **no defined home** |

The third is the valuable one, and the reason is external: it is precisely the category the research
identifies as the only content that helps an agent — *what it cannot discover on its own* (see
[`context-file-practices.md`](context-file-practices.md)). Our addition is the corollary: **the only
reliable source of such facts is what an agent already failed to discover.** Which means the third
pipeline is not a nice-to-have; it is the supply chain for the context file.

Observed across several codebases, the same unmet need produced four incompatible shapes: a
per-work-unit log frozen per release; a log paired one-to-one with a decision record; a single
monolithic learnings file organized by project phase, grown past 50 KB with no lifecycle; and the
maintainer's own private notes, duplicating the third.

**Two structural gaps explain it**, both found by reading this plugin's own skills:

1. **The plan is not a living document.** `new-plan` scaffolds one and stops. No named section exists
   where a discovery lands *while* the work happens — so every project invents one ad hoc.
2. **The log exists only as a companion to a decision.** The governance rule defines `project/log/` as
   optional and paired 1:1 with an ADR — so a learning not attached to a decision has nowhere to live,
   and most learnings are not attached to a decision.

**The compound effect**, which is the finding that drove ADR-0002: `close-task` step 3 propagates
*code → docs* ("did this change break a doc?") but nothing propagates *knowledge → context* ("what did
we learn that the context file should now carry?"). So the context file is authored top-down, from what
the author remembers, when its only reliable source is the pipeline that has no home.

## What the ExecPlan contract contributes

From [OpenAI — *Using PLANS.md for multi-hour problem solving*](https://developers.openai.com/cookbook/articles/codex_exec_plans).
Their contract treats the plan itself as the memory and makes four sections mandatory and living —
their names and formats, quoted:

- **`Progress`** — checkboxes with timestamps; every stopping point recorded, splitting a partial item
  into "done: X; remaining: Y". Must always reflect actual state.
- **`Surprises & Discoveries`** — `Observation: … / Evidence: …`
- **`Decision Log`** — `Decision: … / Rationale: … / Date/Author: …`
- **`Outcomes & Retrospective`** — result compared against the original purpose.

Also theirs, and transferring directly:

- **Self-containment.** The plan is written for a reader who has only the working tree and this one
  file — no memory of prior plans, no external context; phrases like "as defined previously" are banned.
- **Prose first; checklists only in `Progress`.**
- **The context file carries only the trigger** — two lines pointing at the contract, which lives in a
  separate file read on demand.

**What we take from it.** `Surprises & Discoveries` is the named home our diagnosis said was missing —
we did not invent the slot, we identified that the gap it fills was the one causing our problem. Two
observations on top are ours: that the four sections are what the codebases we audited had each
reinvented badly (their `## Progresso`, `§ Estado da entrega`, phase-numbered findings and separate
assessment files map onto the four one-for-one); and that the prose-first rule is a **deliberate
inversion** of the context file's map-not-narrative rule — opposite documents, opposite rules, worth
stating because both are otherwise written in the same style by default.

Their two-line-trigger pattern is also the general answer to "where does this knowledge live", which we
adopt as the plugin's shape: *pointer in the context file → contract on demand → instance in the plan →
distillate back into the context file.*

## Our promotion test

Naming a home for learnings is not enough; something has to decide which ones graduate. This test is
ours. Four questions, each answerable without a judgement call about importance:

1. **Recurrence** — has it burned us, or would it burn a fresh agent, more than once? A one-off stays in
   the log.
2. **Non-discoverability** — would a competent agent reading the code find it in a few minutes? Then do
   not write it. *(This question is Huß's content filter, reused as a gate.)*
3. **Not already enforced** — does a test, type, lint rule or hook already make the mistake impossible?
   Then **write the guard, not the prose.** *(Extends Anthropic's documented "use a hook for things that
   must run at a fixed point" into a general preference.)*
4. **Blast radius** — decides the destination: whole repo always → context file; one path → path-scoped
   rule; one workflow → skill; a fixed lifecycle moment → hook; a hard-to-reverse choice → ADR; true in
   any repository → the maintainer's own notes rather than this repo.

And the half nobody implements, also ours: **demotion.** A line whose learning was later covered by a
mechanical guard must be deleted. Without it the file only grows, which is how a context file reaches
200+ lines.

## Format: when a diagram earns its place

The evidence is external. [FlowBench (Xiao et al., EMNLP 2024)](https://arxiv.org/abs/2406.14884) gave
agents identical workflow knowledge as natural language, pseudo-code and flowcharts across 51 scenarios
on three models: **flowcharts gave the best trade-off, and combining formats beat any single format.**
[Gábor Mészáros — *Mermaid for Workflows*](https://dev.to/cleverhoods/claudemd-best-practices-mermaid-for-workflows-khb)
applies that to instruction files and supplies the diagram-plus-prose pairing (diagram carries topology,
adjacent prose carries rationale), plus the caveat that a diagram of purely sequential steps is worse
than a numbered list.

**Our rule**, which goes further than either source: diagram when the process **branches or loops**;
numbered list when linear; always pair the diagram with the prose that explains the ordering; **never
put a diagram in an always-loaded file** — its cost is permanent while its need is occasional. Diagrams
belong in skills, workflows and plan documents. That last clause is ours and follows from the relevance
gate, not from the format research.

## Format: does a structured map file pay for itself?

The proposal is external. [Gábor Mészáros — *The backbone.yml Pattern*](https://dev.to/cleverhoods/claudemd-best-practices-the-backboneyml-pattern-30fi)
moves the project map out of the always-loaded instruction file into a YAML file read on demand, arguing
both token cost and expressiveness — patterns, relationships and boundaries that a directory listing
cannot show. His warning is worth carrying verbatim: *structure that rots is worse than no structure.*

**Our measurement**, on a real 120-line context file, same pre-tokenizer applied to every variant:

| Variant | Tokens | Δ |
|---|---|---|
| Markdown tables, as written | 910 | — |
| YAML, hand-rewritten "same information" | 398 | −56% |
| **YAML control — identical prose, envelope swapped** | **832** | **−8.6%** |

The −56% is **confounded**: nearly all of it came from rewriting the prose shorter, not from the format.
The honest figure is **−8.6%**, because 63% of the block is prose inside the cells and only 37% is
envelope. Against the whole file, moving the same content to an on-demand file and leaving a pointer
saved **−35%** — four times the format gain.

**Our verdict: format is worth ~9%, location ~35%, and deleting prose more than either.** A structured
map file is the weakest of the three levers and the only one that introduces a new drift surface. Its
one real advantage is machine-verifiability — and that does not require the format change, since a
validator can parse a markdown table just as well. We therefore adopt the *ideas* (read-on-demand;
express relationships rather than directory listings; make the map testable) without adopting the file.

## Our reading: authored versus derived knowledge

Original analysis. Authored knowledge (what was decided, what is forbidden, what is not obvious) and
derived knowledge (what the code actually is — code graphs, language servers, indexes) are complements,
not competitors: small and always-loaded versus large and queried on demand.

This resolves a tension in the research above. Context files should not carry codebase overviews — but
the *need* behind those overviews is real, and it is orientation. Derived knowledge is the correct answer
to that need. Where such an index exists, the layout section of a context file should shrink to a pointer
rather than restate structure — which removes content from the always-loaded block, the largest lever in
the measurement above.

The dependency must be on a **detected capability**, never on a specific product, so that a repository
without the tooling degrades gracefully instead of carrying a dangling reference.
