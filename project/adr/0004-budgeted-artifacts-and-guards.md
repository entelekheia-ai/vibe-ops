<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0004: Budgeted artifacts, and a guard instead of a line

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Deciders | Danilo Borges |

---

## Context

Every artifact this plugin generates is read by a model at the start of a session, and every one of them
grows monotonically: each new fact is added by someone with a reason, and nobody is ever assigned the job of
removing one. Nothing in the plugin bounded that growth, and nothing distinguished a fact that has to be
*read* from one that could simply be *enforced*.

Two mechanical facts, established in [ADR-0003](0003-instruction-file-architecture.md), decide how this
must be handled:

- The instruction file reaches the model wrapped in an envelope saying the context may or may not be
  relevant. That relevance gate applies to the **block as a whole**, so a file padded with situational
  detail puts the universal instructions at risk. A size budget is therefore a *correctness* measure, not a
  cost measure.
- An always-on rule loads with the **same priority** as the instruction file. Moving content from one to
  the other buys organization and nothing else. The only way to raise compliance is to stop writing prose
  and move up the enforcement ladder — to something that executes whether or not anyone read it.

A measurement taken while writing this plugin settled how a file *should* be shrunk. Holding the prose
identical and converting a markdown table to YAML saved 8.6%, because roughly two thirds of the block is
prose inside cells; moving the same content to an on-demand file and leaving a pointer saved 35%. Format is
the weakest lever available and the only one that introduces a second syntax to keep straight.

## Decision

**We will give every generated instruction artifact an explicit size budget, and convert anything
mechanically enforceable into a guard rather than a written line.**

- `AGENTS.md` is budgeted at **150 lines**. Over budget, the fix is to **relocate** content to an
  on-demand surface and leave a pointer — not to compress prose and not to change format.
- A fact that a test, type, lint rule, hook or CI job could make impossible is written as that guard. The
  prose version is not written *in addition*; it is not written at all.
- The reverse is a standing obligation, not an optional tidy-up: when work adds a guard that covers an
  existing written line, **that line is deleted**. This is the demotion step in
  [ADR-0002](0002-knowledge-lifecycle.md), and it is the only mechanism by which these files ever shrink.
- The budget is checked by a script (`scripts/check-agents-md.sh`), not by a reviewer remembering.

## Options considered

- **Option A — no budget; rely on review.** What the plugin did before. Rejected: it produced exactly the
  monotonic growth described above, and a reviewer has no threshold to point at, so every individual
  addition wins its argument.
- **Option B — keep everything, shrink by compressing prose or switching to a denser format.** Rejected on
  the measurement: 8.6% for the format change, against 35% for relocation, and the dense format adds a
  drift surface for a saving an order of magnitude smaller than the alternative.
- **Option C — split the file into several always-on rules.** Rejected on the mechanics: rules without
  `paths:` load at the same priority, so the content is still in the always-on block. This organizes; it
  does not reduce.
- **Option D (chosen) — a hard budget with relocation as the prescribed remedy, plus guard-over-prose and
  demotion, all mechanically checked.** Accepts that a relocated fact is one hop further away.

## Consequences

Easier: the file stops growing without anyone policing it, and the budget gives a reviewer a concrete
threshold instead of a taste argument. Guards work on agents that never read the instructions at all,
which is the only form of compliance that does not depend on the relevance gate.

Harder: a fact behind a pointer can be missed by an agent that does not follow the pointer, so what stays
in the file has to be chosen well rather than merely trimmed to fit. Writing a guard costs more than
writing a sentence, and that cost is paid at exactly the moment someone is trying to finish something else.

Accepted risks: **150 is a judgement, not a measurement** — it is small enough to force the relocation
question and large enough for a real repository's map, but no experiment produced it. And the demotion
step has no detector; it is a checklist item at closure, which means it will sometimes be skipped and the
file will drift upward until the next budget failure catches it.

## Related

- [ADR-0002](0002-knowledge-lifecycle.md) — the promotion test whose third question ("is it already
  enforced?") is the guard-over-prose rule stated from the other side.
- [ADR-0003](0003-instruction-file-architecture.md) — the relevance gate and the equal-priority finding
  that make a budget necessary.
- [`references/authoring-style.md`](../../references/authoring-style.md) — the budget and the escape table
  as the skills apply them.
- [Plan-001](../plans/001-knowledge-lifecycle-retrofit.md), T8 — the validator that enforces this.
