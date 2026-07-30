<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-001: Knowledge Lifecycle Retrofit

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-07-30 |
| Author | Danilo Borges |
| Tracking issue | [#1](https://github.com/entelekheia-ai/vibe-ops/issues/1) — owns status and the executive summary; this file owns the design and the working record |
| Related | [ADR-0001](../adr/0001-skill-taxonomy-target-state-vs-event.md), [ADR-0002](../adr/0002-knowledge-lifecycle.md), [ADR-0003](../adr/0003-instruction-file-architecture.md) |

---

## Summary

This plugin authors governance documents for other repositories but had never applied its own practices to
itself, and it was missing the mechanism that keeps those documents true over time: nothing carried a
learning discovered during work back into the files an agent reads at the start of the next session. This
plan retrofits that loop. It records the architecture in three ADRs, applies the plugin's own scaffolding to
this repository as a dogfood, and then implements the pieces the ADRs assume — a shared reference set the
skills point at, a knowledge-routing step at task closure, a stricter content contract for `AGENTS.md`, and
a validator so the maintenance loop is mechanical rather than a habit.

## Goals

1. Every practice this plugin prescribes is visibly applied to this repository, and the gaps that surfaced
   while doing so are closed.
2. A learning discovered during work has exactly one place to land while the work happens, and a written
   test that decides where it goes afterwards.
3. A skill author can tell, from a skill's name and description alone, whether running it twice is correct.
4. `AGENTS.md` content is filtered, budgeted, and verifiable by a script rather than by re-reading.
5. Nothing in the published repository exposes the private repositories the research was drawn from.

## Scope

### In scope

Everything inside this repository: the nine skills, their templates, the `project/` records, the
`.agents/`↔`.claude/` bridge, `README.md`, `AGENTS.md`, and the validator.

### Out of scope

**Applying these practices to other repositories.** Each is its own repository with its own history and its
own `adopt` decisions, and doing that work is not this plan. What ships here is the tooling; the migrations
are separate work in separate repositories.

**A build step, `package.json`, or multi-host bundles.** An earlier exploration of splitting the plugin into
per-host bundles was removed from the tree and is not revived here. This plan changes content, not
distribution.

**Renaming or restructuring `project/` layouts in other repositories.** ADR-0001's `adopt` verb exists
precisely so that divergent-but-working conventions elsewhere are left alone.

## Design

The architecture lives in three accepted decision records, and this plan implements them rather than
restating them. Read them in this order:

[ADR-0001](../adr/0001-skill-taxonomy-target-state-vs-event.md) splits every skill into one of two kinds. A
**target-state** skill is convergent and idempotent — there is a correct shape and the work is making the
disk match it, so creation and reconciliation are the same job and never become two skills. It is
structured as declare-target, survey the disk for gaps, apply one of four **convergence verbs** per gap
(`create` when absent, `adopt` when divergent but coherent and already referenced, `migrate` when divergent
and actively broken, `leave` when out of scope), then check against the target. An **event** skill is
append-only: it records that something happened, running it twice correctly produces two records, and it has
no update mode because an event is superseded, advanced, or closed rather than edited.

[ADR-0002](../adr/0002-knowledge-lifecycle.md) makes the plan a living document carrying four sections
maintained *during* the work — `Progress`, `Surprises & Discoveries`, `Decision Log`,
`Outcomes & Retrospective` — and adds a routing step at closure. Each entry under `Surprises & Discoveries`
faces four questions: has it burned us more than once; would a competent agent find it in a few minutes;
does a test, type, lint rule or hook already make the mistake impossible; and what is its blast radius. The
answers route it to an `AGENTS.md` line, a path-scoped rule, a skill, a mechanical guard, an ADR, or nowhere
at all. The reverse operation, **demotion**, deletes an `AGENTS.md` line once a guard supersedes it.

[ADR-0003](../adr/0003-instruction-file-architecture.md) fixes where each fact lives. `.agents/` is the
canonical home for agent configuration and `.claude/` holds relative symlinks into it, with an `@`-import
from `CLAUDE.md` as the documented fallback where symlinks are unavailable. `AGENTS.md` carries what is
universal across agents; `CLAUDE.md` is `@AGENTS.md` plus only what other agents would misread. A placement
table resolves each fact by what it is: mechanically enforceable facts become guards, path-scoped facts
become rules with `paths:`, "do this and it breaks" becomes an always-on rule, "this is how the repo is
shaped" stays in `AGENTS.md`, and "how to do X" becomes a skill.

Two mechanical facts from that ADR constrain everything above and are worth repeating here so this plan
stands alone. First, the instruction file reaches the model as a user message wrapped in a system reminder
saying the context may or may not be relevant — and that relevance gate applies to the whole block, so
padding degrades the instructions that were actually needed. A size budget is therefore a correctness
measure, not a cost measure. Second, a rule without `paths:` frontmatter loads with the *same* priority as
the instruction file, so splitting content out of `AGENTS.md` into an always-on rule buys organization and
nothing else; the only way to raise compliance is to move to a hook.

Supporting research, with every external claim linked at first use and every original conclusion marked as
such, is in [`project/research/`](../research/).

## Tracks

**T1 — Dogfood this repository.** The plugin's own governance structure, produced by following its own
skills. At the end this repository has an `AGENTS.md`, a `CLAUDE.md`, a `GOVERNANCE.md`, an
`ACKNOWLEDGEMENTS.md` crediting the external sources, the `project/` skeleton with its templates, and the
`.agents/`↔`.claude/` bridge — none of which existed before. Acceptance: `AGENTS.md` passes the
`authoring-agents-md` checklist, and a grep for private repository names across everything published returns
nothing.

**T2 — The shared reference set.** Three ADRs assume documents that do not exist. Without them, the four
convergence verbs, the promotion test, and the authoring style rules become nine copies inside nine skills,
which is the duplication ADR-0001 exists to prevent. At the end there is a `references/` directory holding
the convergence policy, the knowledge lifecycle, and an authoring-style guide covering prescriptive
phrasing, map-versus-narrative, and when a diagram earns its place. Acceptance: each skill points at a
reference instead of restating it, and no rule appears in two files.

**T3 — Rename `scaffold-new-repo` to `repo-setup`.** ADR-0001 accepted this as a breaking change with no
deprecated alias. It touches the skill directory, the `name:` frontmatter and four self-references, four
cross-references from `new-adr`, `new-rfc` and `new-plan`, two lines in `README.md`, and two in `AGENTS.md`.
At the end `/vibe-ops:repo-setup` works, the old invocation does not, and the break is called out in the
release notes. Acceptance: a grep for `scaffold-new-repo` outside `project/` returns
only historical mentions inside decision records.

**T4 — Reshape the plan artifact.** The plan template and `new-plan` carry the four living sections, declare
the skill an event, and hand off the maintenance contract explicitly. This also closes a gap found in T1:
the scaffold emitted templates for ADR, RFC and task but not plan, while `new-plan` defaulted to a
`project/plans/` directory the scaffold never created. Acceptance: this file exists and was produced by the
rewritten skill from the new template.

**T5 — Knowledge routing at closure.** `close-task` gains the step that reads `Surprises & Discoveries`,
applies the four-question test per entry, routes each to its destination, and checks whether any guard added
by the work now makes an existing `AGENTS.md` line or rule redundant. At the end closing a task can no
longer silently discard what the work taught. Acceptance: the step names the four questions and the
demotion check, and points at the T2 reference rather than restating the test.

**T6 — Tighten `authoring-agents-md`.** The audit that produced this plan found the skill specifies shape
but not content: it never says which facts deserve to exist, has no size budget, no guidance on prescriptive
phrasing, no rule for nested files that never load, and no awareness that a repository may carry a derived
index worth pointing at instead of restating structure. At the end the skill carries a content filter, the
150-line budget with an escape table, phrasing guidance, the placement table from ADR-0003, and the nested
file rule. Acceptance: re-running it against this repository's own `AGENTS.md` produces no change, because
the file was already written to the tightened contract.

**T7 — Governance catches up.** `GOVERNANCE.md` and the `project/**` rule describe four artifact types while
the plugin ships five creation skills; the plan is absent from both. The rule also defines `project/log/` as
existing only alongside an ADR, which leaves a learning unattached to a decision with nowhere to live. A
third gap surfaced when this plan got a tracking issue: the issue↔markdown split is defined for **tasks
only**, so a plan that wants an issue has no stated rule for what each side owns — the principle applied
here was *issue owns status and the executive summary, the file owns the design and the working record*,
and it needs writing down, including that a plan's issue closes while the plan file never does. At the end
all three are described. Acceptance: every artifact a skill can create is described in the governance
documents, and each one that can pair with an issue says what the issue owns.

**T8 — A validator.** The maintenance loop in `AGENTS.md` currently relies on an agent choosing to compare
the file against the disk. Every failure the audit found is mechanically detectable: paths that do not
resolve, references reaching outside the repository, line count over budget, a real file where `.claude/`
should hold a symlink, a symlink checked out as a text file, a rule missing its `description:`. At the end a
script reports all of them and can run in CI. Acceptance: the script fails on a deliberately broken copy
and passes on this repository.

**T9 — The remaining decision records.** Three decisions are settled but unrecorded: that every generated
artifact is budgeted and anything mechanically enforceable becomes a guard rather than a line; that derived
knowledge is consumed through a detected capability and never a named product, so a repository without the
tooling degrades gracefully; and that a task lives as a GitHub issue plus an ephemeral dossier, with the
issue owning status and summary. Acceptance: three ADRs, each with its rejected alternatives.

## Success criteria

Run from the repository root:

- `bash scripts/check-agents-md.sh` (T8) exits zero.
- `grep -rn 'scaffold-new-repo' --exclude-dir=.git --exclude-dir=project . ` returns only `CHANGELOG.md`
  (T3). The old name must survive in exactly two places — the decision records under `project/`, and the
  release note that tells a user their invocation broke. Anywhere else is a missed reference.
- No private repository name appears anywhere in the published tree. The T8 validator carries the pattern
  so this file does not have to: a plan that spells out the names in order to check for them has already
  leaked them.
- `wc -l AGENTS.md` is at most 150.
- Every skill's `description` states whether it is target-state or event (T2, T6).
- `ls project/templates/` shows `adr.md rfc.md task.md plan.md`, and `GOVERNANCE.md` describes all four (T4, T7).

---

## Progress

- [x] (2026-07-30) T1 — dogfood structure laid down: `AGENTS.md` (88 lines), `CLAUDE.md`, `GOVERNANCE.md`,
      `ACKNOWLEDGEMENTS.md`, `.editorconfig`, the `project/` skeleton with `adr rfc/{implemented,rejected}
      tasks plans research log templates`, `.agents/rules/{governance,repo-guardrails}.md` with `.claude/rules/`
      symlinks. Verified: no memory slugs, no upward references, every cited path resolves.
- [x] (2026-07-30) T1 — `repo-guardrails.md` filled with this repository's three real invariants, replacing
      the template's placeholder.
- [x] (2026-07-30) ADR-0001, ADR-0002, ADR-0003 written and accepted.
- [x] (2026-07-30) Research notes written to `project/research/`, abstracted so no private repository is
      named, with external claims linked inline and original conclusions marked.
- [x] (2026-07-30) T4 — plan template created at `project/templates/plan.md`, added to the scaffold's
      emitted templates alongside a `project/plans/` directory; `new-plan` rewritten with the four living
      sections, the event-skill declaration, and the maintenance handoff; this file produced by it.
- [x] (2026-07-30) T2 — `references/` created at the repository root with **four** files, not the three
      planned: `convergence-policy.md`, `knowledge-lifecycle.md`, `instruction-surfaces.md` and
      `authoring-style.md`, plus a `README.md` index. All nine skills now declare their kind and point at a
      reference instead of restating it; `scaffold-new-repo` gained a Step 0 survey and an `audit` mode,
      and its `description` now names the drifted-repo case. Verified: every relative link outside
      `templates/` resolves.
- [x] (2026-07-30) T6 — `authoring-agents-md` rewritten (99 → 152 lines): target-state declaration,
      Step 2 survey with an `audit` stop, the Step 3 content filter with an earns-a-line / delete-on-sight
      table, the 150-line budget pointing at the relocation table, Step 6 on derived indexes, and a
      checklist covering the nested-file and one-surface-per-fact rules. Phrasing, budget mechanics,
      placement and the bridge are pointed at, not restated.
- [x] (2026-07-30) T3 — renamed to `repo-setup`. 28 files moved with `git mv` (rename detection intact),
      14 references rewritten across 7 files, plus prose that needed more than a name swap: the README
      entry and the skill's own opening both promised creation and now state the reconcile case. A
      `CHANGELOG.md` was created — the repo had none — in Keep a Changelog format, with the break at the
      top of `[Unreleased]`. **No version bump**: see the Decision Log. Verified: `scaffold-new-repo` now
      appears only inside `project/` and in that release note.
- [ ] T5 — knowledge routing in `close-task`. Not started. Unblocked: the promotion test now lives in
      `references/knowledge-lifecycle.md` and `close-task` already points at it; what remains is the step
      itself and the demotion check.
- [ ] T7 — governance catches up. Not started.
- [ ] T8 — validator. Not started.
- [ ] T9 — three remaining ADRs. Not started.
- [x] (2026-07-30) T1, T4, T2 and T6 committed as `20947ae` on branch
      `feat/knowledge-lifecycle-retrofit`, off `main` at `2ebf680`. Not pushed.

## Surprises & Discoveries

- Observation: converting a markdown table to YAML saves far less than it appears. A first measurement
  showed −56%, but that was confounded by having rewritten the prose shorter at the same time.
  Evidence: holding the cell prose identical and swapping only the envelope gives −8.6%, because 63% of the
  block is prose inside cells and only 37% is envelope. Moving the same content to an on-demand file and
  leaving a pointer saved −35%. Format is the weakest of the three levers and the only one that adds a drift
  surface.

- Observation: an always-on rule is not a stronger form of instruction than a section of `AGENTS.md`.
  Evidence: the platform documentation states a rule without `paths:` frontmatter loads with the same
  priority as the instruction file. The split is organizational — one topic per file, individually
  removable — and claiming otherwise in a decision record would have been false. Compliance only rises by
  moving to a hook.

- Observation: the instruction file's envelope carries two contradictory framings simultaneously — a header
  asserting the instructions override default behavior and a footer saying the context may or may not be
  relevant and should not be acted on unless highly relevant.
  Evidence: confirmed first-hand in a live session, matching a published third-party observation. The
  consequence drove the budget decision: the gate applies to the block as a whole, so non-universal lines
  put the universal ones at risk.

- Observation: applying `authoring-agents-md` to this repository immediately forced a question the skill does
  not answer — when a fact could go in either `AGENTS.md` or an always-on rule, which gets it?
  Evidence: both surfaces load at launch with equal priority, so putting an invariant in both is pure
  duplication with no compensating benefit. Resolved on the spot as *rule = "do this and it breaks", map =
  "this is how the thing is shaped"*, and recorded in ADR-0003's placement table. A skill that prescribes a
  split has to say how to apply it.

- Observation: this repository's own layout is the strongest available example of why the `adopt` verb must
  exist. The root `skills/` directory is the plugin's product, loaded via `plugin.json`, while `.agents/skills/`
  is configuration for working on this repository.
  Evidence: a convergence pass that treated the two as one layout would uninstall the plugin's contents.
  This is now the first entry in `.agents/rules/repo-guardrails.md`.

- Observation: the plugin's governance model describes four artifact types but ships five creation skills.
  Evidence: `GOVERNANCE.md` and `.agents/rules/governance.md` both omit the plan; the scaffold emitted
  `adr.md`, `rfc.md` and `task.md` but no `plan.md`; and `new-plan` defaulted to a `project/plans/` directory
  the scaffold never created. Closed for the template and directory in T4; the governance documents are T7.

- Observation: the `.agents/`↔`.claude/` bridge was written out **three** times before T2 — in
  `authoring-agents-md`, in `scaffold-new-repo`, and in this repository's own `AGENTS.md` — with the table
  and the `ln -s` commands reproduced in each.
  Evidence: this is what forced a fourth reference beyond the three the plan named. It also explains a
  real divergence: only the `AGENTS.md` copy carried the Windows fallback, because that was written last,
  after ADR-0003 settled it. The two older copies would have sent a Windows user into a silent failure.

- Observation: applying the tightened `authoring-agents-md` to this repository's own `AGENTS.md` produced
  three changes, not the zero the track's acceptance criterion predicted.
  Evidence: (1) a pointer reading "see the bridge below" survived the section it pointed into being
  replaced; (2) the `skills/` versus `.agents/skills/` invariant appeared **both** in the file and in
  `.agents/rules/repo-guardrails.md` — in a file whose own text says those invariants are not repeated
  here — which the new one-surface-per-fact checklist item caught; (3) the maintenance loop's trigger list
  did not mention `references/`, which had just become a thing that can drift. The criterion was written
  assuming the file was already compliant; the useful result is that the checklist is mechanical enough to
  find its own author's misses.

- Observation: three versions of this plugin exist as numbers with nothing behind them.
  Evidence: `git tag -l` is empty and `gh release list` returns nothing, yet `plugin.json` has been through
  0.1.0, 0.2.0 and 0.3.0 — each bumped by the commit that added the features. The version was tracking
  commits, not releases. Caught while writing T3's release note, and it changed the track's output: no
  bump, an `[Unreleased]` section instead.

- Observation: this plan's own success criterion for T3 contradicted T3's definition. The criterion said a
  grep for the old name outside `project/` must return nothing; the track requires the break to be called
  out in release notes, which can only be done by naming it.
  Evidence: the grep came back clean except for `CHANGELOG.md`, written minutes earlier by the same track.
  The criterion was written assuming the only mentions worth keeping were historical. Corrected to allow
  exactly the release note. Worth generalizing: a rename criterion phrased as "the old name appears
  nowhere" is almost always wrong, because a rename that nobody is told about is not finished.

- Observation: a public skill described the private context that produced it. `license-setup` opened with
  "Two repos in this workspace hand-rolled two different license schemes."
  Evidence: it names no repository, so the leak check for private names would not have caught it — but it
  is unreadable to anyone outside the workspace and states as this-plugin-specific history what is a
  general problem. Rewritten to describe the failure mode rather than its instance. The rule this suggests
  is broader than "do not name private repos": **do not narrate the origin of the plugin inside the
  product.**

- Observation: symlinks in the `.claude/` bridge can fail silently rather than loudly.
  Evidence: with `core.symlinks=false`, git checks a symlink out as a plain text file containing the target
  path. The rule file then appears to exist and contains one line of nonsense. Recorded as a risk in
  ADR-0003 and as a check for the T8 validator.

## Decision Log

- Decision: record the architecture as three ADRs rather than a fourth artifact type or a style guide.
  Rationale: the plugin's own governance defines an ADR as a settled, hard-to-reverse choice and names an API
  shape as qualifying; the skill taxonomy is this plugin's API shape. Inventing a fifth artifact type would
  contradict the four-artifact model being documented.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: the mermaid/diagram guidance is **not** an ADR.
  Rationale: it is reversible per file at zero cost and has no rejected alternative worth recording. It is
  style guidance and belongs in the T2 authoring-style reference.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: rename `scaffold-new-repo` to `repo-setup`, breaking the public invocation, with no deprecated
  alias.
  Rationale: a `description` cannot outvote a name — the name is what the user types and what the agent
  matches against — and an alias would preserve in the interface exactly the wrong promise. Taken while the
  plugin is pre-1.0, since the cost grows every release. Recorded in ADR-0001.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: keep the `.claude/` symlink as the default and document an `@`-import from `CLAUDE.md` as the
  fallback, rather than switching to `@`-imports everywhere.
  Rationale: symlinks are what let a non-Claude agent read the same canonical file; `@`-imports are visible
  only to the importing agent, which reintroduces duplication. But symlink creation on Windows needs
  elevated privileges, and this is a public plugin. Recorded in ADR-0003.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: publish an abstracted, English version of the supporting research in this repository, keeping the
  detailed version — which names private repositories and paths — outside it.
  Rationale: `project/research/` exists for investigation that fed a decision, and the ADRs should be able
  to link their evidence rather than restate it. Naming private repositories in a published plugin is not
  acceptable, and the abstracted findings lose nothing an outside reader needs.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: adopt the four living-section names and formats from an external plan contract instead of
  inventing them.
  Rationale: the codebases surveyed had each independently reinvented the same four slots badly. Using the
  published names makes the format recognizable and credits the source. Recorded in ADR-0002.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: the shared reference set lives at `references/` in the repository root, read by skills as
  `${CLAUDE_PLUGIN_ROOT}/references/<file>`. Resolves the first open question.
  Rationale: `"skills": "./skills/"` in the manifest governs skill *discovery*, not file access —
  `license-setup` and `scaffold-new-repo` already read arbitrary paths under the plugin root, so nothing
  needed to change. Putting the policy inside one skill would have made that skill the owner of rules
  governing the other eight, and any skill pointing at it would be reaching into a sibling's private
  directory.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: adopt [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) with an `[Unreleased]` section,
  and **do not bump the manifest version when work lands** — the bump happens when a release is cut.
  Rationale: the manifest had been bumped per feature commit, so 0.1.0, 0.2.0 and 0.3.0 all exist as
  version numbers with **no git tag and no GitHub release behind any of them**. Bumping to 0.4.0 for the
  rename would have added a fourth phantom and skipped a version nobody could install. `[Unreleased]`
  decouples "this landed" from "this shipped", which is the distinction that was missing.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: `audit` is an argument on a target-state skill (`argument-hint: "<repo-name> [audit]"`), not a
  question asked in the first step. Resolves the third open question.
  Rationale: the survey step runs on every invocation anyway, so the only thing `audit` selects is whether
  the run stops after reporting. As an argument it is greppable, documentable and cannot be answered wrong
  under time pressure; as a question it would be one more prompt on the path a user takes every time.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: four references, not the three this plan named — `instruction-surfaces.md` was added.
  Rationale: T6 called for the placement table and the bridge to be carried by `authoring-agents-md`, but
  the bridge was already written out three times and the placement table would have become a second copy
  of the promotion test's question 4. Carrying them in the skill would have satisfied T6's wording while
  breaking T2's acceptance criterion in the same commit. The two criteria disagreed and the deduplication
  one won.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: attribute external and original work explicitly, inline, in every research note and decision
  record.
  Rationale: the first draft blurred the boundary in both directions — under-crediting sources, and
  attributing to them conclusions they never drew, which is an accuracy failure and not only a courtesy one.
  Convention adopted: external claims linked at first use, anything unlinked is original analysis, stated in
  a note at the top of each document.
  Date / Author: 2026-07-30 / Danilo Borges

## Outcomes & Retrospective

*Too early — T1 and T4 are complete, seven tracks remain. To be filled as each track lands.*

One early observation worth keeping: T1 was intended purely as a dogfood, and it produced six of the seven
entries under `Surprises & Discoveries` above. Applying the plugin to itself found gaps that reading its
skills had not, which is itself evidence for the loop this plan installs.

---

## Open questions

- Whether the T8 validator should run as a git hook, in CI, or only on demand from a skill. The plugin has
  never shipped a hook it installs into the repository it is working on, and `license-setup` offering
  pre-commit enforcement is the nearest precedent.
*(Two of the three original open questions are now answered — see the `Decision Log` for where `references/`
lives and for `audit` as an argument.)*

## Related

- [ADR-0001 — Two kinds of skill: target-state and event](../adr/0001-skill-taxonomy-target-state-vs-event.md)
- [ADR-0002 — Learnings are routed by a promotion test, not authored top-down](../adr/0002-knowledge-lifecycle.md)
- [ADR-0003 — `.agents/` is canonical, `.claude/` mirrors it, and each fact has one surface](../adr/0003-instruction-file-architecture.md)
- [Research — what belongs in an agent context file](../research/context-file-practices.md)
- [Research — where knowledge goes after the work is done](../research/knowledge-lifecycle.md)
- [`ACKNOWLEDGEMENTS.md`](../../ACKNOWLEDGEMENTS.md) — external sources this work builds on
