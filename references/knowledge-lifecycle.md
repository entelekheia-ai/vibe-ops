# Knowledge lifecycle — where a learning goes when the work is done

Decision record: [ADR-0002](../project/adr/0002-knowledge-lifecycle.md). Placement targets:
[ADR-0003](../project/adr/0003-instruction-file-architecture.md).

A repository records its *decisions* well — ADRs are immutable, RFCs have stage gates, task dossiers close
through a write-back. What tends to have no home is the **empirical learning**: the non-obvious fact
discovered while doing the work. This file is the pipeline that gives it one.

## Learnings are captured where they happen

A plan carries four living sections, kept current **while** the work happens. The section set and formats
are adopted from [OpenAI's ExecPlan contract](https://developers.openai.com/cookbook/articles/codex_exec_plans):

| Section | Format | Holds |
|---|---|---|
| `Progress` | dated checkboxes | every stopping point; a partial is split into what is done and what remains |
| `Surprises & Discoveries` | `Observation:` / `Evidence:` | the non-obvious fact and what proves it |
| `Decision Log` | `Decision:` / `Rationale:` / `Date / Author:` | a choice made mid-flight that no ADR covers |
| `Outcomes & Retrospective` | prose | the result measured against the original purpose |

`Surprises & Discoveries` is the load-bearing one: it is the named home whose absence is what makes
learnings evaporate. Filled in retrospectively from memory at the end of the work, all four are worthless —
the value is entirely in writing the entry when the surprise happens.

## The promotion test

At closure, **each entry** under `Surprises & Discoveries` faces four questions in order. The first three
can eliminate it; the fourth routes what survives.

1. **Recurrence** — has it burned us, or would it burn a fresh agent, *more than once*? A one-off stays in
   the log and is not promoted.
2. **Non-discoverability** — would a competent agent reading the code find it in a few minutes? Then do not
   write it down. This is the filter that keeps a context file from restating what the repository already
   says. *(The content filter is [Roland Huß's](https://ro14nd.de/what-goes-in-agents-md/), reused here as
   a gate.)*
3. **Not already enforced** — does a test, type, lint rule or hook already make the mistake impossible?
   Then **write the guard, not the prose.** A guard executes regardless of whether the agent read anything.
   With one obligation attached: **prove the guard fails.** A check that has stopped detecting anything
   produces output identical to a clean repository, so a guard nobody has ever watched fail is not yet
   evidence of anything. Run it against something broken on purpose, and keep that fixture.
4. **Blast radius** — where it lands, routed by what the fact *is*. That routing table is
   [`instruction-surfaces.md`](instruction-surfaces.md#where-each-fact-goes); do not restate it here.

The row that ends double-writing is the last one: a fact true in *any* repository — about a language, a
tool, or how the maintainer prefers to work — is not repository knowledge, and putting it in the repo means
writing it again in the next repo.

## Demotion is part of the same step

A line in `AGENTS.md` or an always-on rule whose learning was **later covered by a mechanical guard must be
deleted**. Question 3 applied retroactively. Without this the file only ever grows, and growth is not free:
the always-on block passes through a relevance gate as a whole, so a line that is now redundant is actively
degrading the ones that still matter.

Nothing detects this automatically. It is a checklist item at closure: *did the work add a test, type, lint
rule or hook that now makes an existing written instruction unnecessary?*

## `project/log/` has two reasons to exist

Not only as the narrative companion to an ADR, but as **the rich context of one unit of work** — dead ends,
surprises with their evidence, lessons — whether or not a decision came out of it. A learning that fails
question 1 or question 2 still belongs somewhere; the log is that somewhere, and it is where a future
reader looks when the one-line version in `AGENTS.md` is not enough.

## Honest limits

The test is judgement dressed as questions. Two people can answer *"would an agent find this in a few
minutes?"* differently, and question 3 depends on someone knowing what guards exist. It is better than
having no test, and it is not load-bearing enough to block work on — when an entry is genuinely ambiguous,
leave it in the log rather than promoting it. Under-promotion costs a re-discovery; over-promotion costs
every future agent that reads the file.
