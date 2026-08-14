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

# Plan-025: The harness module, and the norm it promulgates

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Depends on | [Plan-027](027-one-resolve-and-a-schema-that-tells-the-truth.md) — Track 4's `resolve` verb waits on its consolidation |
| Related | [RFC-0002](../rfc/0002-bootstrapping-a-repository-and-what-auto-configuration-may-decide.md) · [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) |

---

## Summary

Everything this tooling knows how to write into a repository — rules, templates, the commit gate, the
configuration those read — currently gets there by a skill someone runs by hand, and leaves no trace that
says which version arrived. This plan builds the missing half: a `harness` noun that measures a repository,
promulgates a version of the norm into it on an isolated branch, and stamps what it delivered, so that
*"which repositories are on version N?"* becomes a command rather than an afternoon. It also folds in an
audit that exists today outside this repository as prose, splitting it at the line the tooling can defend —
the measuring half becomes commands that cannot mis-measure, and only the judging half stays a skill.

## Goals

1. A repository declares, in a file, which version of the norm it carries — and anyone can print that for
   several repositories in one command.
2. Nothing this tooling promulgates requires a per-clone manual step to work, and whatever must stay
   clone-local is a declared exception naming why — never a directory-wide rule nobody narrowed, whose
   reach is wider than the one file it was written for.
3. Promulgating into a repository never disturbs work in progress there, and never lands on a shared branch
   without a human deciding to merge it.
4. The boundary between what the norm owns and what a repository owns is written down, and a promulgation
   that would cross it stops and reports instead of writing.
5. The measurements a harness audit rests on are taken by commands with tests, not by a model composing
   shell at the moment it needs an answer.

## Scope

### In scope

The `harness` module and its verbs; the ownership boundary those verbs obey; the clone-local configuration
file and the applied-version map inside it; narrowing the ignore rules that would swallow what promulgation
writes; the source-and-target seam the module needs and the module contract does not yet have; and the
split of the existing harness audit into a deterministic half here and an inferential half that calls it.

### Out of scope

**Which channel performs a repository's *first* wiring, and what an automatic step may decide on its own.**
That is [RFC-0002](../rfc/0002-bootstrapping-a-repository-and-what-auto-configuration-may-decide.md), and it
is out of scope deliberately: its central rule is unstatable until Track 1 lands, and its candidate channels
each reach a different subset of repositories. This plan builds machinery that any of those channels can
call.

**A new composition over the harness apparatus.** Two detectors are named in Track 4 and both are useful,
but composing them into an ops is a separate decision about population, and the wrong time to make it is
while the module they would report on is still being designed.

**Checking a remote for a newer version.** A network check with a dismissal mechanism is a real pattern in
comparable updaters and is not warranted here: the norm is a local installation, so "what version is
available" is a file read.

## Design

The module is a **noun with verbs**, in the shape three governance nouns already use: `resolve` first,
answering where things are, and everything else built on what it returns.

Two facts about the current contract shape the design. First, **the target half is already solved**:
configuration resolution takes a starting directory rather than assuming the working directory, the CLI
resolves a repository root from any path inside it, and the MCP surface already accepts a repository
parameter. Acting on one repository that is not the current one costs nothing new. Second, **the source
half does not exist**: a module is handed exactly one repository root, and the token that expands to a
plugin surface resolves it *relative to the target*, which is the opposite of what promulgation needs. That
gap is Track 4, and it is small — one more resolved path in what a module is handed, declared only for the
modules that need it.

The verbs:

| Verb | Answers |
|---|---|
| `resolve` | where this target's harness surfaces are — rules, the bridge, the commit hook, configuration, the artifact path |
| `shape` | four facts that decide which recommendations are even available: whether there is a remote, where hooks live, what already runs, and what the repository's churn says it is for |
| `catalog` | everything available against everything actually composed here |
| `audit` | the measured inventory — guides with their always-on cost, sensors with their lifecycle position — writing nothing |
| `status` | the version this target carries against the version installed |
| `sync` | promulgation |

`catalog` deserves its own line because it exists to kill one specific failure. The audit this plan
internalises records, as a thing that actually happened, a confident recommendation to build a check that
was already written and merely unwired — sitting in a dependency the repository already had. A command that
prints what exists against what is composed makes that recommendation impossible to make, and it serves any
skill that recommends building something.

**Half of it now exists and the verb is smaller than designed.** The gate command lists what it would run,
naming each check's source file — seventeen entries, measured 2026-08-13. So "what is composed here" is
answered. What is not is the complement: the detectors and fragments that exist and are *not* composed,
which is the half a wrong recommendation actually turns on. `catalog` is that difference, and nothing more.

Two of the verbs are also constrained by work outside this plan. `resolve` waits on the consolidation of
the four verbs that already share one resolver — writing a fifth before that lands would add the defect
that work exists to remove. `audit`'s governance half is largely served by the record read and list verbs
that shipped 2026-08-13, so what it adds is the *harness* reading — guides with their always-on cost,
sensors with their lifecycle position — not a second way to read records.

### Promulgation

`sync` is deliberately half a ceremony. It ends by producing a branch and a tag, and stops; merging is a
human decision made later, possibly much later, which is the point.

```mermaid
flowchart TD
    A[sync target] --> B{base branch given?}
    B -- no --> C[ask, defaulting to the target's default branch]
    B -- yes --> D
    C --> D[create a linked working tree on a new branch]
    D --> E[write, restricted to what the norm owns]
    E --> F{a file the repository owns changed?}
    F -- yes --> G[report and stop: this is a judgement, not a write]
    F -- no --> H[commit, tag the norm version, remove the working tree]
    H --> I[report branch and tag; do not merge, do not push]
```

Three things about that flow are load-bearing and none is obvious.

**The isolated working tree removes the dirty-tree question rather than answering it.** A second working
directory of the same repository, on its own branch, means promulgation never touches the checkout someone
is working in. An in-place mode still exists for the case where isolation is unwanted, and *that* mode is
the one that has to insist on a clean tree and ask.

**A linked working tree shares the repository's internal directory, so clone-local git configuration
crosses into it.** The ignore list in particular applies there, and at least one repository excludes a
whole directory in order to hide a single file inside it. Nothing already tracked is at risk — an ignore
rule cannot reach a file the index knows — but every *new* file promulgation writes is: an ignored new path
stages as nothing, exits successfully, and reports the fact only as a hint, leaving a branch that looks
complete. **Promulgation must therefore verify what it actually staged rather than trust an exit code**,
and name the rule that caught anything it could not.

**The durable artifacts are the branch and the tag, not the directory.** The working tree is removed as the
last step, so promulgation cannot accumulate forgotten sibling directories nobody remembers creating. The
tag is what makes the delivered version legible to ordinary git commands without reading any file, and what
lets a later promulgation show only the difference.

### Ownership, and the state that is derived rather than stored

Everything above depends on a boundary that does not exist yet: which files the norm owns and may
overwrite, which the repository owns and it must never touch, and which are seeded once and then belong to
the repository forever. This is Track 1, it is the first track because nothing else can be written without
it, and its shape is the familiar one — a committed sample declaring what exists, and a clone-local file
holding the answers for this machine.

The clone-local file, ignored by version control, holds **one durable fact: which version of each record
type was promulgated here.** Everything a session needs to know is then derived by comparing that map
against what is installed, which means there is no switch anyone has to remember to turn off after the work
is done. That decision is recorded in RFC-0002 and its rationale belongs there; what matters here is the
consequence — a session hook that stays completely silent when the versions match, and costs nothing on the
overwhelming majority of sessions where nothing is pending.

The clone-local file layers over the committed one rather than replacing it, at every level of the
resolution cascade, so a repository can ship a fully populated configuration and a clone override only what
is true of that machine.

## Tracks

The first three are the foundation and are being worked as one dossier; nothing after them can be built
without all three. Tracks 4 through 7 are recorded here in full so their design survives without this
conversation, and each spawns its own dossier when it starts.

- [x] **Track 1 — The ownership boundary, written down.** Declare what the norm owns and may overwrite,
      what the repository owns and is never touched, and what is seeded once. Ships as a committed
      declaration plus the reference documentation that explains it, and every later track reads it rather
      than re-deciding. At the end there is a file that answers "may promulgation write this path?" without
      a judgement call.
      Task: the-foundation-the-harness-module-stands-on.md (closed dossier — `git show e2f1e1bc0eac1b62624f3ab7379eb1dc70659fcd:project/tasks/the-foundation-the-harness-module-stands-on.md`)
- [x] **Track 2 — Narrow an ignore rule that is a trap for the next file, not a blocker for this one.**
      The commit hook turned out to need nothing: it is machine-independent and already tracked everywhere.
      The clone-local ignore rule names its whole directory in order to hide one neighbour, and an ignore
      rule cannot reach a tracked file — so what it actually endangers is anything promulgation adds to
      that directory later, which would arrive untracked and be swallowed in silence. Narrow the rule to
      the one file that needs it.
      Task: the-foundation-the-harness-module-stands-on.md (closed dossier — `git show e2f1e1bc0eac1b62624f3ab7379eb1dc70659fcd:project/tasks/the-foundation-the-harness-module-stands-on.md`)
- [x] **Track 3 — The applied-version stamp, and a session hook that is silent by default.** Add the
      clone-local configuration file to the existing resolution cascade as its nearest entry, store the
      applied version in it, and register a session-start hook that compares it against the installed
      version. At the end the hook exists, says nothing when the versions match, and says something
      specific and actionable when they do not.
      Task: the-foundation-the-harness-module-stands-on.md (closed dossier — `git show e2f1e1bc0eac1b62624f3ab7379eb1dc70659fcd:project/tasks/the-foundation-the-harness-module-stands-on.md`)
- [x] **Track 4 — The `harness` noun, and the source it needs to exist at all.** Formerly two tracks; see
      the Decision Log for why they merged. Shipped: the contract change (`ModuleContext.sourceRoot`,
      `ModuleDefinition.needsSource`, resolved by `runModule` as config `harness.source` > `--source` >
      `CLAUDE_PLUGIN_ROOT`), and four of the module's five planned verbs — `shape`, `status`, `catalog`,
      `audit`. `resolve` is **not written**: it stayed blocked on Plan-027's resolve consolidation, as
      decided, and is not part of what shipped here. `status` absorbed the SessionStart hook's own
      comparison rather than keeping a second copy. `catalog`'s "composed" reading turned out to need both
      `check --list` and the three ops' own `--list`, not `check --list` alone, or every unported gate
      would have read as a false gap. `audit` carries three measurement traps as tests, plus a fourth found
      during manual verification (a shipped template copy leaking into the guide inventory). Two detectors
      shipped and are deliberately not composed: `runner-provenance` (a gate runner snapshot outranking a
      live sibling checkout) and `disabled-declared` (every `disabled:` entry names a reason, never a
      boolean).
      Task: the-harness-noun-and-the-source-it-reads-from.md (closed dossier — `git show 38104edaa41754c4bb754271f97449acbe1b3f64:project/tasks/the-harness-noun-and-the-source-it-reads-from.md`)
- [x] **Track 5 — `sync`: isolated working tree, branch, tag.** Promulgation as designed above. At the end
      a repository can be brought to a version of the norm without its working tree being disturbed, and
      the result is inspectable as an ordinary branch before anyone merges it. **It must verify what it
      staged rather than trust an exit code** — an ignored new path stages as nothing and says so only in a
      hint. Shipped with `harness resolve`, which this plan left unwritten pending Plan-027 Track 1.
      **The in-place mode was not built**, and that is a cut rather than an omission: it exists in the
      design only for "when isolation is unwanted", nobody has wanted it yet, and it is the one mode that
      needs a clean-tree check and a prompt — machinery whose first user should be a real need.
      Task: tasks/promulgation-a-branch-a-tag-and-a-boundary.md (closed dossier — `git show e346ae7f6a0d9cc6c45f63240a114746f4235aca:project/tasks/promulgation-a-branch-a-tag-and-a-boundary.md`)
- [x] **Track 6 — The audit's judging half becomes a skill that calls the audit's measuring half.** Retire
      the hand-run audit's measurement steps in favour of the verbs from Track 4, leaving the skill only
      what genuinely needs a model: placing components on the guide/sensor grid, recognising an instruction
      that is a command written in prose, and deciding whether a check may block or must only warn. At the
      end the skill is substantially shorter and cannot produce a wrong number. **Opens with a decision it
      cannot avoid**: the skill this retires does not live in this repository, so either it moves in — and
      becomes a shipped surface with a public contract — or the verbs are consumed from where it already
      is, and this repository ships no skill at all. **Answered a third way**: it is not a skill of its own
      at all, it is `/vibe-ops:setup harness audit`.
      Task: tasks/the-audit-that-cannot-mis-measure.md (closed dossier — `git show e346ae7f6a0d9cc6c45f63240a114746f4235aca:project/tasks/the-audit-that-cannot-mis-measure.md`)
- [x] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, the tracking
      issue closed. The plan file itself is kept. Stays unchecked until the plan is actually closed; a
      track list that is otherwise complete but has this box open is not finished.

## Success criteria

- `vibe-ops harness status` run against several repository paths prints one line each, naming the version
  applied and the version installed, and the answer is stable across two consecutive runs that change
  nothing.
- The commit hook is a tracked file in this repository: `git ls-files` names it, and no clone-local ignore
  entry is required for it.
- `vibe-ops harness sync` against a target with uncommitted work leaves that work untouched, and produces a
  branch and a tag whose diff contains only paths the ownership declaration marks as owned by the norm.
- Opening a session in a repository whose applied version matches the installed one produces no injected
  text at all.
- `vibe-ops harness catalog` names at least one available-but-uncomposed item in a repository that has one,
  and reports none in a repository that is fully composed.

---

<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->

## Decision Log

- Decision: The harness audit is a **mode of `/vibe-ops:setup`**, not a skill of its own and not left
  outside this repository — answering Track 6's forced choice with a third option neither branch named.
  Rationale: auditing a repository as a harness and installing one into it are the same knowledge asked in
  two directions, so two surfaces both had to hold it and the survey step existed twice — measured as the
  same four shell commands in both, three of which the verbs from Track 4 already answer with tests the
  shell versions do not carry. Moving it in as its own skill would have kept that duplication and added a
  listing entry; consuming the verbs from outside would have left the measuring half reachable only by an
  operator with this workspace checked out. Folding costs nothing in the listing budget and removes an
  entry from it — `setup`'s description is unchanged at 863 characters, and the standalone skill's own
  323-character entry is gone. The theory it rests on ships as `references/harness-model.md`, which was
  already written repo-neutral and so needed no rewrite to become a public surface.
  Date / Author: 2026-08-14 / Danilo Borges

- Decision: A promulgation that meets a newer ownership declaration refuses only the paths whose class
  **widened**, and the consent that clears them is recorded in the clone as `harness.boundary`.
  Rationale: this closes the last of this plan's open questions. Only `seed → norm` (and `repo →`
  anything) gives this tooling authority it did not have — every other move reduces what it may do and
  needs no permission, so refusing those too would block a repository on a change that made it safer.
  Refusing the *whole run* on any version change was considered and rejected for the same reason at a
  larger scale: most bumps only add an entry for a new path or reword a justification, and a gate that
  blocks on those is switched off within the week. Recording consent rather than asking per run follows
  the rule this plan already set for `applied` — the state is a version that was agreed to, never a switch
  someone has to remember to clear.
  Date / Author: 2026-08-14 / Danilo Borges

- Decision: The state promulgation writes lives in `vibeops.config.local.json`, a **third layer** of the
  config cascade rather than a fourth filename in its local half.
  Rationale: the plan approved this work assuming a fourth filename, and measurement refuted it before a
  line was written. `loadOne` takes the first match within each half, so a clone holding both that file
  and a `vibeops.config.local.ts` would have loaded exactly one of them — the machine's state or the
  operator's overrides, depending on the order chosen, silently either way. A separate layer composes
  instead: the operator keeps declaring preferences in a file they own, and this one carries only what was
  promulgated. It is JSON because it is written by a command rather than by a person, and a program
  editing someone's TypeScript to change one key is a class of bug this repository does not need.
  Consequence, recorded because it is easy to miss: `harness` merged nearest-wins *whole*, which was
  correct while `applied` was its only key and became wrong the moment a machine-written file could rank
  nearer than the one an operator declares `source` in. The whole-key rule now applies to the `applied`
  map alone. Recorded as [ADR-0015](../adr/0015-a-third-config-layer-the-tooling-writes.md), which extends
  ADR-0014 rather than superseding it.
  Date / Author: 2026-08-14 / Danilo Borges

- Decision: `harness resolve` does not print through the record resolvers' shared formatter.
  Rationale: that function answers "where does a record type live", in keys about directories, templates
  and numbering; a harness resolution shares none of them. Routing this through it would produce one
  function with two disjoint output sets selected by a discriminant — which is the coupling Plan-027
  Track 1 removed, wearing the costume of the convergence it created. What the two verbs share is a
  spelling convention for their output, not an implementation.
  Date / Author: 2026-08-14 / Danilo Borges

- Decision: The source/target seam merges into the `harness` noun rather than shipping as its own track.
  Rationale: it is one field on what a module is handed, it changes no observable behaviour, and it has
  exactly one consumer. Landed alone it produces a contract addition nothing reads, which is the shape that
  gets refactored away by someone who cannot see why it exists. Merged, the field arrives with the verb
  that proves it.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: `harness resolve` is not written until the resolve consolidation has decided its shape.
  Rationale: four verbs already share one resolver and have diverged where nobody chose to, and that is an
  open plan of its own. Adding a fifth before it lands would be adding the defect that plan exists to
  remove, and doing it inside the plan that is meant to make governance legible.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: `catalog` shrinks to the half that is missing rather than being built whole.
  Rationale: the gate command now lists what it would run, with each check's source — measured 2026-08-13,
  seventeen entries. That is the "what is composed here" half. What remains unanswered, and is the half
  that kills the failure this verb exists for, is what exists and is **not** composed. Building the part
  that already works would be a second answer to a question already answered.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: `catalog`'s "composed" set is the union of `check --list`'s shell fragments and the gate ids
  every shipped ops (`agents-md`, `governance`, `self`) reports composed via its own `--list` — not
  `check --list` alone.
  Rationale: most gates have no shell precedent at all, so reading only the shell side would report every
  such gate as "available but not composed" even when an ops already runs it on every commit — a false
  gap that IS the wrong recommendation this verb exists to prevent ("build something already written and
  merely unwired"). Gate identity is consistent across both sides because `catalog` compares against
  `entry.gate` (the ops's own field) and the gates package's own directory names, never against a shell
  fragment's differently-spelled id (`links` vs. the `markdown-link` gate it was ported from).
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: Discovery and mechanical porting may be delegated to a subagent; design judgements may not.
  Rationale: a subagent can survey what exists across repositories, and can port a detector from shell to
  TypeScript under a contract that fits in a paragraph, because both have a checkable result. The ownership
  boundary, the source-and-target seam, and the line between what the audit measures and what it judges are
  judgements that must agree with this plan's intent — a subagent does not hold the plan and returns
  something plausible that drifts.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: Bootstrapping and automatic configuration are an RFC, not a track of this plan.
  Rationale: the question has at least three candidate channels with genuinely different reach, and its
  central rule cannot even be stated before Track 1 defines ownership. Folding an unsettled design question
  into a plan track produces a track that cannot be started and blocks the ones behind it.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: The state a repository carries is the version applied, not a set of switches.
  Rationale: a stored switch has to be cleared by someone after the work it announces is done, and a signal
  that keeps firing once satisfied gets ignored rather than fixed. Comparing an applied version against an
  installed one is self-clearing. Recorded in full in RFC-0002.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: Promulgation stops at a branch and a tag; it does not merge and does not push.
  Rationale: merging into a shared branch is a judgement about timing that belongs to whoever is working
  there. Stopping at a branch also makes the result reviewable as an ordinary diff, which a direct write
  never is.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: The hook that dispatches to the workspace's knowledge pipeline stays clone-local, and this is a
  declared exception rather than an omission.
  Rationale: it is the only hook that genuinely embeds an absolute machine path, and it belongs to a
  pipeline this tooling's norm does not own. Promulgating it would put one machine's directory layout into
  every clone. What it must not do is take its neighbour down with it, which is what a directory-wide
  ignore entry has been doing.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: The applied-version state is a map keyed by record type, not one aggregate number and not the
  plugin's version.
  Rationale: per type is the granularity everything else already uses — each template declares its own
  version and each jump has its own migration note — so an aggregate would need a translation layer before
  it could say anything actionable. It is also not duplication of the version each artifact declares in its
  own frontmatter: the map is what was **promulgated** here, the frontmatter is what an artifact was
  **written against**, and the case worth detecting is exactly when the two diverge.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: Clone-local and general configuration are layered at every level of the cascade, not swapped at
  the nearest one.
  Rationale: layering lets a general config ship fully populated while a local file overrides only the keys
  it cares about, and applying the pair at every level makes the same override available in the operator's
  home directory — which the committed config already asks for in prose and had no mechanism for. The
  directory walk still outranks the pair: a nearer general file beats a farther local one.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: Track 2 is housekeeping, not a prerequisite, and Track 6 no longer waits on it.
  Rationale: this was recorded the other way round the same day, on the belief that the commit hook was
  excluded from version control and so could not be promulgated. Measurement refuted it — the hook is
  tracked in all eight repositories checked, and an ignore rule has no effect on a tracked file. What
  survives is narrower and still worth doing: a linked working tree shares the repository's internal
  directory, so the clone-local ignore list applies inside it, and any *new* file promulgation adds to that
  directory would be swallowed silently. That is a trap for future work rather than a blocker for this.
  Date / Author: 2026-08-13 / Danilo Borges

- Decision: A work item whose stated cause has not been measured does not get written into a record.
  Rationale: Track 2 was diagnosed wrong twice in one day — first as a machine path to extract, then as an
  exclusion to lift — and both were mechanisms reasoned from rather than facts checked. Each was refuted by
  a single command that could have been run before writing. The cost was low only because nothing had been
  built on either version yet, which is luck rather than process.
  Date / Author: 2026-08-13 / Danilo Borges

## Outcomes & Retrospective

**Tracks 1–3 landed 2026-08-13.** The ownership declaration and its reference exist and classify every path
the scaffold writes; the clone-local configuration file layers into the cascade at every level with the
applied-version map inside it; the session hook is registered and silent. Against the goals: goal 4 is met,
goal 2 is met for the one repository this dossier committed to, and goals 1, 3 and 5 are untouched by
design — they belong to the verbs, which start at Track 4.

Two things are worth carrying forward rather than leaving in a dossier that gets deleted.

**The `norm` class came out far smaller than the design assumed, and that is a finding about promulgation
rather than about classification.** Of what the scaffold writes, most is `seed` — a shape whose value is
that someone changes it. Promulgation being safe turns out to be mostly a statement about how little it
overwrites, which makes the whole mechanism cheaper and less frightening than the plan's Summary implies.

**Track 2 was diagnosed wrong twice before being measured once.** Both diagnoses were mechanisms reasoned
from rather than commands run, both were refuted in seconds, and the second was written immediately after
correcting the first. Nothing had been built on either, so the cost was a rewrite rather than a defect —
that is luck, not process, and it is why the Decision Log now carries a rule about it.

**Tracks 4–6 landed 2026-08-14, and the plan closes here.** Against the five goals:

Goal 1 is met in mechanism and **not yet in ergonomics.** A repository declares which version of the norm
it carries, and `harness status` prints it — but for several repositories that is one invocation each, not
one command. The module contract hands a module exactly one repository, and the honest reading is that many
targets are the caller's loop; the goal asked for something the contract does not offer, and neither was
adjusted. It is recorded as still open rather than quietly reworded.

Goals 3 and 4 are met and were the easiest to verify: `sync` against a target with uncommitted work leaves
that work untouched, and produces a branch and a tag whose diff contains only paths the declaration marks
as the norm's — run end-to-end against a scratch clone, not only asserted in tests. Goal 5 is met: the
audit's measurements are four verbs with tests, and the skill that judges them cannot produce a number of
its own.

Goal 2 is met for what is promulgated, and **the gap is coverage rather than correctness.** `sync` writes
one of the seven `norm` entries the declaration carries. The mechanism — the isolated tree, the staged-
content verification, the boundary consent — works against whatever the content function returns; the
payload is a fifth of what the boundary describes. That is written up as research rather than left as a
retrospective line, because it is input to the next decision and not a lesson from this one.

**Three defects were found by writing the documentation, not by running the code**, and none of them
appeared in 447 tests or a 17-check gate: `sync` recorded consent and never the versions it applied, so a
freshly promulgated repository still reported never having been promulgated to; the module never declared
that its first argument names a repository, so every verb silently answered about the working directory;
and the state file was covered by no ignore rule, here or in the shipped scaffold. Each surfaced from a
sentence asserting an effect in the user's voice, which is checkable immediately in a way a unit test is
not — a unit test asserts what the code does, the sentence asserts what the reader was promised.

**What was cut, deliberately:** `sync`'s in-place mode. It exists in the design only for the case where
isolation is unwanted, nobody has wanted it, and it is the one mode needing a clean-tree check and a
prompt. **What remains open and is inherited by nobody yet:** which composition the two uncomposed
detectors belong to — the same open question this plan opened with, unmoved because nothing this work did
bears on it.

---

## Open questions

- Whether `status` across several repositories is one invocation per target or one invocation given many.
  The module contract hands a module exactly one repository root, and the honest reading is that many
  targets is the caller's loop rather than the module's argument — but that makes the common case noisier
  than it needs to be.
- Whether the two detectors named in Track 5 belong to a new composition or to an existing one. Their
  population is the mechanical apparatus, which is neither a record nor prose about machinery, and the
  precedent is that a detector whose population does not match its composition inherits the wrong
  exclusions in silence.

<!-- The third question here — what promulgation does when the ownership declaration itself has changed —
     was answered in Track 5 and moved to the Decision Log, where a settled question belongs. -->

## Related

- [RFC-0002](../rfc/0002-bootstrapping-a-repository-and-what-auto-configuration-may-decide.md) — which
  channel performs a repository's first wiring, and the limit on what an automatic step may decide; blocked
  on Track 1 and deliberately outside this plan.
- [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) — the separation between a detector and
  the composition that decides its scope; this plan applies the same separation one level up, between what
  promulgates the norm and what verifies it.

- Task dossiers closed and removed per the task lifecycle (`Planned → In Progress → Done → file removed, git history is the archive`):
  - `git show e2f1e1bc0eac1b62624f3ab7379eb1dc70659fcd:project/tasks/the-foundation-the-harness-module-stands-on.md`

- Task dossiers closed and removed per the task lifecycle (`Planned → In Progress → Done → file removed, git history is the archive`):
  - `git show 38104edaa41754c4bb754271f97449acbe1b3f64:project/tasks/the-harness-noun-and-the-source-it-reads-from.md`

- Task dossiers closed and removed per the task lifecycle (`Planned → In Progress → Done → file removed, git history is the archive`):
  - `git show e346ae7f6a0d9cc6c45f63240a114746f4235aca:project/tasks/promulgation-a-branch-a-tag-and-a-boundary.md`
  - `git show e346ae7f6a0d9cc6c45f63240a114746f4235aca:project/tasks/the-audit-that-cannot-mis-measure.md`
