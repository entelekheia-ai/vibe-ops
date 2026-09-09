---
vibe-ops-reference: knowledge-lifecycle@1
---

# Knowledge lifecycle — where a learning goes when the work is done

Decision record: [ADR-0002](../../../../project/adr/0002-knowledge-lifecycle.md). Placement targets:
[ADR-0003](../../../../project/adr/0003-instruction-file-architecture.md).

A repository records its *decisions* well — ADRs are immutable, RFCs have stage gates, task dossiers close
through a write-back. What tends to have no home is the **empirical learning**: the non-obvious fact
discovered while doing the work. This file is the pipeline that gives it one.

## Learnings are captured where they happen

Living sections are kept current **while** the work happens, and they are split across the two record
types by what happens to the file. The formats are adopted from
[OpenAI's ExecPlan contract](https://developers.openai.com/cookbook/articles/codex_exec_plans):

| Section | Lives in | Format | Holds |
|---|---|---|---|
| `Implementation order` | the task dossier | checkboxes | every stopping point; a partial is split into what is done and what remains |
| `Surprises & Discoveries` | the task dossier | `Observation:` / `Evidence:` | the non-obvious fact and what proves it |
| `Decision Log` | the plan | `Decision:` / `Rationale:` / `Date / Author:` | a choice made mid-flight that no ADR covers |
| `Outcomes & Retrospective` | the plan | prose | the result measured against the original purpose |

**The split is not arbitrary.** A dossier is deleted at closure, so a note written there is discharged by
construction; a plan is permanent, so a note written there would stay pending forever. That is why the
working record of *doing* belongs to the dossier and a plan holds only design — which is also why a plan's
`Decision Log` is never routed anywhere.

The dossier's `Surprises & Discoveries` is the load-bearing one: it is the named home whose absence is
what makes learnings evaporate. Filled in retrospectively from memory at the end of the work, every one of
them is worthless — the value is entirely in writing the entry when the surprise happens.

## The promotion test

At closure, **each entry** under a dossier's `Surprises & Discoveries` faces four questions in order. The first three
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

   Two failure modes to check for, because both look like a passing guard. A guard that reads **state it
   does not own** — a shared temp directory, the clock, the network — fails for reasons that have nothing
   to do with the defect, and a check people learn to re-run is off. A guard whose isolation is a **no-op
   on someone's platform** never fails at all there; prove it fails on the platform you are on, not the
   one you assume. Re-run a new guard enough times to see it is stable, then break the thing on purpose
   and watch it catch that.
4. **Blast radius** — where it lands, routed by what the fact *is*. That routing table is
   [`instruction-surfaces.md`](../../../../plugin/references/instruction-surfaces.md#where-each-fact-goes); do not restate it here.

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
surprises with their evidence, lessons — whether or not a decision came out of it. It is where a future
reader looks when the one-line version in `AGENTS.md` is not enough.

**It is never the overflow bucket for what the promotion test rejected.** An entry that fails question 1
or question 2 is dropped, deliberately and out loud; it does not fall one tier down. The log is a
destination reached on its **own** merits — question 2 of the placement pass, *can you name the file,
folder or package where someone meets this again* — and filing rejects downward is exactly what carried
`project/learnings/` past its budget in the first place. This paragraph said the opposite until
2026-08-12, and the closing skills said this; the skills were right.

## Honest limits

The test is judgement dressed as questions. Two people can answer *"would an agent find this in a few
minutes?"* differently, and question 3 depends on someone knowing what guards exist. It is better than
having no test, and it is not load-bearing enough to block work on — when an entry is genuinely ambiguous,
leave it in the log rather than promoting it. Under-promotion costs a re-discovery; over-promotion costs
every future agent that reads the file.
