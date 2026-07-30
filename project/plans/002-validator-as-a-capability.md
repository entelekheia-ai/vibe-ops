<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-002: The Validator as a Capability

| Field | Value |
|---|---|
| Status | Backlog |
| Created | 2026-07-30 |
| Author | Danilo Borges |
| Depends on | [Plan-001](001-knowledge-lifecycle-retrofit.md) |
| Tracking issue | [#3](https://github.com/entelekheia-ai/vibe-ops/issues/3) — owns status and the executive summary; this file owns the design and the working record |
| Related | [ADR-0004](../adr/0004-budgeted-artifacts-and-guards.md) |

---

## Summary

[Plan-001](001-knowledge-lifecycle-retrofit.md) produced `scripts/check-agents-md.sh` and left it where it
could only ever check one repository: this one. The checks it performs are exactly the ones every skill in
this plugin currently asks an agent to perform by hand, in every repository it touches. This plan turns the
script from a file this repository owns into a **capability the plugin applies to whatever repository it is
working on** — invoked by the skills that change instruction surfaces, composed at runtime for what the
target repository actually contains, and never writing anything into that repository unless the user asks
for the CI copy.

## Goals

1. A skill that changes an instruction surface verifies its own work mechanically, in the target
   repository, without the plugin writing a file there.
2. Anything the validator now enforces is **deleted** from the prose checklists that hand-check it — the
   demotion Plan-001 identified and could not apply.
3. Private names never touch the target repository's working tree, at any point, including as an input to
   the check that looks for them.
4. A composed check is auditable: what ran is reconstructable from versioned fragments, not from a model's
   memory of what it wrote.
5. The validator is discoverable as a feature by someone who installs the plugin, not only by someone
   reading this repository.

## Scope

### In scope

`scripts/check-agents-md.sh` and its fragments; the invocation steps in `repo-setup`,
`authoring-agents-md` and `close-task`; the runtime composition in a temporary directory; the opt-in CI
installation; the `README.md` entry; and the checklist demotions in `authoring-agents-md`.

### Out of scope

**Making the validator part of the scaffolded baseline by default.** A scaffolded repository does not
silently acquire a script and a CI job. The CI copy is offered, once, and declining is a normal outcome.

**Checks for anything other than instruction surfaces.** No linting, no formatting, no package-manifest
validation. The script's subject is the files agents read at session start; a general-purpose repo linter
is a different tool with a different name.

**Inferring the private-name deny-list.** An agent guessing which names are private is wrong in both
directions — it omits what matters and includes what does not. The list is supplied, never derived.

## Design

The script already takes a repository root as its first argument and drives everything through
`git -C "$ROOT"`, so it can check a repository it does not live in. Three things follow from that.

**It runs from the plugin, and is not copied.** Skills invoke
`${CLAUDE_PLUGIN_ROOT}/scripts/check-agents-md.sh <target>`. Copying it into each repository would freeze
it at the version of the day it was written — the greedy-`sed` bug found in Plan-001 would still be live in
every repository that took a copy — and it would contradict the plugin's own promise of no per-repo copies
to maintain. The default for `ROOT` changes from "the directory above this script" to the working tree of
the current directory, so an invocation without an argument means the target rather than the plugin.

**What is composed is composed in a temporary directory and deleted.** Two things cannot live in the
plugin because they depend on what is on disk or on who is running: the assembled private-name deny-list,
and checks derived from the target's shape. These are written to `mktemp -d` (mode 700), consumed, and
removed by a `trap` on exit, so an interrupted run leaves nothing behind. This is strictly better than a
persistent user-level config for the deny-list: a permanent file of private names is a standing exposure,
where a temporary one exists only for the duration of a run.

**Composition assembles versioned fragments; it does not author checks.** A check written freehand at
runtime and deleted afterwards cannot be diffed, reviewed, or trusted — and if it silently stops detecting
something, no evidence survives. That is the failure ADR-0004 exists to avoid, wearing a shell script's
clothes. Fragments live in the plugin under version control, the composition step only selects and
parameterizes them, and the run prints which fragments it composed.

The CI case is the one consumer that genuinely needs a copy, because CI does not have the plugin installed.
That stays an explicit offer in `repo-setup`, with the copy's nature stated: it is a snapshot, and it will
not receive fixes.

## Tracks

**T1 — Make the script target-agnostic.** Today an invocation without an argument checks the directory
above the script, which is correct only when the script is being run from inside the repository it belongs
to. Change the default to the enclosing working tree, add a fragment-composition entry point, and make the
run report which checks it assembled and from where. At the end, running the script from the plugin against
an unrelated repository is the ordinary case rather than a special one. Acceptance: run from the plugin
root against a scratch repository, it reports on that repository and writes nothing into it.

**T2 — The composed deny-list.** The private-name check currently reads `PRIVATE_NAME_LIST` and skips when
unset, which is honest but puts the burden on the user to have created a file somewhere. Add a composition
step that assembles the list into a temporary file for the duration of the run, from a source the user
supplies once, and deletes it on exit. At the end the names exist on disk only while the check runs, and
never inside any repository being checked. Acceptance: the temporary directory is gone after both a
successful and an interrupted run, and the check still refuses to print a matched string.

**T3 — Skills invoke the check.** `authoring-agents-md` (after writing), `repo-setup` (final step, and as
part of the `audit` report), and `close-task` (after propagating to living docs) each run the validator
against the target repository. The four event skills do not — they write into `project/` and touch no
instruction surface, so a check there is latency against a risk that does not exist. Acceptance: each of
the three names the invocation; a run of `repo-setup audit` against a drifted repository shows validator
findings inside its gap list.

**T4 — Apply the blocked demotions.** With the guard reachable from any repository, the four hand-checked
items in the `authoring-agents-md` checklist that the validator now enforces are deleted and replaced by
the invocation. This is the demotion identified in Plan-001 and deliberately left unapplied. At the end the
checklist contains only what a human or an agent must still judge. Acceptance: no checklist item restates
something the script checks; the checklist is shorter than it was.

**T5 — The CI copy, as an offer.** A step in `repo-setup` that offers to write the script and a workflow
into the target repository, stating that the copy is a snapshot which will not receive later fixes.
Declining is a normal outcome and leaves no trace. Acceptance: accepting produces a passing CI job on the
target; declining writes nothing.

**T6 — Make it visible.** The validator moves from the README's "This repository" table, where it reads as
internal machinery, into what the plugin *does*. Written only after T3, because announcing a capability
that has no invocation path is a promise rather than a feature — and, per the finding below, the
invocation path does not exist in **any** install until a release is cut, which makes cutting one part of
this track. Acceptance: a reader who has installed the plugin and never opened this repository can tell
what the check does and how it runs, and the version they have on disk contains `scripts/`.

**T7 — Close the routing hole.** Plan-001's own retrospective found that the knowledge-routing step lives
only in `close-task`, so a plan that ships without ever spawning a task dossier reaches its end and routes
nothing — which is what happened to Plan-001 itself. Decide where the step belongs for a plan (a step in
`new-plan`'s maintenance contract, a `close-plan` skill, or a checklist item in the governance rule) and
write it down. Acceptance: shipping a plan with no task dossier has a stated, discoverable point at which
its `Surprises & Discoveries` entries get routed.

## Success criteria

- `${CLAUDE_PLUGIN_ROOT}/scripts/check-agents-md.sh <some-other-repo>` reports on that repository, and
  `git -C <some-other-repo> status --porcelain` is unchanged afterwards.
- `./scripts/check-agents-md.sh --self-test` still passes, and CI still runs it before the real check.
- No temporary directory survives an interrupted run.
- The `authoring-agents-md` checklist has no item that the script also checks.
- `grep -c '' README.md` shows the validator described as a capability, outside the "This repository"
  section.
- Shipping a plan without a task dossier has a documented routing point (T7).

---

## Progress

- [x] (2026-07-30) T1 — the six checks moved into versioned fragments under `scripts/checks/`
      (`NN-<id>.sh` defining `check_<id>`); the driver composes them, refuses a fragment that defines
      nothing, and prints what it assembled and from where. `ROOT` with no argument is now
      `git rev-parse --show-toplevel` of the current directory, and a non-repository is a usage error
      rather than a run that quietly checks nothing. `VIBE_OPS_CHECK_DIRS` composes extra directories
      after the built-ins — the seam T2 needs. Verified against a scratch repository from the plugin
      root: it reported on that repository, and `git status --porcelain` plus a full `find` were
      identical before and after.
- [x] (2026-07-30) T2 — the deny-list is composed into a `mktemp -d` (mode 700, file mode 600) from
      either `PRIVATE_NAME_LIST` (a file outside every tree) or `PRIVATE_NAMES` (inline), removed by an
      `EXIT` trap and by an `INT`/`TERM`/`HUP` handler. Composition expands each supplied name into its
      separator variants, so a name supplied hyphenated is caught spelled with a space — verified in the
      self-test, where the fixture says `padding line` and the deny-list says `padding-line`. A hit
      reports its provenance (`list:2`, `inline:1`) and never the string. A missing or git-tracked
      source is exit 2, not a passing check. The self-test now also asserts nothing survives a normal
      **or** an interrupted run; stripping both cleanup traps makes it fail with the leftovers named.
- [x] (2026-07-30) T3 — `authoring-agents-md` runs it in the survey (Step 2, so its findings enter the
      gap list and the `audit` report) and again as a new Step 9 after writing; `repo-setup` runs it in
      Step 0's survey and in Step 7 after staging, with the note that a red run there means the skeleton
      it just laid down is broken; `close-task` runs it after Step 3's propagation, because propagating
      is where a doc moves and a link that stopped resolving is invisible in a diff. The four event
      skills do not, as planned.
- [x] (2026-07-30) T4 — the four hand-checked items are gone from the `authoring-agents-md` checklist,
      which drops from 11 items to 10 while gaining the invocation. Two were deleted outright — the
      symlink/`description:` item, which the `bridge` and `frontmatter` checks cover completely, and the
      personal-memory item, whose `[[…]]` half is now the `memory-slugs` check and whose remainder
      already lives in `references/authoring-style.md`. Two were narrowed to the half the script cannot
      see: "every path named exists" became "no folder on disk is left undescribed" (the reverse
      direction is judgement), and the `wc -l` item became "anything cut was **relocated**", which was
      always the part worth checking.
- [ ] T5 — the CI copy as an explicit offer.
- [ ] T6 — README, after T3.
- [x] (2026-07-30) T7 — resolved as a **`close-plan` skill** (`effort: high`,
      `disable-model-invocation: true`), not a checklist item and not a step folded into `new-plan`. It
      carries the retrospective-against-goals, the routing pass, the demotion check, and the rule that a
      *blocked* promotion is recorded with what unblocks it rather than half-applied. `GOVERNANCE.md` and
      the `project/**` rule now state that every artifact has a closure performing the routing — the two
      differ in what survives, not in whether it happens. Chosen over the alternatives once measurement
      showed a user-invoked skill costs no context: the objection to adding one had been budget, and the
      budget was not real.

## Surprises & Discoveries

- Observation: a skill marked `disable-model-invocation: true` costs **zero** context. It is filtered out
  of the listing sent to the model entirely, not merely deprioritized.
  Evidence: the installed CLI (2.1.220) builds the listing as
  `Qpr().filter(d => !d.disableModelInvocation && !MTe(d))`. Eight of this plugin's nine skills carry the
  flag, so the model-facing cost is one entry — `repo-setup`, at 596 characters. The intuition that "more
  skills means more context" is true only for skills the model is allowed to trigger, which here is one.
  Consequence: adding a user-invoked skill is not a context decision, and an umbrella skill collapsing
  several would have saved nothing while costing trigger precision and per-skill `effort`.

- Observation: the skill listing has a hard budget with a documented degradation, and neither was known
  here.
  Evidence: same binary — `budget = context × 4 bytes/token × 0.01`, i.e. **8,000 characters** by default,
  shared across every installed plugin; each description capped at **1,536 characters** and truncated with
  an ellipsis; `when_to_use` counted as part of the description. Over budget, entries are ranked by
  `usageCount × max(0.5^(days/7), 0.1)` — recency-weighted usage — and the losers degrade to **name-only**.
  This plugin currently occupies 596 of 8,000, so there is no pressure; the number matters for anyone
  running many plugins at once.

- Observation: converting skills into subagents to save context moves the cost in the wrong direction.
  Evidence: agent descriptions on this machine average **1,223 characters** against a skill's 424, roughly
  three times as much, because the convention is to carry `<example>` blocks. Agent listings load the same
  way skill listings do.

- Observation: `${CLAUDE_PLUGIN_ROOT}` points at the **released** clone, not at this working tree — so
  every path this plugin has added since its last release is unreachable from a skill running today.
  Evidence: the installed plugin is a git clone pinned to a commit
  (`installed_plugins.json` records `gitCommitSha: 2ebf680`, the v0.3.0 release) and materialized at
  `~/.claude/plugins/cache/entelekheia/vibe-ops/0.3.0/`. `git ls-tree 2ebf680` has five entries; `HEAD`
  has seventeen. `references/` and `scripts/` are among the twelve that only exist here.
  Consequence: it is not a packaging bug — the whole repository ships, so both directories will be there
  once a version is cut. But every `${CLAUDE_PLUGIN_ROOT}/references/...` pointer written by Plan-001, and
  every validator invocation added in T3, resolves to nothing for anyone on 0.3.0. That makes cutting a
  release a **precondition for T6**: announcing the validator as a capability while the invocation path
  does not exist in any install is exactly the promise-not-a-feature failure T6 was written to avoid.

- Observation: this repository's `AGENTS.md` listed the `SKILL.md` frontmatter fields and was wrong by
  omission — including on the field that answers the question that prompted the measurement.
  Evidence: the schema accepts `name`, `description`, `model`, `effort`, `allowed-tools`,
  `disallowed-tools`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `shell` and
  `when_to_use`. The file named five. **`model` is settable per skill**, so a scaffolding skill and a
  routing skill need not share a model or an effort — which was the thing being asked. Corrected in place.

## Decision Log

- Decision: the validator runs from the plugin against the target repository, and is not copied into it.
  Rationale: a copy freezes at the version of the day it was taken — the greedy-`sed` bug found in
  Plan-001 would still be live in every repository holding one — and per-repo copies are exactly what this
  plugin's design exists to avoid. The script already accepts a repository root, so nothing about it needs
  to change for this to work.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: composed artifacts — the assembled deny-list, checks derived from the target's shape — live in
  a temporary directory for the duration of the run and are removed by a `trap`, rather than in a
  persistent user-level config file.
  Rationale: a permanent file containing private names is a standing exposure; a temporary one exists only
  while it is being read. This supersedes an earlier suggestion of `~/.config/vibe-ops/private-names`
  within this planning conversation — it was proposed and dropped before any of it was written.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: runtime composition selects and parameterizes **versioned fragments**; it never authors a check.
  Rationale: a check generated fresh each run and deleted cannot be diffed or reviewed, and if it stops
  detecting something the evidence goes with it. ADR-0004 argues a guard beats prose because it executes
  regardless of who read what; a guard rewritten by a model on every run is judgement again, in a shell
  script's clothing.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: templates keep being written into the target repository and are **not** part of the temporary
  composition.
  Rationale: `new-adr`, `new-rfc`, `new-plan` and `new-task` read the *target repository's own* template,
  which is the entire mechanism by which one skill serves every repository without becoming a copy. A
  template materialized in a temporary directory and deleted is not there for the next session. Temporary
  space is a staging area for placeholder expansion; the end state is still a committed file.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: keep one skill per operation. **No `manage-*` umbrella**, and no conversion of skills into
  subagents.
  Rationale: both were proposed to reduce always-on context, and measurement removed the premise — eight
  of nine skills are `disable-model-invocation: true` and therefore absent from the model's listing, so
  the plugin's real footprint is 596 of an 8,000-character budget. An umbrella would have saved nothing
  and cost two things that are per-skill and genuinely wanted: trigger precision, and independent `model`
  and `effort`. Subagents cost about three times a skill in the same listing.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: `close-plan` is a skill of its own rather than a step inside `new-plan` or a line in the
  governance rule. Resolves T7.
  Rationale: a checklist item relies on being read at exactly the moment someone is trying to finish, and
  the failure it guards against already happened once here — Plan-001 shipped and routed nothing. Making
  it invocable also makes it observable: there is a thing you ran, or did not.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: no fragment manifest — the run prints the composed list, and that is the audit trail.
  Resolves the second open question.
  Rationale: a manifest is a second place stating which checks exist, and the first thing to drift from
  the directory it describes. The printed list is generated from what was actually sourced, so it cannot
  disagree with the run; a fragment composed from outside the plugin prints its absolute path, which makes
  "this check did not come from the plugin" visible without anyone maintaining a list. A fragment that
  defines no check function is a hard error, so composition cannot silently drop one either.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: composition expands **spellings**, never membership. Which names are private is supplied;
  each supplied name is then expanded into its space / hyphen / underscore / squashed variants.
  Rationale: the scope line "the list is supplied, never derived" is about *which* names, and it holds.
  A name leaks as readily hyphenated as spaced, and expanding a given string by a fixed rule is
  mechanical — nothing is being guessed, so it is composition rather than inference. It also removes the
  most likely way the check quietly passes: the user wrote the name one way and the repository spelled
  it another.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: a deny-list that cannot be read is exit 2, not a failed check.
  Rationale: the one outcome that must be impossible is reporting "no private name found" after failing
  to read the list of names to look for. A missing file, or one that turns out to be tracked by git, is
  a misconfigured run rather than a defective repository, and the exit code should say which.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: "writes nothing into the target" is asserted by the self-test, not promised in a comment.
  Rationale: it is the whole basis on which a skill may run this against someone's repository, and it is
  exactly the kind of claim that stays true until one fragment gets careless. The self-test snapshots the
  fixture with `find` before and after and fails on any difference, so a fragment that starts writing is
  caught by the run that already exists in CI rather than by a reviewer reading it.
  Date / Author: 2026-07-30 / Danilo Borges

- Decision: the CI copy is offered, not installed by default.
  Rationale: CI is the only consumer that cannot reach the plugin, so a real copy is unavoidable there —
  but a scaffolded repository acquiring a script and a workflow it never asked for is the opposite of the
  baseline this plugin claims to lay down. The offer states that the copy is a snapshot.
  Date / Author: 2026-07-30 / Danilo Borges

## Outcomes & Retrospective

*Not started.*

---

## Open questions

*Both answered — see the Decision Log: the routing step became `close-plan` (T7), and the composition
prints its own list instead of carrying a manifest (T1).*

## Related

- [Plan-001 — Knowledge Lifecycle Retrofit](001-knowledge-lifecycle-retrofit.md), whose open question about
  shipping the validator this plan answers, and whose retrospective supplies T4 and T7.
- [ADR-0004 — Budgeted artifacts, and a guard instead of a line](../adr/0004-budgeted-artifacts-and-guards.md)
- [`references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md) — the promotion test, and
  the obligation to prove a guard fails.
