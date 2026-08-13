---
vibe-ops-template: adr@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0013: The model a shipped plugin may pin

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-13 |
| Deciders | Danilo Borges |

---

## Context

A skill and an agent can both name the model they run on. Until now the answer here was a blanket
prohibition: never set `model:`, because it silently overrides the choice the user made for their session.
The reason behind it was a real failure — a small model handed a template with no source material
fabricates sections to fill it, and the result reads as a completed document rather than as an empty one.

Two things make that prohibition the wrong shape. It is stated as a universal against a failure that is
specific to **authoring**: a step that copies fixed files to fixed destinations and substitutes named
placeholders cannot fabricate a section, and whether it did the job is answerable in seconds by a command
that either finds an unsubstituted token or does not. And it never stated the constraint that actually
survives, which is not about capability at all: a model named inside a plugin runs on the machine, the
session and the budget of whoever installed it, and that person is not in the room.

The agent surface makes the question concrete rather than theoretical. Subagents shipped here already
split cleanly into work whose failure is loud and immediate and work whose failure is silent and
plausible, and only the first kind can safely be made cheaper.

## Decision

We will pin a model **downward only, and only where a deterministic check runs immediately after the
pinned work and fails loudly.** Everywhere else, `model: inherit`, which is also the default when the
field is absent.

Three parts, all binding:

- **Downward, behind a verifier.** A cheaper tier is permitted when the step is transcription or another
  mechanical transform under a contract that fits in a paragraph, and something that is not a language
  model — a gate, a grep for an unsubstituted token, a checklist run by the caller — reports the failure
  within the same minute. The verifier is named where the pin is declared.
- **Never upward.** A surface may not raise the tier above the session's own. Choosing a model is how
  someone sizes their session; spending more than they chose, on their budget, is not a decision this
  plugin gets to make. A step that genuinely needs more capability than the session has says so in its
  output and stops.
- **`effort` is not covered by this record.** It is a depth dial applied to whatever model is running, not
  a substitution of the operator's choice, and it is already differentiated per surface on the axis of
  what being wrong costs.

## Options considered

- **Option A — keep the blanket prohibition.** Simple and unambiguous, and it never has to be reasoned
  about. Rejected: it forbids the one configuration that makes a mechanical, immediately-verified step
  cheap, and it defends against fabrication in surfaces where fabrication is not available.
- **Option B — allow any pin, on the author's judgement.** Maximum flexibility, and the author usually
  does know which tier fits. Rejected: the author's judgement is applied to somebody else's session. A
  plugin has no way to ask, and a pin that is wrong for the installer is invisible to them.
- **Option C — allow pinning upward for the hardest steps.** Attractive because the steps that fail
  silently are exactly the ones a stronger model handles better. Rejected: it spends the installer's
  budget to overrule a decision they already made, and it treats "this step is hard" as a fact about the
  model rather than about the contract, which is where it belongs — a step whose failure is silent needs
  an output contract that exposes a shallow pass, not a bigger model quietly substituted for one.
- **Option D (chosen) — downward only, behind an immediate and loud verifier.** Permits the saving exactly
  where being wrong cannot hide, and keeps the operator's choice everywhere else. Costs a named verifier
  per pin, and a reviewer has to check that the verifier is real.

## Consequences

Easier: a mechanical step can be made materially cheaper without argument, and reviewing a pin becomes one
question — *what verifies this work, and how fast does it go red?* A surface that cannot answer it does not
get the pin.

Harder, and accepted: every pin now depends on a verifier staying in place, and **nothing detects a pin
whose verifier was later removed**. That failure would be silent in the way this record is otherwise
careful about, and it is the obvious candidate for a guard once a second pin exists — one is not a
population.

Also accepted: this permits a tier to be chosen for someone else at all, which the previous rule did not.
The limit that makes it tolerable is direction — a pinned surface can only ever cost the installer less
than the session they chose.

## Related

- [Plan-024](../plans/024-the-work-a-skill-declares-and-the-caller-cannot-afford.md) — the plan that
  raised the question, and whose Decision Log carries the per-surface tier choices this rule is applied to.
- [ADR-0004](0004-budgeted-artifacts-and-guards.md) — a guard, not a line. The verifier this record
  requires is the same instrument, used as a precondition rather than as documentation.
