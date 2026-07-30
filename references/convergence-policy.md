# Convergence policy — two kinds of skill, four verbs

Decision record: [ADR-0001](../project/adr/0001-skill-taxonomy-target-state-vs-event.md).

Skills in this plugin are invoked against repositories that already exist at least as often as against new
ones. This file is how a skill knows which situation it is in and what it is allowed to do about it.

## The two kinds

**Every skill is exactly one of them, and says so in its `description`** — so neither the agent nor the
reader has to infer it.

**Target-state skills are convergent and idempotent.** There is a correct shape and the work is making the
disk match it: `AGENTS.md`, a README, a `LICENSE`, a repository baseline, a folder layout. Whether the
artifact already exists is an implementation detail of the same job — an absent artifact is just the
degenerate case of maximum gap. **They are never split into a `create` and an `update` skill.**

**Event skills are append-only and non-idempotent.** They record that something happened at a point in
time: `new-adr`, `new-rfc`, `new-plan`, `new-task`, `close-task`. Running one twice correctly produces two
records. **They have no update mode** — an event is not updated, it is superseded (ADR), advanced through
its lifecycle (RFC), or closed (task). Those transitions live in the target repo's own governance rule, and
an event skill points at them rather than offering to edit the past.

## How a target-state skill is structured

1. **Declare the target state** — what "done" looks like, written independently of what is on disk.
2. **Survey** — read the disk and produce a gap list: missing / divergent / extra / conflicting.
3. **Apply a verb per gap** — the four below.
4. **Check against the target state** — one checklist, written over the outcome. It never branches on
   whether the run created or reconciled; if a checklist item needs to know, the target state was written
   wrong.

## The four verbs

| Verb | When | Action |
|---|---|---|
| **create** | absent | generate from the template |
| **adopt** | present and divergent, but coherent and already referenced | record the local convention as authoritative and **do not touch it** |
| **migrate** | present, divergent, and actively broken or harmful | change in place **and update everything that points at it** |
| **leave** | present but outside this skill's target state | do not touch; mention it in the report |

**`adopt` is the verb that prevents damage, and the one an agent will not invent on its own.** The default
instinct on seeing divergence is to converge it. Two cases where that destroys work:

- A folder named `research/` that holds a project's primary design documents rather than supporting
  material. Converging it into the governance slot would break a documented source-of-truth pointer.
- Two sibling repositories that settled on `rfc/` and `rfcs/`. Renaming either breaks every link in every
  document, for no gain.

The test for `adopt` versus `migrate` is not "is it different" but **"is anything actually broken, and does
anything point at it?"** Divergence that is coherent and referenced is a convention, not a defect.

`migrate` carries an obligation that is easy to drop: **updating the references is part of the verb, not a
follow-up.** A migrate that leaves dangling pointers is worse than a `leave`.

## Audit mode

Survey without writing is a **mode, not a skill**. A target-state skill accepts an `audit` argument that
runs steps 1–2, reports the gap list with the verb it would apply to each, and stops. Nothing is written,
including the files a run would normally create from scratch.

## Writing the `description`

The `description` is what the agent matches against, so it carries the kind in the situations it names, not
as a label bolted on:

- Target-state: name both entry points — *"Set up **or reconcile**…"*, *"Create **or refresh**…"* — and
  include the drifted-repo case in the "use when" clause. A name that promises only creation is a bug in
  the skill, not something the description can fix.
- Event: state that it creates one record. Say what supersedes or closes it rather than implying it can be
  re-run to update.
