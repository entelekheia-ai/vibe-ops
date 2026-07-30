<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-003: README Presentation

| Field | Value |
|---|---|
| Status | Shipped |
| Created | 2026-07-30 |
| Author | Danilo Borges |

---

## Summary

This plan makes the plugin's own `README.md` something a stranger wants to keep reading, and changes
`skills/authoring-readme/SKILL.md` — the skill that writes READMEs for every repository this plugin
touches — so that the improvement is generated rather than hand-applied once. A second, smaller half
removes a structural duplication found while reviewing the two files: both `README.md` and `AGENTS.md`
carry a table of the repository's folders, and only one of them should. The work is presentation only:
nothing here changes what any skill does.

## Goals

1. `README.md` opens with something a reader who has never heard of this project can evaluate in under
   thirty seconds — what it is, and evidence that it works — rather than a paragraph of description
   followed by installation instructions.
2. `skills/authoring-readme/SKILL.md` prescribes that shape, so the next repository scaffolded by
   `/vibe-ops:repo-setup` gets it without anyone remembering to ask.
3. The repository-layout table exists in exactly one file. `README.md` keeps at most a pointer.
4. `skills/authoring-agents-md/SKILL.md` stops instructing its Layout table to carry one row per folder,
   and instead states what earns a row — the change that keeps the same duplication from being
   regenerated into every future repository.
5. Every claim added to either skill is traceable to a linked source in
   [`project/research/readme-presentation-practices.md`](../research/readme-presentation-practices.md), or
   is unlinked there and therefore ours by construction. No borrowed advice is adopted silently, and
   nothing of our own is passed off as established practice.

## Scope

### In scope

- `README.md` at the repository root.
- `skills/authoring-readme/SKILL.md` — the canonical section order (Step 1) and the strip list (Step 2).
- `skills/authoring-agents-md/SKILL.md` — Step 5's `Layout` bullet only.
- `AGENTS.md` — the `Layout` table, trimmed to the rows that survive the criterion written in goal 4.
- Any new reference material the two skills end up pointing at instead of restating.

### Out of scope

- **Package READMEs and the monorepo case.** `authoring-readme` already covers them and this plugin has no
  packages, so there is nothing here to verify a change against. Whatever shape is decided for the root
  README applies to them by the skill's existing "same six-section shape independently" rule; that rule is
  not being revisited.
- **`references/authoring-style.md`** — phrasing and English-only rules. This plan changes what sections
  exist and in what order, not how sentences are written.
- **The validator (`scripts/`).** Section order and visual appeal are judgement, not mechanical checks.
  If some part of this turns out to be mechanically checkable, that is a separate plan; adding a guard
  here would be scope creep on the plan that just finished building the guard mechanism.
- **`docs/`, `GOVERNANCE.md`, `CHANGELOG.md`.** They are not presentation surfaces for a newcomer.
- **A logo, a wordmark, or any commissioned artwork.**

## Design

### The evidence base

The published advice, the six READMEs examined, and every rule extracted from them live in
[`project/research/readme-presentation-practices.md`](../research/readme-presentation-practices.md),
with external claims linked at first use and our own conclusions marked as ours. **That file is the
source of truth for what is true about READMEs; this plan is only the record of what this repository
decides to do about it.** Do not restate its findings here.

The one conflict worth naming, because it shapes every track: the canonical essay argues a README exists
to let a reader *rule the project out*, while the contemporary advice asks the top of the file to sell.
This plan sides with honesty on intent and with the modern advice on evidence, and treats them as
compatible — the strongest opening is not a claim about the project, it is the project visibly doing its
job. Adjectives satisfy neither standard.

### What this means for this repository specifically

The generic advice assumes a library with an `import` statement. This project has none: its usage is a
slash command typed into Claude Code, and its output is a directory tree in someone else's repository. So
the "smallest example that actually runs", required by Step 1 of `authoring-readme`, has to be a
transcript or a before-and-after tree rather than a code fence. The current Quickstart is a single line
naming the command — it tells the reader the command exists and shows nothing of what it produces. That
is the concrete gap behind the complaint that the README is dull.

The file also has no section answering "what problem does this solve" for someone who has never heard of
the project, though `authoring-readme` Step 1 lists it as section 2. It goes from its opening paragraph
straight to Install.

### The layout duplication

`README.md` carries a `## This repository` table of six rows; `AGENTS.md` carries a `## Layout` table of
nine. Four entries appear in both. `skills/authoring-readme/SKILL.md` Step 2 already forbids exactly this,
in its own words: *"A repo-layout tree belongs in `AGENTS.md`, not repeated here."* The README is in
breach of the skill this repository ships, which is the strongest possible argument for fixing it and the
reason it belongs in a presentation plan rather than being deferred.

The `AGENTS.md` side is subtler and needs care, because the fix there is not simply "delete the table".
`references/instruction-surfaces.md` routes *"this is how the repo is shaped"* to `AGENTS.md`, so a layout
map is legitimately that file's job. What is not legitimate is a row per folder regardless of whether the
row says anything: `project/research/context-file-practices.md` — this repository's own research file —
records that in the ETH Zurich evaluation across 138 tasks, codebase overviews specifically did not help,
and that agents given one often took *more* steps because they read the directory tree anyway. Five of the
nine current rows either restate what `ls` shows (`.github/workflows/`, `.claude-plugin/marketplace.json`)
or duplicate another table in the same file (`GOVERNANCE.md`, `project/`, `.claude-plugin/plugin.json` all
appear again under `Source of truth`, and `.agents/` is described again under `Agent config layout`).

The root cause is in the generator, not the instance: Step 5 of `skills/authoring-agents-md/SKILL.md` says
*"Layout — a table, one row per folder or package"*, with no qualifier, three steps after Step 3 tells the
author to delete anything discoverable. The `AGENTS.md` in this repository did not drift from the skill —
it obeyed it. Fixing only the file would regenerate the same table in the next repository.

## Method: decide by drafting, not by arguing

The open questions at the bottom of this plan resist being answered in the abstract, and the reason is
visible in the Design section: the right answer differs by what kind of thing the project *is*. So the
shape is decided empirically, by drafting three READMEs for three projects with three different output
media, and keeping only the rules that survive all three.

| Project | What it is | The question only it answers |
|---|---|---|
| this repository | A Claude Code plugin. No import statement; its output is a directory tree inside somebody else's repository. | What "show the output" means when the project has no code example. |
| `dot-agent-spec` | A monorepo of published npm packages. | The library default: real install command, real version badge, and the root-README-versus-package-README split. |
| `murici` | An Electron desktop application. | The GUI case, where the medium is necessarily a screenshot and the assets cannot be generated from the source. |

One README yields a rule indistinguishable from the author's taste. Three divergent ones are the smallest
set where a rule that holds in all three can be told apart from a preference that happened to fit one.

Two constraints on how this is run, both deliberate:

- **The drafts are written outside those repositories.** `dot-agent-spec` and `murici` are independent git
  repositories; a plan belonging to this one does not commit into them. Drafts live in a scratch directory,
  the *rule* extracted from them lands in the two skills here, and applying a draft to its own repository
  is later work owned by that repository. Reading them for input is what produces the signal; writing into
  them adds nothing to it.
- **Prefer an artefact that can be regenerated from the thing it depicts.** A before-and-after directory
  tree, produced by actually running `/vibe-ops:repo-setup`, is text: diffable, reviewable, and
  reproducible when the skill changes. A recorded GIF is a binary that nothing verifies and that will
  diverge silently the first time a step changes. The tree is attempted first, which turns open question 2
  from "is a GIF worth it?" into the falsifiable "did the tree fail?".

## Tracks

### Track 1 — Draft three READMEs and extract the rule from what they disagree about

Write a candidate README for each of the three projects above, in a scratch directory, from the real
current content of each repository. The deliverable is not the drafts — it is the answer to each open
question below, with the draft that produced it as evidence, plus an explicit note of any rule that had to
be stated differently for each project, since a rule that needs three exceptions is not a rule.

The maintainer is separately collecting READMEs he finds appealing; those are an input to this track and
it does not close before they are reviewed. Assets that cannot be produced from this environment — notably
a screenshot of `murici` running, since this shell cannot launch a GUI application — are requested at the
point they are needed, not up front.

At the end of this track nothing in this repository has changed, and Tracks 2 to 4 are unambiguous.

### Track 2 — Rewrite `README.md` to that shape

Apply the decision to the plugin's own README: the missing problem/boundary section, a Quickstart that
shows output rather than naming a command, the demo artefact if Track 1 called for one, and the badges if
it called for those. The `## This repository` table is cut to a pointer of at most two lines. At the end
of this track the README passes the `authoring-readme` checklist that currently fails, and the layout
table exists in one file rather than two.

Verification is a human reading it cold, which is not a command — so the acceptance is stated instead as:
the first screenful answers what it is, who it is for, and shows the thing working, with no repository
layout table anywhere in the file.

### Track 3 — Change the two skills so the shape is generated, not applied once

In `skills/authoring-readme/SKILL.md`, fold the outcome of Track 1 into Step 1's canonical section order
and Step 2's strip list, including the rule about showing output in the medium the project actually has,
and the note about GitHub's auto-generated outline making a hand-written one redundant. The existing
"a repo-layout tree belongs in `AGENTS.md`" bullet is promoted from the strip list into the section order
itself, so it constrains what gets written rather than only what gets removed afterwards.

In `skills/authoring-agents-md/SKILL.md`, replace Step 5's *"one row per folder or package"* with an
admission criterion: a Layout row earns its place by saying what a directory listing does not — which
folder is authoritative for what, where to start reading, or a constraint that is not visible from the
name. Folders whose names explain themselves are omitted. The multi-project workspace case is called out
as the exception, since there the table maps *boundaries between independent projects*, which no listing
conveys.

Both skills are prose files with no build step, so the acceptance is that a fresh reading of each skill,
applied to this repository, would produce the files Track 2 produced — the generator and the instance
agree.

### Track 4 — Reconcile `AGENTS.md` and close the loop

Trim the `Layout` table by the criterion written in Track 3, removing the rows that restate a listing or
duplicate the `Source of truth` and `Agent config layout` sections of the same file. Confirm the file is
still within its 150-line budget with room, and that `scripts/check-agents-md.sh` is green — the trim
removes links, and a removed link is a chance to leave a dangling reference elsewhere.

## Success criteria

1. `./scripts/check-agents-md.sh` and `./scripts/check-agents-md.sh --self-test` both pass on the branch.
2. `grep -n 'This repository' README.md` returns nothing, or returns a pointer of at most two lines with
   no table under it.
3. No path appears as a table row in both `README.md` and `AGENTS.md`.
4. Every row remaining in the `AGENTS.md` `Layout` table states something absent from `ls`, checked row by
   row and recorded in the Outcomes section.
5. `skills/authoring-readme/SKILL.md` Step 1 names a "show the output" requirement, and its checklist has
   an item that would have caught the current README's missing problem/boundary section.
6. `skills/authoring-agents-md/SKILL.md` Step 5 no longer contains the phrase "one row per folder".
7. Reading `skills/authoring-readme/SKILL.md` and applying it to this repository produces the README that
   Track 2 wrote — verified by walking the checklist against the file, not by regenerating it.

---

## Progress

- [x] Track 1 — 2026-07-30. Three drafts written (scratch, outside their repositories); the maintainer's
      three reference READMEs analysed; the shape recorded under "What Track 1 settled". Done:
      the opening skeleton, the medium-selects-the-proof rule, badges, navigation, and the position of the
      "why". Remaining: the two questions below that the drafts did not settle.
- [x] Track 2 — 2026-07-30. `README.md` rewritten on branch `readme-presentation`: six-element opening,
      three true badges, one navigation row, the slash-command screenshot as proof at
      `docs/images/slash-commands.png`, the `repo-setup` output tree as the quickstart, a `Why` section
      that did not exist, and `## This repository` cut to a closing pointer line.
- [x] Track 3 — 2026-07-30. `authoring-readme`: new Step 0 (gather the three external inputs), Step 1
      rewritten as the six-element opening, new Step 2 (show the output, with the medium table, the
      copy-don't-compose rule, the capture-against-the-version rule and the screenshot brief), Step 3
      strip list gained contributor material and the status-versus-known-limitation distinction, and the
      checklist was rewritten around what is now judgeable. `authoring-agents-md`: Step 5's Layout bullet
      replaced with an admission criterion plus the multi-project-workspace exception.
- [x] Track 4 — 2026-07-30. `AGENTS.md` `Layout` trimmed from nine rows to four; the table now carries a
      sentence stating what earns a row. 107/150 lines, validator green.

## Surprises & Discoveries

Findings about **this workspace's own artefacts and this plan's own process**. General findings about
READMEs — what the published advice says, what the six examined READMEs do, and every rule derived from
them — live in [`project/research/readme-presentation-practices.md`](../research/readme-presentation-practices.md)
and are deliberately not repeated here.

- Observation: The repository's `README.md` violates the skill this repository ships to write READMEs.
  Evidence: `skills/authoring-readme/SKILL.md` Step 2 states *"A repo-layout tree belongs in `AGENTS.md`,
  not repeated here"*; `README.md` carries a six-row `## This repository` table, four of whose entries are
  also rows in the `AGENTS.md` `Layout` table.

- Observation: The `AGENTS.md` Layout table was not drift — it was compliance. The generator asks for it.
  Evidence: `skills/authoring-agents-md/SKILL.md` Step 5 reads *"Layout — a table, one row per folder or
  package"*, unqualified, while Step 3 of the same file instructs the author to delete content a competent
  agent could discover on its own, and cites `project/research/context-file-practices.md` finding codebase
  overviews to be the least useful category measured. Fixing the file without fixing Step 5 regenerates
  the same table in the next repository.

- Observation: A house convention for the top of a README already existed, and neither skill knew about
  it. The question "should there be a hero image" had been answered in practice before this plan asked it
  in the abstract.
  Evidence: `murici/README.md` and `dot-agent-spec/README.md` both open with a centred
  `docs/images/header.png`; this repository's `README.md` has no image at all. Neither uses `<picture>`
  with `prefers-color-scheme`, so both marks are designed against one GitHub theme.

- Observation: The same author, in the same period, made three different structural choices for the same
  section — which is what a missing rule looks like from the outside.
  Evidence: `murici/README.md` puts a seven-bullet `Key Features` list before its Quick Start;
  `dot-agent-spec/README.md` leads with a packages table; this repository's README has neither.

- Observation: A screenshot of a running application is a **privacy surface**, and the fix is a brief
  issued before the shot, not a review after it.
  Evidence: the first `murici` screenshot showed a personal email address, former employers from the
  maintainer's CV, a debug toggle left on, and a sidebar of throwaway conversations — and, separately, it
  showed none of the state-machine panel that is the product's differentiator, so it would have sold the
  application as an ordinary chat client. A second shot taken against an explicit brief showed live state
  execution. Review would have caught the first failure; only a brief prevents the second.

- Observation: Directing the screenshot found a defect in the product being screenshotted, and the visible
  symptom was one third of it.
  Evidence: one panel heading read `FERRAMENTAS` among English siblings. Tracing it found three literals
  bypassing `t()` in the same component: a Portuguese heading, a Portuguese loading message, and an
  English `DEBUG` that fails to localize in the other direction. Filed as `entelekheia-ai/murici` issue 7.

- Observation: The agent writing a README is the one least able to write its code example, and this plan
  reproduced the failure it was investigating — twice.
  Evidence: draft B could not include a `.behavior` excerpt without composing one from memory of a DSL
  whose syntax has changed, and was left as a marked placeholder. Separately, draft B proposed the tagline
  *"Agents that behave the same way every time you run them"* — a claim invented in good faith before the
  project's own website had been read, where a different canonical claim already existed. Both are the
  same error: writing what should have been copied.

- Observation: Three surfaces describe the same product three different ways, and nothing reconciles them.
  Evidence: `dot-agent.ai` leads with *"AI agents deserve a file format"* and *"an open specification…
  One file. Your rules."*; `dot-agent-spec/README.md` opens with *"Monorepo for the dot-agent ecosystem —
  a language and runtime…"*. For the application: `entelekheia.ai` says murici is *"built on the .agent
  standard"* while `murici/README.md` says *"powered by @dot-agent/sdk"* — a standard to adopt versus a
  package depended upon. The maintainer notes `dot-agent.ai` is itself not yet updated, so here the
  repository is ahead of the site rather than behind it.

- Observation: The strip list in `authoring-readme` would remove a section that belongs, and the rule as
  written cannot tell the two apart.
  Evidence: `murici/README.md` carries a `Known Limitations` section describing how a small quantized
  model emits a malformed `trigger_intent` call, poisons the chat history, and makes every later turn fail
  with a `422` — with a workaround and a linked issue. By the letter of the current rule this is status
  narrative. It is in fact a failure the reader hits in their first hour.

- Observation: Contributor material is a third category of README leakage the skill does not name, and in
  practice the bulkiest.
  Evidence: `dot-agent-spec/README.md` devotes sections to workspace build commands, the Zig and Rust
  toolchain for the WASM packages, the Docker requirement for tree-sitter, and the `<package>@<version>`
  release tagging convention. None is decision history or status — it is simply addressed to a contributor
  rather than a user.

- Observation: `murici/README.md` documents a file extension the project no longer uses.
  Evidence: it instructs the reader to drag `.flow` DSL files into the Behavior Panel; the extension has
  been `.behavior` for some time. A hand-written example goes stale silently.

- Observation: The first screenshot taken as this repository's proof artefact was already stale, which
  demonstrated the drift risk of unregenerable artefacts on the very first attempt — and identified a
  precondition the skill must state.
  Evidence: the slash-command menu captured for the README listed `/vibe-ops:scaffold-new-repo`, renamed
  to `repo-setup` before the 0.4.0 release, and omitted both `repo-setup` and `close-plan`. The installed
  plugin was still 0.3.0, because `claude plugin update` had not been run since the release. Published as
  taken, the README would have advertised a command that no longer exists and hidden two that do. Any
  artefact showing an installed tool must be captured against the version being documented, and for a
  plugin that means updating the install first — a step nothing prompts for.

## Decision Log

- Decision: Answer the open questions by drafting three READMEs across three different kinds of project,
  rather than by settling the section order in argument first.
  Rationale: The questions are underdetermined in the abstract because the right answer depends on the
  medium a project's output has. Three projects with three different media is the smallest set in which a
  rule that holds everywhere can be distinguished from a preference that fit one case. The drafts are
  evidence for the rule; they are not themselves the deliverable.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: Draft the other two repositories' READMEs outside those repositories, and never commit into
  them from this plan.
  Rationale: `murici` and `dot-agent-spec` are independent git repositories. Reading them is what produces
  the signal; writing into them from a plan owned by this repository would be exactly the cross-project
  bleed the workspace is organised to prevent, and it would put a change into a repository whose
  maintainer has not agreed to it in that repository's own terms.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: Attempt a regenerable text artefact — a before-and-after directory tree from a real
  `/vibe-ops:repo-setup` run — before considering a recorded GIF.
  Rationale: An artefact that can be regenerated from the thing it depicts cannot drift undetected; a
  binary recording can, and nothing in this repository would notice. This also converts an open question
  about taste into a falsifiable one about sufficiency.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: Treat this as a plan rather than applying the four edits directly.
  Rationale: Two of the four changes are to shipped skills, which decide the shape of every repository
  scaffolded afterwards. A change with that blast radius should have a written record of what was
  considered, including the sources that disagree, so a future reader can tell an argued choice from an
  arbitrary one.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: When a public site and a README describe the same product differently, **the site owns the
  framing and the README owns the facts.**
  Rationale: The site is written deliberately for persuasion and is the surface a stranger reaches first,
  so it sets the vocabulary and the angle; a README that contradicts it hands the reader two products.
  But framing is all it owns. A site can promise what is on a roadmap, and it goes stale on its own
  schedule — `dot-agent.ai` currently describes a framing the repository has already moved past, so here
  the README is *ahead* of the site rather than behind it. Making the README follow the site on substance
  would make it untrue, which no other rule in this plugin tolerates. The README adopts the framing and
  states only what is true today; where the two cannot both hold, the site is what gets updated.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: The proof artefact for this repository's README is a **screenshot of the slash-command menu**,
  with no recorded video. The before-and-after directory tree stays available as a possible second
  artefact later.
  Rationale: A static frame of the command palette shows what the plugin *is* — a set of commands that
  appear where the user already works — in one image, with none of the cost of a recording: no binary that
  drifts frame by frame, no re-record when a step changes, and a re-shoot is one keystroke. The counter-
  evidence from `career-ops` (a GIF, in the closest structural analogue we found) was read and set aside:
  a fifteen-second recording sells a multi-step workflow, and what this plugin needs to establish first is
  simply that the commands are there.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: Move the general findings out of this plan into
  `project/research/readme-presentation-practices.md`, and keep here only what concerns this workspace's
  own artefacts and this plan's own process.
  Rationale: The plan had grown to the point of obscuring its own decisions — general truths about READMEs
  and the record of what this repository will do had the same weight on the page. Splitting them also
  makes the attribution boundary explicit: the research file links every external claim at first use, so
  anything unlinked in it is ours by construction. The plan is a working record; the research file is
  citable on its own and outlives it.
  Date / Author: 2026-07-30 / Danilo Borges

## Outcomes & Retrospective

Tracks 2–4 landed on 2026-07-30 on branch `readme-presentation`. Success criteria 1–5 and 7 hold;
criterion 6 was written wrong and is recorded below rather than quietly satisfied.

**Criterion 4, checked row by row.** The `AGENTS.md` `Layout` table went from nine rows to four. Kept:
`skills/` (that it is the *product* Claude Code loads, and that templates beside a SKILL.md are copied
rather than inlined), `references/` (that it is the single copy of any cross-skill rule), `project/` (that
a path-scoped rule auto-loads only while working inside it), `scripts/check-agents-md.sh` (fragment
composition, `--list`, `--self-test`). Cut: `.claude-plugin/marketplace.json` and `.github/workflows/`,
which a listing already tells you; `GOVERNANCE.md`, `.claude-plugin/plugin.json` and `.agents/`, each of
which was already the answer to a row in `Source of truth` or the `Agent config layout` section of the
same file.

**Criterion 6 was a bad proxy.** It asked that `skills/authoring-agents-md/SKILL.md` Step 5 no longer
contain the phrase *"one row per folder"*. The rewritten bullet contains it — as **"Not** one row per
folder", a negation that is clearer for a reader than an equivalent phrased to dodge a grep. Writing the
criterion as a string search made the string, rather than the behaviour, the target. The behaviour is
checked by criterion 7 instead: applying the skill to this repository yields the four-row table Track 4
produced. Left as written, with this note, rather than edited after the fact.

**Routing of `Surprises & Discoveries`, entry by entry.** Seven were promoted into the two skills, where
they now apply to every repository rather than to this one. Four were left in the plan file, which is
their home. One is blocked, on another repository.

| Entry | Outcome |
|---|---|
| `AGENTS.md` Layout was compliance, not drift | **Promoted** — `authoring-agents-md` Step 5 is now an admission criterion |
| House banner convention; neither mark survives a theme switch | **Promoted** — `authoring-readme` Step 1: the mark is optional, and `<picture>` when present |
| A screenshot is a privacy surface; brief before the shot | **Promoted** — `authoring-readme` Step 2, with the four-item brief |
| The agent writing a README cannot write its code example | **Promoted** — Step 2, copy-don't-compose |
| A tagline was invented because no canonical claim was sought | **Promoted** — Step 0, and the site-owns-framing rule |
| Known limitations are not status narrative | **Promoted** — Step 3 strip list |
| Contributor material is a third category of leakage | **Promoted** — Step 3 strip list |
| The screenshot was stale, taken against an older install | **Promoted** — Step 2, capture against the version being documented |
| This repository's README violated the skill it ships | **Left** — the fix shipped; the general form is already the strip list's last bullet. Considered as a guard and rejected: detecting "a layout table" mechanically would fire on a monorepo root's legitimate packages table |
| Three different structural choices across the maintainer's own repos | **Left** — evidence for the rules above, not a separate fact |
| Framing an interface for an audience is a review pass on the product | **Left** — true and worth remembering, but not actionable as an instruction; the concrete defect it found is filed as `entelekheia-ai/murici` issue 7 |
| `murici/README.md` documents the `.flow` extension, renamed to `.behavior` | **Blocked** — a fact about a repository this plan does not touch. Unblocked by the pending review pass over the workspace's other repositories; carry it there rather than dropping it |

**Demotion check: nothing to demote.** This plan added no test, lint rule, hook or CI job — its output is
prose in two skills — so no existing `AGENTS.md` line or always-on rule was made redundant by it. The
`AGENTS.md` bullet on `disable-model-invocation` was rewritten rather than deleted, because the field
still exists and the constraint it carries (confirm before an irreversible step) now applies more broadly,
not less. Recording the negative result so a future reader can tell the check ran from it having found
nothing.

**Success criterion 5 was half-unmet, and the criterion was right.** It asked that `authoring-readme`'s
checklist contain an item that would have caught this README's missing problem/boundary section. The
rewritten shape dissolved that section into *claim* plus *why*, and the checklist covered only the claim —
so the gap the criterion was written to catch had been reintroduced in a new shape. A checklist item for
the `why` was added during closure. This is the second criterion in this plan to behave as a real test
rather than a restatement of the work, which is the argument for writing them before the work rather than
after.

**What the plan got right, and what it owes to method rather than judgement.** Every rule that shipped in
the two skills came from drafting three READMEs and keeping only what survived all three — not from the
published advice, which contradicted itself on the two questions that mattered most (whether to sell at
the top, and how long a README should be). Three of the rules now in `authoring-readme` appear in no
source consulted: that a screenshot is a privacy surface, that the brief must precede the shot, and that
a public site owns the framing while the README owns the facts. Had this been decided by argument, none
of the three would exist, because none of them is visible until you try to produce the artefact.

---

## What Track 1 settled

The rules themselves, with the evidence behind each, are in
[`project/research/readme-presentation-practices.md`](../research/readme-presentation-practices.md#our-conclusions).
What this plan commits to, in one line each:

1. **A fixed six-element opening** — mark, `<h1>`, bold claim plus one clarifying sentence, badges,
   one centred navigation row, then the proof. The mark is optional; the claim is not.
2. **The proof element is chosen by the project's output medium** — code block, transcript or
   before-and-after tree, screenshot. This is the rule the whole change rests on.
3. **Badges must be checkable by the reader**, which excludes vanity metrics without a separate opinion
   about them.
4. **Navigation is one centred row, not a table of contents** — GitHub's outline replaces the latter only.
5. **The "why" goes immediately after whatever raises the question**, in the author's voice; its position
   is relative, not a fixed slot.
6. **A public site owns the framing; the README owns the facts.**
7. **No README carries a repository-layout table.**
8. **The skill gathers three external inputs before writing** — the canonical claim, the proof artefact
   (with a brief), and which badges are true. None is discoverable from the working tree.

## Open questions

- **Does the section-order decision warrant an ADR?** It is a rule governing a shipped skill, expensive to
  reverse once repositories exist that were scaffolded from it — which argues yes. It is also
  presentation, which argues it is cheaper to change than it looks.
- **Do package READMEs inherit the "show the output" requirement?** A package inside a monorepo may have
  no demonstrable output of its own. The skill needs to say what happens when the requirement has no
  answer, rather than leaving one that cannot be satisfied.

## Related

- [`project/research/readme-presentation-practices.md`](../research/readme-presentation-practices.md) —
  the evidence base for this plan: the published advice, the six READMEs examined, and the rules derived
  from them. External claims are linked at first use; unlinked conclusions are ours. **All external
  sources for this plan are cited there, not here.**
- `skills/authoring-readme/SKILL.md` — the skill being changed.
- `skills/authoring-agents-md/SKILL.md` — Step 5, the Layout instruction.
- `references/instruction-surfaces.md` — routes "how the repo is shaped" to `AGENTS.md`.
- [`project/research/context-file-practices.md`](../research/context-file-practices.md) — the evidence on
  codebase overviews, which is why the `AGENTS.md` Layout table is being trimmed rather than kept as-is.
