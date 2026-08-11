<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-004: A `new-research` Skill

| Field | Value |
|---|---|
| Status | Backlog |
| Created | 2026-07-30 |
| Author | Danilo Borges |
| Related | [Plan-003](./shipped/003-readme-presentation.md) — produced the research file this plan generalises from · [Research — what a research document must carry](../research/research-document-format.md), which answers both Open questions below |

> **This is a placeholder, deliberately thin.** It exists so the idea is not lost, not because the design
> is settled. The tracks below are a sketch; expect them to change once the maintainer explores the shape
> properly. Do not treat the absence of detail as a decision.

---

## Summary

`project/research/` is the one folder in the governance skeleton with no skill behind it. Every other
artifact type — ADR, RFC, plan, task — is scaffolded from the target repository's own template by a
`new-*` skill, and research is created by hand each time. This plan adds `/vibe-ops:new-research` and the
`research.md` template it needs, so that an investigation feeding a decision starts in a known shape.

## Goals

1. `/vibe-ops:new-research` exists and follows the same pattern as the other `new-*` skills: discover the
   repository's own folder and template, discover its numbering, never hardcode either.
2. A `research.md` template ships in `skills/repo-setup/templates/project/templates/`, alongside the
   existing `adr.md`, `rfc.md`, `plan.md` and `task.md`.
3. The template carries the **attribution contract** as a structural feature, not as advice: external
   findings linked at first use, unlinked conclusions understood to be the author's own.
4. A research document states what it feeds — the decision it is input to — so it cannot be mistaken for a
   record of what was decided.

## Scope

### In scope

- `skills/new-research/SKILL.md`.
- The `research.md` template, and the `repo-setup` step that copies it.
- The `AGENTS.md` skill table and the README skill table.

### Out of scope

- **Changing what `project/research/` means.** Its definition lives in `.agents/rules/governance.md` and
  `GOVERNANCE.md` and is not being revisited: input to a decision, not a commitment to build, not a record
  of what was decided.
- **Retrofitting the two research files that already exist.** They are the shape being generalised from;
  reformatting them is not required to ship the skill.

## Design

The working reference is
[`project/research/readme-presentation-practices.md`](../research/readme-presentation-practices.md), which
was written by hand during Plan-003 and turned out to have a structure worth reusing. Its load-bearing
element is the attribution block near the top, which makes the boundary between borrowed and original
work **mechanical rather than remembered**: because every external claim is linked at first use, anything
unlinked is the author's own by construction. Nothing needs to be labelled twice, and a reader can audit
the boundary by looking at the links.

Its second useful property is a section that states where our measurement contradicts a published claim,
rather than quietly averaging the two. A template that only offers "findings" invites agreement.

**Since 2026-08-04 the design is no longer only this file.**
[`project/research/research-document-format.md`](../research/research-document-format.md) surveys what
published standards contribute — ICD 203 on separating fact from assumption from judgment and confidence
from likelihood, PRISMA-S on recording a search as run, the spike-template convention of answering the
question at the top, and the research-repository literature on index legibility — and audits a corpus of
untemplated research against them. It closes both Open questions at the bottom of this file, and it names
the four fields the template has to carry. **Read it before Track 1**; it is the design, and this section
is the wiring around it.

Naming and lifecycle, decided there: research is **dated, not numbered**, on the private side and named by
topic where it is published — a snapshot is referenced by *when*, a published finding by *what*. So the
discovery step looks for neither an `NNN-` prefix nor a next number. And research **does** have a
lifecycle: write-once with exactly one legal edit, the supersession banner, plus an index status of
`valid → to-be-checked → expired | superseded by <link>`.

## Tracks

Sketch only.

1. **Template.** Write `research.md` with the attribution block, the "what this feeds" line, and section
   stubs for published sources, our own measurements, contradictions, and our conclusions.
2. **Skill.** `skills/new-research/SKILL.md`, modelled on `new-adr`, with the same discovery-first
   behaviour and the same refusal to invent a structure when no template is found.
3. **Wiring.** Add to `repo-setup`'s copy list, the `AGENTS.md` skill table, and the README skill table.

## Success criteria

*Not yet defined — pending the design questions above.*

---

## Progress

- [ ] Track 1 — template.
- [ ] Track 2 — skill.
- [ ] Track 3 — wiring.

## Surprises & Discoveries

- Observation: Three of the sections this template will require had already been invented by hand — each
  in exactly one document, none surviving into the next one written.
  Evidence: In the audited corpus, one document titled a section "(measured, not read)", which is ICD 203's
  fact-versus-assumption distinction reinvented; one invented a "traces of the experiment" section, which
  is PRISMA-S's method record; one invented a "does not repeat <sibling>" pointer, which is how two
  investigations on one subject avoid reading as one contradicting itself. A convention independently
  reinvented three times and lost three times is a need of the genre, not a matter of taste — and it is the
  strongest argument for templating this artifact type at all.

- Observation: The problem was not the shape of the document, which is what this plan assumed.
  Evidence: Hand-written research that dates itself and separates a private from a public layer already
  beat every generic spike template surveyed. What was missing was that a reader could not tell what a
  document concluded, how firmly, or when the conclusion dies — three things only the author can supply,
  and none of which a section reordering fixes.

## Decision Log

- Decision: Record this as a thin plan now rather than starting the work or leaving it as a note.
  Rationale: The gap was found while doing something else, and the shape worth reusing is fresh in one
  research file that exists today. A plan keeps the pointer to that file attached to the idea; a note
  elsewhere loses it.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: Research is **dated, not numbered** — `YYYY-MM-DD-slug` where it is written, named by topic
  where it is published.
  Rationale: The other artifact types are numbered because they are referenced by identity and their order
  matters. A research document is referenced by *when it was true*; a number would carry no information a
  reader needs and would suggest a sequence that does not exist. Published research inverts it: a reader
  outside cites what it is about, not when we happened to look. Settles the discovery question this plan
  flagged — the skill looks for neither a prefix nor a next number.
  Date / Author: 2026-08-04 / Danilo Borges

- Decision: Research **has** a lifecycle: write-once, with the supersession banner as the single legal
  edit, and an index status of `valid → to-be-checked → expired | superseded by <link>`.
  Rationale: "Write-once" was already the rule and was unenforceable, because supersession was recorded
  only in an index — whoever opened the superseded file directly still believed it. The status column and
  an explicit expiry event are what make a dated snapshot decay visibly instead of silently. `to-be-checked`
  exists because the honest answer for old research is usually "nobody looked", and a system with no word
  for that fills the gap with a guess.
  Date / Author: 2026-08-04 / Danilo Borges

- Decision: The template requires four fields — the answer at the top, an expiry expressed as an observable
  event, the method as run, and rejected candidates each with what would reopen them — and no more.
  Rationale: Each of the four is unreconstructable later; everything else a reader can infer from the body.
  Rubrics, IMRaD, compendium layout and a separate reviewer skill were all considered and rejected, with
  the trigger that would reopen each recorded in the research.
  Date / Author: 2026-08-04 / Danilo Borges

## Outcomes & Retrospective

<!-- Filled at each track completion and at the end. -->

---

## Open questions

Both original questions are **closed** as of 2026-08-04, by
[`research-document-format.md`](../research/research-document-format.md) and the Decision Log entries above.

- ~~Are research documents numbered like ADRs and plans, or named by topic as the two existing ones are?~~
  Closed: dated where written, by topic where published.
- ~~Does a research document have a lifecycle at all, or is it write-once?~~ Closed: write-once with one
  legal edit, plus an index status. `governance.md` needs the lifecycle written into it as part of Track 3
  — the research names the four required fields, but the rule in this repo still gives research none.

What is open now is downstream of those answers, and all of it belongs to the tracks:

- The required-field set is unvalidated. Nothing has yet been written under it by an author who did not
  design it, so "the fields get filled with substance" is a prediction. Two consecutive investigations
  shipping without them is the recorded trigger to reconsider.
- Whether a repository that does *not* keep a two-layer private/public split needs a reduced template, or
  whether the same one degrades gracefully when there is nothing to withhold.
