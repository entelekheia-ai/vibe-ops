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
| Related | [Plan-003](003-readme-presentation.md) — produced the research file this plan generalises from |

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

<!-- Not yet designed: whether research documents are numbered like the other artifacts or named by topic.
     The two that exist are named by topic and nothing has needed a number yet. Decide before writing the
     skill, because it determines whether the discovery step looks for NNN- prefixes. -->

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

<!-- Maintained during the work. Empty is correct until the work starts. -->

## Decision Log

- Decision: Record this as a thin plan now rather than starting the work or leaving it as a note.
  Rationale: The gap was found while doing something else, and the shape worth reusing is fresh in one
  research file that exists today. A plan keeps the pointer to that file attached to the idea; a note
  elsewhere loses it.
  Date / Author: 2026-07-30 / Danilo Borges

## Outcomes & Retrospective

<!-- Filled at each track completion and at the end. -->

---

## Open questions

- Are research documents numbered like ADRs and plans, or named by topic as the two existing ones are?
- Does a research document have a lifecycle at all, or is it write-once? The other four artifact types all
  have one, and `governance.md` currently gives research none.
