# ADR-0001: Two kinds of skill — target-state and event

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Deciders | Danilo Borges |

---

## Context

> This decision has no external antecedent we are aware of: the taxonomy and the four verbs below are
> our own, developed from the incident described here and from auditing real repositories
> ([`research/context-file-practices.md`](../research/context-file-practices.md), *Field findings*).
> External sources this plugin draws on generally are credited in
> [`ACKNOWLEDGEMENTS.md`](../../ACKNOWLEDGEMENTS.md).

Skills in this plugin are invoked against existing repositories at least as often as against new ones.
`scaffold-new-repo` was run on a repository that already existed, and the agent had to infer on its own
that the request was a reconciliation rather than a scaffold — the skill's name and description both
promised creation. The same pressure appears elsewhere: folder conventions that drifted apart across
repositories need converging, not creating.

The obvious response is a second skill per capability — a `create` and an `update`. Nine skills would
become eighteen, each pair sharing most of its content, which is the duplication this plugin exists to
remove.

The plugin has in fact already answered the question, inconsistently and without noticing:
`authoring-agents-md` says "create **or refresh**", `license-setup` says "set up **or refresh**",
`authoring-readme` says "write **or clean up**" — while `scaffold-new-repo` says only "scaffold a new
repository". The three that converged on a dual mode did so because they belong to a different
category than the ones that did not.

## Decision

**Every skill in this plugin is one of exactly two kinds — a *target-state* skill or an *event* skill.
Which one it is must be stated in the skill's `description` and reflected in the shape of its steps**, so
that neither the agent nor the reader has to infer it. The two kinds:

**1. Target-state skills are convergent and idempotent.** There is a correct shape, and the work is making
the disk match it. `AGENTS.md`, `README`, `LICENSE`, the repository baseline, a folder layout. Whether
the artifact already exists is an implementation detail of the same job — an absent artifact is simply
the degenerate case of maximum gap. **These are never split into two skills.** They are structured as:

1. **Declare the target state** — what "done" looks like.
2. **Survey** — read what is on disk and produce a gap list (missing / divergent / extra / conflicting).
3. **Apply the convergence policy** — the four verbs below.
4. **Check against the target state** — one checklist, written over the outcome, never branching on
   whether the run created or reconciled.

**2. Event skills are append-only and non-idempotent.** They record that something happened at a point
in time: `new-adr`, `new-rfc`, `new-plan`, `new-task`, `close-task`. Running one twice correctly produces
two records. **They have no update mode**, because an event is not updated — it is superseded (ADR),
advanced through its lifecycle (RFC), or closed (task). Those transitions already exist in the
`project/**` governance rule, and an event skill points at them rather than offering to edit the past.

**The four convergence verbs**, which every target-state skill applies per gap:

| Verb | When | Action |
|---|---|---|
| **create** | absent | generate from the template |
| **adopt** | present and divergent, but coherent and already referenced | record the local convention as authoritative and **do not touch it** |
| **migrate** | present, divergent, and actively broken or harmful | change in place **and update everything that points at it** |
| **leave** | present but outside this skill's target state | do not touch; mention it in the report |

`adopt` is the verb that prevents damage, and it is the one an agent will not invent on its own. Two
worked examples from the workspace this plugin was built in: a folder named `research/` that holds a
project's primary design documents rather than supporting material — converging it to the governance
slot would destroy a documented source-of-truth pointer; and two sibling repositories using `rfc/` and
`rfcs/` — renaming either breaks every link in every document for no gain.

**`scaffold-new-repo` is renamed to `repo-setup`.** It is a target-state skill, and its old name promised
an event — which is what forced the agent to guess in the first place. A description alone cannot fix a
name that contradicts it: the name is what the user types and what the agent matches against. The new
name states the target ("set up **or reconcile** a repository's baseline") and pairs with `license-setup`,
already a dual-mode target-state skill in this plugin. This is a **breaking change to the public
invocation** and is accepted as such.

**Survey without writing is a mode, not a skill** — an `audit` argument on a target-state skill, which
reports the gap list and stops.

## Options considered

On the rename specifically: keeping the name and letting the description carry the correction was
considered and rejected — a `description` cannot outvote a name, because the name is what the user types
and what the agent pattern-matches. Keeping `scaffold-new-repo` as a deprecated alias was also rejected:
it preserves in the interface exactly the wrong promise this ADR exists to remove.

- **A — a `create` and an `update` skill per capability.** Explicit, and the agent never has to judge.
  Doubles the surface, and the two copies of the shared target state drift apart — the exact failure
  this plugin exists to prevent. Rejected.
- **B — one skill, no guidance; let the agent adapt live.** Zero authoring cost. This is the status quo
  that produced the incident: with no stated policy the agent re-derives the create-versus-reconcile
  judgement every time, and will eventually overwrite something divergent-but-intentional. Rejected.
- **C — a single generic `update-repo` skill alongside the creators.** Concentrates the reconcile logic
  in one place, but it would have to know the target state of every other skill, becoming a second
  copy of all of them. Rejected.
- **D (chosen) — a taxonomy plus a written convergence policy.** One skill per capability. The agent
  adapts *within* the four verbs rather than instead of them.

## Consequences

**Easier.** A new skill starts by answering one question — target-state or event — and inherits its
structure. Checklists stop branching on create-versus-update, because they are written over the target
state. Reconciling a drifted repository becomes a first-class operation instead of an improvisation.

**Harder.** Every target-state skill now owes a survey step and an explicit verb per gap; that is real
authoring work, and skipping it silently returns to option B. The four verbs must live in one shared
reference that the skills point at, or they become nine copies.

**Accepted costs.** The rename is a **breaking change**: `/vibe-ops:scaffold-new-repo` stops working, and
anyone with it in a note, a script, or their own docs has to update. No deprecated alias is kept — an
alias would leave the misleading name in the interface, which is the thing being fixed. The change is
taken now, while the plugin is pre-1.0 and its install base is small; it gets more expensive every
release. `repo-setup` also carries a residual risk that "setup" still reads as new-repository-only; the
description and the `license-setup` symmetry are the mitigation, not a guarantee.

Event skills gain a line stating they are events — small permanent overhead that prevents an agent from
"updating" an accepted ADR.

**Follow-up.** A shared reference documenting the two kinds and the four verbs; an `audit` argument on the
target-state skills; and the rename itself, which touches the skill folder (26 files), its `name:`
frontmatter and 4 self-references, 4 cross-references from `new-adr`, `new-rfc` and `new-plan`, 2 lines in
`README.md`, and 2 in `AGENTS.md` — a version bump with the break called out in the release notes.

## Related

- [`project/research/context-file-practices.md`](../research/context-file-practices.md) — the field
  findings that separated drift from misplacement.
- [ADR-0002](0002-knowledge-lifecycle.md) — `close-task` is an event skill whose closure step routes
  knowledge.
