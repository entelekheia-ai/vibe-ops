---
vibe-ops-template: plan@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-023: Four answers the tooling has not earned

| Field | Value |
|---|---|
| Status | Backlog |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Related | [Plan-014](014-the-prose-that-describes-a-template-is-checked-against-it.md) · [Plan-019](019-an-artefact-that-shows-the-tool-goes-stale-in-silence.md) |

---

## Summary

Four defects in what this plugin hands a repository — a record number, a check report, a scaffolded
package, and a plan authored from a skill. Three of them share one shape: the tool answers confidently
about something it did not look at, and the answer is shaped exactly like a correct one, so nothing
prompts anybody to check. The fourth is a convention that exists on one authoring surface and is simply
absent from the other. All four were found from outside this repository while using the plugin against
other codebases, which is why none of them appears in this repository's own test suite: each one is
invisible from inside the tree that produces it. They are collected here rather than fixed one at a time
because the first three want the same remedy — declare the population examined — and deciding that once
is cheaper than three times.

## Goals

1. `records resolve` never hands back a record number that has already been used and archived.
2. A check run states which fragment set it composed, so a clean report cannot be confused with a clean
   report over a subset.
3. A freshly scaffolded package passes its own `npm test` and `npm run typecheck` with no edits.
4. The plan-authoring skill carries the same length discipline the `AGENTS.md`-authoring skill already has.
5. Each of the four has a regression test that fails against today's code.

## Scope

### In scope

The four defects below, each with the fix and a test that would have caught it.

### Out of scope

**The `--self-test` fixture's environment isolation.** A related family of "the harness reports a result it
did not earn" defects lives in how `--self-test` inherits the operator's environment. That is a property of
the consuming repository's gate rather than of this plugin, and it is recorded where it recurs.

**Anything about images or template prose.** [Plan-019](019-an-artefact-that-shows-the-tool-goes-stale-in-silence.md)
and [Plan-014](014-the-prose-that-describes-a-template-is-checked-against-it.md) own those, and both are a
different failure — an artefact that *was* right and drifted, rather than one that was never right.

## Design

Not yet defined per track. The one design question worth settling first, because three tracks depend on the
answer: **what does a run of this tooling owe about the population it examined?** Track 2 needs it printed
in a summary line, Track 1 needs it to mean "the tree plus the history" rather than "the tree", and both are
the same admission — a count is only meaningful next to a statement of what was counted. Settle the shape
once, in Track 2, and let Track 1 adopt it.

## Tracks

- [ ] **Track 1 — `records resolve` consults history for the one record type that deletes its files.**
      Resolution derives the next id by taking the highest-numbered file present in the record type's
      directory and adding one. That is correct for ADR, RFC and plan, which are permanent. It is wrong for
      **task**, whose dossier is deleted at closure by design — git history is the archive, so the working
      tree shows only in-flight work and a closed task's number looks free. Verified in **this repository**
      on 2026-08-13: `records resolve --type task` answers `existing: 0, next: "001"`, while
      `git log --diff-filter=D --name-only -- 'project/tasks/*'` shows tasks 001–007 closed and deleted
      here, with 001–004 having been issued twice already. The behaviour predates the TypeScript CLI — it
      was first seen in the since-deleted `scripts/resolve-governance.sh` and the rewrite carried it across
      intact, so it is a property of deriving ids from the tree and not an artefact of the shell version.
      At the end, an ephemeral type's next id is derived from the tree *and* the history, with a test that
      creates, closes and deletes a dossier and asserts the number is not reissued.

- [ ] **Track 2 — a check run declares the fragment set it composed.**
      `cli/packages/module-check/sh/check-agents-md.sh` ends with
      `printf '\n%d checks, %d failed\n' "$CHECKS" "$FAILURES"` (line 601 as of 0.9.0) and says nothing
      about *which* checks those were. The composed set is built at line 131 as
      `"$HOME_ROOT/sh/checks${VIBE_OPS_CHECK_DIRS:+:$VIBE_OPS_CHECK_DIRS}"`, so a bare invocation without
      `VIBE_OPS_CHECK_DIRS` composes only the built-ins and reports `N checks, 0 failed` — output shaped
      identically to a genuinely clean pass over the full set, including every custom fragment. A
      built-in that assumes a plugin's `skills/` layout produces the same shape against a repository that
      has no such layout. At the end, the summary line names the population — how many fragment
      directories were composed and from where — so a partial run is legible without reading the source.
      **This track is cheaper than it looks, and running the tool is what showed it.** The enumeration
      already exists: `--self-test` prints `composed 17 checks:` followed by every fragment with its
      version and path, plus the deny-list provenance. A normal run prints none of it — measured over MCP
      on 2026-08-13, both a plain invocation and `--verbose` returned `17 checks, 0 failed` and no
      composition at all. So the work is reaching that existing output from the normal path, not writing
      it; and `--verbose` returning nothing extra is a second, smaller defect worth fixing in the same
      pass.

- [ ] **Track 3 — a scaffolded package can run its own tests.**
      `plugin/skills/setup/templates/pkg/` ships `"test": "node --test test/*.test.ts"` in
      `package.pkg.json` alongside a `tsconfig.base.json` carrying `"rootDir": "src"` and
      `"include": ["src"]`, and the three cannot hold together. `rootDir` makes adding `test` to `include`
      an error, so the tests are never typechecked. Relative imports written `.js` — correct for emitted
      output — do not resolve when Node runs the source, giving
      `ERR_MODULE_NOT_FOUND: Cannot find module .../src/index.js` because no `.js` exists there. With no
      `types` entry, `import from 'node:test'` fails as `TS2591: Cannot find name 'node:test'. Do you need
      to install type definitions for node?` while `@types/node` is installed and hoisted — the message
      names the one thing that is not wrong. Verified unchanged on 2026-08-13; `tsconfig.build.json`
      carries neither `rootDir` nor `include`. The known-good arrangement: move `rootDir` into
      `tsconfig.build.json`, the only config that emits, and give that file its own `include: ["src"]`;
      add `"types": ["node"]` and `"include": ["src", "test"]` to the base; write relative specifiers with
      `.ts`, adding `allowImportingTsExtensions` and `rewriteRelativeImportExtensions` so the build still
      emits `.js`. At the end, a scaffolded package passes `npm test` and `npm run typecheck` unedited,
      asserted by a test that scaffolds one, and `dist/` still contains `.js` specifiers afterwards —
      the rewrite is what keeps published output correct.

- [ ] **Track 4 — the plan-authoring surface gets the length discipline the `AGENTS.md` one has.**
      `plugin/skills/authoring-agents-md/SKILL.md` carries a line budget, an escape table for what to do
      when a document exceeds it, and a satellite-reference convention for relocating detail.
      `plugin/skills/new/SKILL.md` carries none of the three for plans, though a plan is the longest
      record this plugin produces. Measured on 2026-08-13: that skill is 156 lines, up from 113 at 0.8.0,
      and still mentions neither a budget nor a satellite convention. The technique is known to work
      unaided — applying it by hand cut two real plans from 404 and 300 lines to 237 and 269 in one
      session. At the end, `/new plan` states a budget and names where detail goes when a plan exceeds it.
      **This track has a cheaper alternative worth considering first:** the finding is a prescription for
      how an existing skill should behave, and the routing convention for that is a direct edit to the
      `SKILL.md` rather than a plan track. Kept here because the budget number and the satellite
      convention are a design choice, not a transcription.

- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the tracking
      issue closed. The plan file itself is kept. Stays unchecked until the plan is actually closed; a
      track list that is otherwise complete but has this box open is not finished.

## Success criteria

Run from the repository root:

- `records resolve --type task --json` in a repository with archived-and-deleted dossiers reports a `next`
  greater than every number ever used, and a test asserts it.
- `cli/packages/module-check/sh/check-agents-md.sh` on a repository with custom fragments and no
  `VIBE_OPS_CHECK_DIRS` produces a summary a reader can tell apart from a full run.
- A package scaffolded by `/vibe-ops:setup repo` passes `npm test` and `npm run typecheck` with no manual
  edits, and its build output still uses `.js` specifiers.
- `/new plan` names a line budget and a relocation convention.
- `vibe-ops check .` and `vibe-ops check --self-test` stay green throughout.

---

## Decision Log

- Decision: the four are one plan rather than four, and Track 2 settles the shared question first.
  Rationale: three of the four are the same defect wearing different clothes — a count reported without
  the population it counted — so the remedy is one convention applied three times. Deciding what a run
  owes about its own population separately in each track would produce three different answers, and the
  inconsistency would be permanent because each lands in a different file.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: each track carries its evidence inline rather than citing where it was found.
  Rationale: all four were discovered from outside this repository, and a citation pointing there would
  name a path no clone of this repo can resolve. A plan is permanent and must stand alone; the evidence is
  short enough to restate.
  Date / Author: 2026-08-13 / Danilo Borges

## Outcomes & Retrospective

*Nothing shipped yet.*

---

## Open questions

Whether Track 4 should be a plan track at all, or a direct edit to `plugin/skills/new/SKILL.md`. The
argument for the edit is the routing convention; the argument for the track is that the budget number and
the satellite convention have to be chosen, and a choice made silently inside an edit is a choice nobody
can find later.

## Related

- [Plan-014](014-the-prose-that-describes-a-template-is-checked-against-it.md) — prose that describes a
  template, checked against it. Adjacent: a claim that was true and went stale, rather than one never true.
- [Plan-019](019-an-artefact-that-shows-the-tool-goes-stale-in-silence.md) — the same distinction, for an
  image.
