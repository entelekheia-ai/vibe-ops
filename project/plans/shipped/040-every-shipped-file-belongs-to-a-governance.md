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

# Plan-040: Every shipped file belongs to a governance

| Field | Value |
|---|---|
| Status | Shipped |
| Created | 2026-09-08 |
| Author | Danilo Borges |
| Depends on | [RFC-0005](../../rfc/implemented/0005-every-shipped-file-belongs-to-a-governance-and-the-plugin-binds-the-cli.md) |
| Related | [ADR-0013](../../adr/0013-the-model-a-shipped-plugin-may-pin.md), [ADR-0019](../../adr/0019-one-artifact-one-governance-package-activated-by-config.md), [Plan-033](./033-one-artifact-one-governance.md), [RFC-0006](../../rfc/0006-the-repository-as-a-source-of-vibe-ops-units.md) |

---

## Summary

Fifty-five files that this tooling writes into a repository, or reads before writing one, belong to no
package: ten policy references, thirty-two scaffold templates, eight licence-setup files, four shell
scripts and the pinned agent that copies the templates. They live in `plugin/` and are reachable only
through `${CLAUDE_PLUGIN_ROOT}`, so they have no version, no ownership class, no migration note, and no
way to reach a second agent host except by being copied. This plan moves every one of them into a
governance package or a CLI verb, adds the three types that receive them (`style`, `instructions`,
`knowledge`), turns the scaffold into a composition of what the activated governances ship, and leaves in
the plugin only what is judgement or binding: the skills, the two read-only agents, and `hooks.json`.

## Goals

1. `plugin/references/`, `plugin/skills/setup/templates/`, `plugin/skills/license-setup/templates/` and
   every `.sh` under `plugin/` are gone, each file either owned by a package or replaced by a verb.
2. Every file the tooling writes into a repository is named in some package's `ownership.json` fragment,
   including the packages that keep no records — `governance-license` and `governance-classification`.
3. A repository can bind a stack of writing styles, scoped per artefact, and the skills read what that
   stack resolves to rather than one file shipped in the plugin.
4. `agents/rules/governance.md` and `GOVERNANCE.md` are rendered from the activated types instead of
   copied, which is what lets a repository's set of types be visible in its own governance documents.
5. `hooks.json` names `vibe-ops` on all nine registrations, and the plugin ships no script.

## Scope

### In scope

Everything RFC-0005 specifies: the `policy` facet and the reference moves, the type manifest's new fields
(`units`, `facets`, `lifecycle`, `targets`, optional `template`/`dirs`), the three new governance types,
the composed scaffold, the rendered governance documents, the two hook surfaces, and the retirement of the
`scaffolder` agent and the `35-dogfooding-drift` check.

### Out of scope

- **A local, unpublished source for a unit.** A style layer is a package specifier here. Letting a layer
  be a directory inside the consuming repository is [RFC-0006](../../rfc/0006-the-repository-as-a-source-of-vibe-ops-units.md),
  and the two land independently — this plan adds specifiers, that RFC adds a source for them.
- **A `docs` governance type.** The Diátaxis skeleton stays `seed` in `governance-base`; the type is what
  to write if a quadrant ever becomes a record.
- **Publishing the packages.** Every package here is resolved from this workspace; whether and when they
  reach a registry is decided elsewhere.
- **Retiring `${CLAUDE_PLUGIN_ROOT}` itself.** The skills still live in the plugin and still resolve
  their own files that way. What ends is its use for policy and for files written into a repository.

## Design

### The rule the plan enforces

A file this tooling writes into a repository, or a policy a skill applies before writing one, is owned by
exactly one governance package: shipped under a version, named in an `ownership.json` fragment, carrying
its migration notes, and served through the CLI. A package that keeps no records owns files the same way,
minus the record. A file with no owner is not shipped.

### How a policy is reached after this plan

A skill that reads a policy stops resolving a path and asks the CLI, which resolves the package that owns
the facet through the repository's own bindings.

```mermaid
flowchart TD
    S["a skill about to write into a repository"] --> Q{"which policy?"}
    Q -->|"convergence, migration mechanics"| B["records norm --type base --facet policy --name …"]
    Q -->|"exposure"| C["records norm --type classification --facet policy --name exposure"]
    Q -->|"the harness itself"| H["harness model | pair | ownership"]
    Q -->|"how to write this artefact"| ST["records norm --type style --facet policy --for &lt;target&gt;"]
    B --> R["the package that owns the facet"]
    C --> R
    H --> R
    ST --> STACK["the style stack, layer by layer"]
    STACK --> M["merge by section key, last layer wins"]
    M --> W["one text, with --explain naming each section's origin"]
    R --> W
```

### The style stack

`types.style` binds an ordered list of layers rather than one package. A layer is a package named for the
voice it carries, with an optional scope naming the artefacts it applies to; `"@voice/conciso/{plan,task}"`
applies to a plan and a task, `"@voice/explicativo{^rfc}"` applies to everything except an RFC. Inside a
package, `general.md` is what applies to every artefact and `<target>.md` carries only that target's
delta.

Serving `--for plan` concatenates, in layer order, each applicable layer's `general.md` followed by its
`plan.md`. The merge unit is the section, keyed by its heading slug or by an explicit key; a repeated key
replaces, a new key appends. Resolution belongs to whoever composes the stack, never to the package
author — `on: "append"` and the per-key `rules` map are written in the binding, because only the
repository sees two layers at once. A collision nobody declared is reported at the severity the repository
chose (`error | warn | off`, defaulting to `warn`) and never aborts a run. RFC-0005 §2.1 carries the full
specification, including both binding forms.

### What the scaffold becomes

`setup scaffold <shape> <target>` stops copying a template directory. It writes, for every activated
governance, that package's `scaffold/` contribution and the placeholders that package declares, plus the
harness's own files through `harness install`. The record templates come from the packages that own them,
so the five byte-copies and the drift check that held them in sync both disappear.

Two files are rendered rather than copied, from a new manifest field `lifecycle` (the status chain, what
is immutable and when, the living sections, the archival directory): `agents/rules/governance.md`, which
is `norm`, and `GOVERNANCE.md`, which is `shaped` — the tooling owns the rendered lifecycle sections and
the repository owns every other section of that file permanently. With both rendered, `35-dogfooding-drift`
has no pair left and is retired rather than kept.

### What stays in the plugin

The skills, because they carry judgement; the two read-only agents, `governance-auditor` and
`migration-rehearser`; `hooks.json`, because it is the binding to one agent host; and the manifest. A
second binding for another agent host ships the equivalent of those and nothing else.

## Tracks

- [x] **Track 1 — The policy facet, and the references it receives.** `records norm` gains a `policy`
      facet and a `--name` flag selecting which of a package's `facets` to serve, with `NormFacet` staying
      a closed enum. `convergence-policy` and `template-shape-change` move into `governance-base`,
      `exposure-contract` into `governance-classification`, and `harness-model`, `harness-pair` and
      `ownership` are served by the `harness` package. Each keeps its `vibe-ops-reference: <name>@N` stamp.
      The ten skills and the seven CLI source files that resolve these by path repoint to the verb;
      `plugin/references/` is deleted with its README, and `references-completeness` becomes a gate over
      every activated package's facets. At the end, no file under `plugin/` reads a reference by path and
      `vibe-ops check` is green.

- [x] **Track 2 — The manifest that admits the new shapes, and the ADR behind it.** `parseTypeUnit` makes
      `template` and `dirs` optional, and adds `facets`, `lifecycle` and `targets`; a manifest may declare
      `units: [...]`, each a full type unit, and `activateGovernance` caches by `package#type` instead of
      by package name. `records norm --facet template` on a policy-only type refuses, naming it as such.
      The successor ADR to ADR-0019 is written with this track, recording that one artifact is one *unit*
      and a package may ship several. At the end a fixture package shipping two units activates, both
      resolve, and the existing single-unit packages are unaffected.

- [x] **Track 3 — `governance-knowledge`, and the two packages that owned files without a fragment.**
      `governance-log` becomes `governance-knowledge` with units `log` (moved whole, keeping its type
      name, noun, MCP tool, settings keys and fragment globs) and `learning`, which is not in the default
      bindings. `knowledge-lifecycle` becomes the package's policy facet. `governance-license` and
      `governance-classification` gain `ownership.json` fragments; `governance-license` also takes the
      files the `license-setup` skill ships today — the NOTICE and AUTHORS templates, the header-check
      script and its two CI workflows, the two rules documents — as its scaffold contribution, and
      `get-license.sh` becomes `license get <id>` and `license verify <file>` over the registry that
      package already carries. At the end a repository binding `log` by default sees no change, and
      `plugin/skills/license-setup/` ships no file of its own.

- [x] **Track 4 — `governance-style` and the layered stack.** The type, the default package
      (`general.md` plus a fragment per target it documents), and `types.style` in the default bindings.
      The composition RFC-0005 §2.1 specifies: both binding forms, the scope grammar, the section-keyed
      merge, `--for` and `--explain` on `records norm`, and `on` / `rules` / `onCollision` read from the
      binding. The four authoring skills read the style through the CLI, each naming the target it is
      writing. At the end a two-layer stack serves one merged text, `--explain` names each section's
      origin, and an undeclared collision warns without failing.

- [x] **Track 5 — `governance-instructions`.** The type, `instruction-surfaces` as its policy facet, and
      its scaffold files (`root/CLAUDE.md`, `agents/rules/repo-guardrails.md`, `agents/skills/.gitkeep`).
      It ships no gate: gates are resolved from `vibe-ops-gates` alone and the `agents-md` ops keeps
      composing them as it does today. At the end the instruction surface's policy and scaffold have one
      owner, and the ops still reports the same checks.

- [x] **Track 6 — The scaffold as a composition, and three retirements.** `setup scaffold` writes each
      activated governance's `scaffold/` contribution with its declared placeholders, and the harness's
      files through `harness install`; `project/<type>/.gitkeep` comes from each type's `dirs`.
      `agents/rules/governance.md` and `GOVERNANCE.md` are rendered from `lifecycle`, the second as
      `shaped`. The `scaffolder` agent is retired, ADR-0013 kept as the policy with its one instance gone,
      and `35-dogfooding-drift` retired with its last pair. At the end a freshly scaffolded repository has
      no file whose owner is the plugin, and a second promulgation preserves a section the repository
      wrote into `GOVERNANCE.md`.

- [x] **Track 7 — The hook surfaces.** `plan-progress-nudge.sh` becomes `vibe-ops hook plan-progress`,
      with the handler exported by `governance-plan` and dispatched by the CLI's `hook` namespace;
      `session-state-cleanup.sh` becomes `hook session-cleanup`, and the touched-repositories helper a
      function of the CLI. The host-specific inputs the nudge reads today — the session transcript path,
      the plugin data directory — arrive on the payload from the binding and are never resolved by the
      CLI. At the end `hooks.json` names `vibe-ops` on all nine registrations, no `.sh` remains under
      `plugin/`, and the nudge's existing behaviour test passes against the new surface.

- [x] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the tracking
      issue closed. The plan file itself is kept.

## Success criteria

Every criterion below is observed on an ordinary run, with no flag an operator has to remember.

1. `find plugin -name '*.sh' -o -name 'references' -type d` prints nothing, and
   `grep -rn 'CLAUDE_PLUGIN_ROOT.*references' plugin cli` finds no match.
2. `vibe-ops check` in this repository reports the same number of failures as before the plan — zero —
   with `references-completeness` reporting over package facets rather than skipping.
3. `vibe-ops records norm --type base --facet policy --name convergence --print` prints the convergence
   policy with its `vibe-ops-reference` stamp intact, and the same holds for `migration`, for
   `classification`'s `exposure`, and for the three the `harness` package serves.
4. A repository that declares nothing about `log` keeps its `project/log/` records, its noun and its MCP
   tool working, resolved through `governance-knowledge#log`.
5. In a scratch repository binding two style layers, `vibe-ops records norm --type style --facet policy
   --for plan --print` prints one text whose sections come from both layers, `--explain` names each
   section's origin package and file, an undeclared collision prints a warning and exits zero, and the
   same stack with `onCollision: "error"` exits non-zero naming both claimants.
6. `vibe-ops setup scaffold` into an empty directory produces a repository whose `GOVERNANCE.md` and
   `agents/rules/governance.md` describe exactly the types that repository activates; editing a
   repository-owned section of `GOVERNANCE.md` and promulgating again leaves that edit intact while the
   rendered sections are refreshed.
7. `vibe-ops ownership check` (or the equivalent gate in an ordinary `vibe-ops check` run) reports no
   unclassified path among the files the scaffold wrote.
8. Nine of nine registrations in `plugin/.claude-plugin/hooks.json` invoke `vibe-ops`, and the nudge's
   behaviour test passes against `vibe-ops hook plan-progress`.

---

## Decision Log

- Decision: The delegation split follows the routing policy already agreed for this workspace's work,
  which wins over any split invented for this plan. In practice: a deterministic answer — enumerating the
  readers of a reference, grepping for a path, running a fixed command — is not delegated at all; one
  well-specified implement of a single track goes to one subagent behind a real gate (`npm test`, the
  typecheck and `vibe-ops check`), escalating to a stronger model only when the gate fails; an adversarial
  review of each track's diff is its own subagent, told which part of the diff is risky; and everything
  that has to agree with RFC-0005's intent stays in the main loop — the manifest's semantics, the style
  merge algorithm, the default bindings, the successor ADR, and any edit to a file two tracks both touch.
  Rationale: the measured record behind that policy is that a well-specified single-package implement
  holds behind a real gate, and that what it misses sits at the scope boundary, which is the review's job;
  meanwhile a judgement delegated without the plan in hand comes back plausible and drifted. Writing the
  split here rather than leaving it in the conversation is the point of the entry: a conversation is
  summarised away, this file is not.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: Tracks 3, 4 and 5 may run concurrently once Track 2 has landed, and Tracks 1 and 7 may run
  concurrently from the start, but every edit to a file more than one of them touches — the default
  bindings, this repository's own `AGENTS.md` files, `docs/` — is made in the main loop after the
  concurrent work returns.
  Rationale: two agents writing the same file in one stage is the failure mode that costs more to
  reconcile than the concurrency saved.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: A track that runs concurrently with another gets a worktree created for it explicitly, from
  the tip of the branch the work is on, rather than one requested from the harness's own isolation.
  Rationale: the harness cuts an isolated worktree from the default branch, so the first concurrent track
  opened onto a base that predated this plan and had to be stopped and re-based before it could start —
  and once re-based it ran in the shared worktree anyway, where `npm test` deletes every package's `dist/`
  and would have broken the other track's gate mid-run. Isolation that is requested rather than
  constructed is isolation nobody verified.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: A manifest field this plan adds gets a reader in the track that adds it, rather than waiting
  for the track that consumes it. `lifecycle` was specified for Track 6's renderer, and was declared on
  `governance-plan` and wired into `plan resolve` in Track 2 instead.
  Rationale: this plan's own motivation is that a file with no owner has no version, no migration and no
  reader — and a field with no reader is the same debt one level down. Wiring it immediately also proved
  the parse against a real type: changing the declaration moved `PLAN_ACTIVE`, which no test of the
  parser alone would have shown.
  Date / Author: 2026-09-08 / Danilo Borges

- Decision: A file's lead-in does not merge like a rule. The first applying layer's title and intro are
  the document's; a later layer's are dropped and reported as a collision, and the reserved key cannot be
  claimed by an explicit marker.
  Rationale: the RFC never special-cased a lead-in, and treating it as an ordinary section was implemented
  faithfully and read wrongly — replacing put the top layer's title over a document that is mostly the
  base's, and appending stacked two `#` titles. The base of a stack names the document; a rule does not.
  Date / Author: 2026-09-09 / Danilo Borges

- Decision: `license` and `classification` stay opt-in bindings, and `/license-setup` declares the binding
  itself as its first step rather than the default map gaining an entry.
  Rationale: activation-as-opt-in is right for a package's records and ownership fragment, and the skill
  was unusable without it — but running the skill IS the act of opting in, so the declaration belongs to
  the skill, not to every repository that never wanted a licence workflow.
  Date / Author: 2026-09-09 / Danilo Borges

- Decision: An ownership fragment composes once per PACKAGE, not once per bound type.
  Rationale: a fragment belongs to a package, and the composition loop walks type names — so a two-unit
  package's entries were counted twice, invisibly, because a duplicate is identical match plus identical
  class and the conflict check reads that as peers agreeing.
  Date / Author: 2026-09-09 / Danilo Borges

- Decision: `GOVERNANCE.md` carries the MAP and the rule carries the MECHANICS; neither restates the
  other.
  Rationale: both documents rendered the same five `###` sections, so the human-facing one was a strict
  subset of the rule while each pointed at the other for what it did not have — the rule's preamble sent
  readers to `GOVERNANCE.md` "for the what and why", at a document that had none. The map's per-type row
  is data now (`answers` plus the chain in one cell), so it stays current with what a repository
  activates, which is what the old static table could not do.
  Date / Author: 2026-09-09 / Danilo Borges

- Decision: A status that leaves the chain is a `branch`, never another link in it.
  Rationale: `adr` declared `[Proposed, Accepted, Superseded]` with `terminal: "Accepted"` and printed a
  diagram running two names past the sentence under it, while `Deprecated` — which its own template
  offers — had nowhere to be. Two of the five shipped types have a branch. `terminal` must now be the
  chain's last link, so the contradiction is refused at parse time rather than rendered.
  Date / Author: 2026-09-09 / Danilo Borges

- Decision: `research` leaves the preamble, the skill and the checklist rather than gaining a package.
  Rationale: no package ships that type, so the scaffold never created its directory and the rule
  described a folder that did not exist — the exact "a file with no owner has no version, no migration
  and no reader" debt this plan removes. Binding a `research` package is how a repository that wants one
  gets it, which is RFC-0005's whole design; inventing a template and authoring rules to keep the word
  would have been fabrication.
  Date / Author: 2026-09-09 / Danilo Borges

- Decision: The commit hook and the CI workflow are opt-in on `harness install`, off by default.
  Rationale: the setup skill has said "offer, do not assume" about both since before the verb existed,
  and the reason is not style — a commit hook changes what every `git commit` in somebody's clone does,
  and a CI workflow is a snapshot. The verb installed both with no prompt, no flag and no way to decline.
  Date / Author: 2026-09-09 / Danilo Borges

- Decision: `GOVERNANCE.md` is `shaped` in the ownership declaration, and promulgation writes it.
  Rationale: the plan said `shaped` throughout and the renderer was built for it, but the fragment still
  said `seed` and sync had no `shaped` branch at all — so the one file whose contract is "the tool owns
  named parts, the repository owns the rest" was the one file promulgation never updated. seed → shaped
  is a widening, which asks a repository holding a receipt for consent; that is the mechanism working,
  not a cost to route around.
  Date / Author: 2026-09-09 / Danilo Borges

## Outcomes & Retrospective

**Track 6 landed, and then a three-way adversarial review of it found seven blockers** — `93d04ca`,
`3b86d2f`, then `727c811`, `657c952` and `4ed9640` closing them. Goal 4 is met: a freshly scaffolded
repository has no file whose owner is the plugin, and it passes its own gate — 37 checks, 0 failed,
probed into a real git repository rather than argued.

**Six of the seven were invisible from every output, and that is now this plan's fourth round saying so.**
A deleted END marker took the append path and created a second BEGIN that paired across the repository's
own prose, which the *next* render deleted — silently, exit 0. A package declaring a `notes` fragment it
did not ship lost its whole section from both governance documents of every consuming repository, with
the gate green. `harness install` read `# TODO: some day run vibe-ops check here` as an installed gate,
kept the hook, warned about nothing and reported success over a repository with no gate. The one finding
that announced itself was the CI workflow, and only because it would have gone red on somebody else's
first push.

**The largest was not a code defect at all.** Thirty-four of thirty-four statements from the old
`GOVERNANCE.md` were gone — the artifact table, the flow, where a learning goes, issue pairing, the
decision record — lost in an editorial carve that moved the lifecycles into data and dropped everything
the lifecycles were not. Nothing could have caught it: every test passed, the gate was green, and the
document that replaced it was well-formed. It was found by one reviewer diffing the old file against the
new one sentence by sentence, which is the instrument this kind of loss needs and no gate is.

**Two things the review found were in the fragments, not the code**, and both were real: `GOVERNANCE.md`
was declared `seed` while every document about it said `shaped`, and `governance-knowledge` declared
`authoring` for both its units and shipped no such file. The second was surfaced by turning the gate on —
`facet-completeness@3` reads every path a manifest declares, and its first run failed on this repository.
A gate that finds a real gap on its first run is the gate working; the fix was to write the missing rules.

**Track 7 landed** (`01bf2db`): `plan-progress` and `session-cleanup` are CLI hook surfaces, the nudge's
decision logic sits in `governance-plan` as a handler, and `plugin/hooks/` and `plugin/scripts/` ship no
script. Goal 5 is met. The commit went in with the gate skipped, because the shared worktree also held
another track's incomplete work; the branch is red on the link gate until the documents that point at
moved files are updated, which is main-loop work by this plan's own second decision.

**Track 1 landed** (`47f5a8e`): `records norm` serves a `policy` facet by name, five policy documents
belong to the packages whose policy they are, and nineteen readers name a command instead of a path.

**Both tracks were reviewed adversarially and both had real defects**, three of them in behaviour that
had already landed. The review of Track 7 also answered the question it was given: the behaviour test
whose expectation the port rewrote had never executed — it resolved a directory that has never existed —
and the case it asserted was one the original shell never had, which a differential run of the
unmodified test against the unmodified script proved by failing exactly there.

What the two reviews are worth recording for is the shape of what they found. Three of the five defects
were **a guard that did not guard**: a gate passing over an empty population, a description reading one
layer of a ladder its resolver reads whole, and a test suite reporting a skip whose reason was false. All
three were green. None of them would have been found by running the suite, because each was the suite
agreeing with itself.

**Track 2 landed** (`adb3c7a`): a manifest may declare `units`, a binding picks one with `#type`, and the
activation cache is keyed by `<package>#<type>`. Goal 2's mechanism is not in place yet, but the hinge
is: Tracks 3, 4 and 5 can now each add a type.

The defect that track removed is the one worth carrying forward, because it is the same shape as the
three above. Keyed by package name, a second binding to a package was handed whatever the first had
resolved — a real unit, with a template and facets, answering every question about the wrong artifact
and reporting nothing. It could not have been noticed from any output, which is why the test states that
case in words rather than asserting a return value.

**Tracks 3, 4 and 5 landed together**, written concurrently in three worktrees and merged here. Goals 1,
2 and 3 are met: `plugin/references/` holds only its own README, every package that ships a file into a
repository names it in a fragment, and a repository can bind a stack of writing styles scoped per
artefact. Two adversarial reviews then found eight defects, and what they have in common is worth more
than the list.

**Seven of the eight were invisible from every output the tooling produces.** A typo in `types.adr`
unbound the type and ADR checking stopped, green. An ownership fragment counted twice read as peers
agreeing. A refusal printed the document it was refusing. A key repeated inside one file kept the second
copy and said nothing. That is the same shape as Track 1's and Track 7's defects, and it is now the
plan's most repeated finding: **this system's failures do not announce themselves — they answer.**

**One correction to the record.** A `SKIP [license-texts]` was read here as a guard Track 3 had broken,
and the Track 3 brief opened with it. It was the globally installed CLI composing its own bundled
packages: the in-tree run reports the check passing. The lesson is not about that check — it is that a
repository whose gate resolves its binary from `PATH` can be red for reasons that are not in its tree,
and that the commit gate this repository ships to others has exactly that shape.

**Deferred, with the reasons.** `pin` and `digest` went with the shell script while `SOURCES.tsv` still
instructs a maintainer to run them. `.githooks/pre-commit` is written by the licence skill and claimed by
the harness base as `norm`, which would overwrite it; adding it to the licence fragment would be a
two-class conflict, so it needs a decision rather than a line. Neither blocks Track 6.

<!-- ===== END LIVING SECTIONS ===== -->

---

---

## Closure — the goals, answered one by one

Every criterion below was **run at closure**, not recalled. Two of the eight had never been executed
before this pass, and one of those two failed.

| Goal | Verdict |
|---|---|
| 1 — the plugin ships no policy, no template, no script | **Met.** `find plugin -name '*.sh'` is empty and there is no `references/` directory. One `grep` hit survives, in a comment inside `module-check/sh/unported/check-agents-md.sh` describing a fixture; the criterion was written as a grep and the grep is not clean, while the thing it was protecting is. Recorded rather than edited away. |
| 2 — every file written into a repository is classified | **Met, after a fix at closure.** See below. |
| 3 — a repository binds a stack of writing styles | **Met.** Two scratch layers both serving `general.md`: three sections composed from both, `--explain` naming each section's origin file, the collision on `voice` warning and exiting 0, and the same stack with `onCollision: "error"` exiting 1 naming both claimants. |
| 4 — the two governance documents are rendered, not copied | **Met.** A scaffolded repository's documents describe exactly what it activates, and a repository that binds a sixth type afterwards sees it appear on the next promulgation — which needed the work below to be true at all. |
| 5 — `hooks.json` names `vibe-ops` everywhere and the plugin ships no script | **Met.** 9 of 9 registrations invoke `vibe-ops`; zero `.sh` under `plugin/`. |

### What closure itself found

**Goal 2 was not met until closure.** Criterion 7 had never been run. Executed against a freshly
scaffolded repository — 28 files, composed boundary, `classOf` per path — one path came back
unclassified: `tsconfig.base.json`. The build-baseline entry named `tsconfig.json` and
`tsconfig.build.json` by hand while its per-package sibling already used `tsconfig*.json`, so the
scaffold wrote a file that promulgation would then have stopped on, naming a path its own scaffold had
just created. The glob is `tsconfig*.json` now. **A criterion nobody executed is a prediction**, and this
one was wrong.

**The `facet-completeness` gate reports `53 examined, 53 ignored`, which reads like a guard that does not
guard.** It is not: planting `notes: "./nowhere-planted.md"` in `governance-adr/type.json` made the run
fail naming the file and the package, and removing it made the run green again. The `ignored` count is
the ops's file population, which this gate does not use — it re-derives its own subjects. Recorded
because the number invites exactly the wrong conclusion, and this plan has been wrong about a
green-looking guard four times.

### Routing — Step 3

This plan spawned **no task dossier**, which is the case its own closure skill names as the one with no
other exit. Three things were tested against the promotion test and placed:

1. **A repository's gate resolves `vibe-ops` from `PATH`, so a branch that retires a check still fails
   against a stale global install.** Names a file someone meets again → `project/log/`, below.
2. **A document rendered from data can be well-formed and still have lost most of what it said.** Holds
   beyond this repository, and it is the finding this plan made four times → carried in the
   retrospective above rather than promoted, because the surface that would receive it is a review
   practice this repository does not yet have a home for. **Blocked; what unblocks it is a place for
   review method to live** — named here so the next plan inherits it rather than rediscovering it.
3. **The setup skill described a copy manifest that no longer existed.** A prescription for how a skill
   behaves → the edit was made to `plugin/skills/setup/SKILL.md` (`657c952`), which is placement 3 of the
   promotion test, not a candidate to file.

### Demotion — Step 4

Nothing to delete. The guards this plan added (`facet-completeness@3`, the parser's `terminal`/branch
refusals, the marker-pair refusal) replaced *silence*, not prose — there was no `AGENTS.md` line or rule
asserting any of it, which is why each failure was invisible. A guard that makes a sentence redundant is
the ordinary case; a guard that makes nothing redundant is what you get when the gap was never written
down.

## Open questions

None. RFC-0005 closed the five it carried before this plan was cut.

## Related

- [RFC-0005](../../rfc/implemented/0005-every-shipped-file-belongs-to-a-governance-and-the-plugin-binds-the-cli.md) — the
  design this plan implements, including the full `style` specification in §2.1.
- [RFC-0006](../../rfc/0006-the-repository-as-a-source-of-vibe-ops-units.md) — a local source for units,
  which is how a style layer exists without being published. Independent of this plan.
- [ADR-0019](../../adr/0019-one-artifact-one-governance-package-activated-by-config.md) — the decision Track
  2's ADR succeeds.
- [ADR-0013](../../adr/0013-the-model-a-shipped-plugin-may-pin.md) — the policy whose one instance, the
  `scaffolder` agent, Track 6 retires.
- [Plan-033](./033-one-artifact-one-governance.md) — the rule this plan extends past records.
