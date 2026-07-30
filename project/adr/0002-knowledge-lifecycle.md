# ADR-0002: Learnings are routed by a promotion test, not authored top-down

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Deciders | Danilo Borges |

---

## Context

This plugin already records decisions well: ADRs are immutable, RFCs have stage gates, task dossiers
are ephemeral and closed through a write-back step. What it does not record is the **empirical
learning** — the non-obvious fact discovered while doing the work. That is exactly the category
[Roland Huß](https://ro14nd.de/what-goes-in-agents-md/) identifies as the only content worth putting in
a context file, *what the agent cannot discover on its own*, and which the
[ETH Zurich evaluation](https://arxiv.org/abs/2602.11988) found to be the difference between a context
file that helps and one that measurably hurts (see
[`research/context-file-practices.md`](../research/context-file-practices.md)).

Two structural gaps cause it, both found by reading this plugin's own `new-plan`, `close-task` and
`project/**` governance rule
([`research/knowledge-lifecycle.md`](../research/knowledge-lifecycle.md)):

1. **The plan is not a living document.** `new-plan` scaffolds one and stops; no named section exists
   for a discovery made mid-flight. Observed consequence: several codebases each invented their own
   shape for the same need, one of them growing past 50 KB in a single file with no lifecycle.
2. **The log exists only as a companion to a decision.** `governance.md` defines `project/log/` as
   optional and paired one-to-one with an ADR — so a learning not attached to a decision has nowhere to
   live, and most learnings are not attached to a decision.

The compound effect is visible in `close-task`: step 3 propagates *code → docs* ("did this change break
a doc?") but nothing propagates *knowledge → context* ("what did we learn that `AGENTS.md` should now
carry?"). The context file is therefore authored top-down, from what the author remembers, when its
only reliable source is **what an agent already failed to discover**.

## Decision

**Knowledge flows through one pipeline with a test at the exit.**

**Plans carry four living sections**, kept current while the work happens, not written at the end. We
adopt the section set and formats from [OpenAI's ExecPlan
contract](https://developers.openai.com/cookbook/articles/codex_exec_plans) rather than inventing our
own: `Progress` (timestamped checkboxes, every stopping point, partials split into done and remaining),
`Surprises & Discoveries` (`Observation:` / `Evidence:`), `Decision Log` (`Decision:` / `Rationale:` /
`Date-Author:`), and `Outcomes & Retrospective` (result against original purpose). `Surprises &
Discoveries` is the named home our diagnosis said was missing — we did not invent the slot, we
identified that the gap it fills was the one causing the problem.

**`close-task` gains a knowledge-routing step**, before it distills and deletes. The step and its test
are ours. Each entry under `Surprises & Discoveries` faces four questions:

1. **Recurrence** — has it burned us, or would it burn a fresh agent, more than once? A one-off stays
   in the log.
2. **Non-discoverability** — would a competent agent reading the code find it in a few minutes? Then
   do not write it. *(Huß's content filter, reused here as a gate.)*
3. **Not already enforced** — does a test, type, lint rule or hook already make the mistake impossible?
   Then **write the guard, not the prose.** *(Extends [Anthropic's documented
   guidance](https://code.claude.com/docs/en/memory) that an instruction which must run at a fixed point
   belongs in a hook, into a general preference for guards over sentences.)*
4. **Blast radius** — the destination: whole repo always → `AGENTS.md`; one path → a path-scoped rule;
   one workflow → a skill; a fixed lifecycle moment → a hook; a hard-to-reverse choice → an ADR; true
   in any repository → the maintainer's own notes, not this repo.

**Demotion is part of the same step.** A line in `AGENTS.md` or a rule whose learning was later covered
by a mechanical guard must be deleted. Without this the file only grows.

**`project/log/` gains a second reason to exist**, beyond pairing with an ADR: the rich context of one
unit of work — dead ends, surprises with evidence, lessons — whether or not a decision emerged.

## Options considered

- **A — a single `LEARNINGS.md` per repository.** Trivial to write to; observed in practice past 50 KB.
  No grain, no lifecycle, nothing can be promoted or pruned selectively. Rejected.
- **B — keep learnings only in the decision log.** Already the status quo. Leaves every learning
  without an associated decision homeless, which is most of them. Rejected.
- **C — keep learnings in the maintainer's private notes.** Works for one person and travels with them
  across repositories, but the repository itself learns nothing and the same fact gets written twice.
  Retained only for genuinely cross-repository learnings, which is question 4's last branch.
- **D (chosen) — living plan sections plus a promotion test at closure.** Every learning has a home on
  arrival, and a defined test decides whether it graduates.

## Consequences

**Easier.** `AGENTS.md` becomes downstream of what was actually learned rather than of what the author
remembered, which is the only way it satisfies the non-discoverability filter. Question 3 converts a
class of prose into mechanical guards, which are not ignorable. Question 4 removes the ambiguity
between repository knowledge and personal notes, ending the double-write.

**Harder.** The plan must be maintained *during* the work, not reconstructed at the end — a discipline,
and the sections are worthless if filled in retrospectively from memory. `close-task` grows a step, and
it is the step most likely to be skipped under time pressure, since nothing breaks visibly if it is.

**Accepted costs.** Demotion depends on someone noticing that a guard superseded a line; there is no
mechanism proposed here that detects it, only a checklist item. The promotion test is judgement dressed
as questions — two people can answer "would an agent find this in a few minutes?" differently. Both are
better than the current state of having no test at all, and neither is load-bearing enough to block.

**Follow-up.** Four living sections in the plan template and in `new-plan`; the routing step and the
demotion check in `close-task`; the second reason for `project/log/` in the governance rule; a shared
reference carrying the test so the skills point at it instead of copying it.

## Related

- [`project/research/knowledge-lifecycle.md`](../research/knowledge-lifecycle.md) — the diagnosis and
  the ExecPlan contract this borrows from.
- [ADR-0003](0003-instruction-file-architecture.md) — where question 4 sends each learning, and why.
