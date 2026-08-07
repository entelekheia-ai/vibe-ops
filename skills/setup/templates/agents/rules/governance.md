---
description: Lifecycles for project/ governance artifacts (ADR / RFC / plan / task / log / research) — when each is immutable, frozen, permanent, or ephemeral, and how they link.
paths: ["project/**"]
---

## project/ governance — lifecycles

The **what and why** of each artifact type lives in [`../../GOVERNANCE.md`](../../GOVERNANCE.md) (the
human-facing doc). This rule is the **operational detail** for working inside `project/` — load it only
when a file under here is in context.

**Numbering is per repository.** Monotonic and never renumbered *within this repo* — not across a
workspace, an organization, or a family of related repos. Two repositories both holding an `ADR-0001` is
normal and costs nothing, because a cross-repo reference is a full URL and a local one names a file. A
number freed by moving a document to another repository is free again here. **Never skip a number to
avoid the appearance of a collision**: it leaves a permanent gap explained by nothing.

### ADR (`project/adr/`)

```
Proposed → Accepted → (Deprecated | Superseded by ADR-MMMM)
```

**Immutable once Accepted.** Never edit the substance of an accepted ADR and never delete one — to change a
decision, write a *new* ADR that supersedes it and set the old one's `Superseded by`. Numbering is
zero-padded `NNNN`, monotonic, **never renumbered**.

### RFC (`project/rfc/`)

```
Draft → Review → Accepted → Implemented
              ↘ Rejected
              ↘ Superseded
```

| Stage | Meaning | Gate to advance |
|---|---|---|
| Draft | Under discussion, may change without notice | A complete first draft from the template |
| Review | Open for explicit review | Open questions resolved |
| Accepted | Ratified, may spawn tasks | Maintainer sign-off, recorded in the header |
| Implemented | Shipped | Code merged; canonical docs now live in the code/`docs/` |

After `Implemented`: **frozen**, move to `implemented/`, do not edit further. After `Rejected`: move to
`rejected/` as a record of what was considered and why.

### Plan (`project/plans/`)

```
Backlog → In Progress → Shipped   (the file is never deleted)
```

**Permanent.** A plan answers "how do we build X?" and stays as the design record after the work ships —
the opposite of a task dossier. Numbering is `NNN`, monotonic, never renumbered.

Four sections are **living** and are maintained while the work happens, not written at the end:
`Progress` (dated checkboxes), `Surprises & Discoveries` (`Observation:` / `Evidence:`), `Decision Log`
(`Decision:` / `Rationale:` / `Date / Author:`), and `Outcomes & Retrospective`. Reconstructed from memory
afterwards they are worthless — the value is in writing the entry when it happens.

If a plan carries a GitHub issue, the **issue owns status and the executive summary; this file owns the
design and the working record**. The issue closes when the last track lands; the plan file does not close,
because it is what someone reads a year later to find out why the thing is shaped this way.

At closure, use `/vibe-ops:close plan` — retrospective written against the plan's own goals, every
`Surprises & Discoveries` entry routed, the demotion check run, living docs propagated, the issue closed
and **the file kept**. A plan that never spawned a task dossier has no other exit: skip this and it ships
having taught nobody anything.

### Task (`project/tasks/`)

Lives in **two artifacts that own different content**: the GitHub issue owns status, assignment, and the
executive summary; the dossier (`project/tasks/NNN-slug.md`) owns the detailed working log. Ephemeral:

```
Planned → In Progress → Done → (dossier deleted; git history is the archive)
```

At closure, use `/vibe-ops:close task` — it writes back to the source doc, propagates docs, spawns an ADR if
a hard-to-reverse decision emerged, **routes each `Surprises & Discoveries` entry** to a durable surface
(and deletes any instruction line a new guard has made redundant), then distills the summary into the issue
with the breadcrumb `git show <sha>:project/tasks/NNN-slug.md` before deleting the dossier. Never skip the
write-back or the routing step — those are the two that keep docs from drifting and keep a learning from
being deleted along with the dossier.

### Log (`project/log/`)

Optional, write-once narrative context, for **either** of two reasons:

1. What an ADR is too terse to carry — the AI collaboration, dead ends, the reasoning behind a decision.
   Pairs 1:1 with that ADR and links to it bidirectionally.
2. The rich context of **one unit of work**, decision or not — surprises with their evidence, what was
   tried and abandoned, what the work taught. A learning that is real but too local to promote into an
   instruction file lands here instead of being lost.

**Gaps are expected**: most work needs no log. Never retro-edit a log to match a later decision — a
superseding decision gets its own ADR (and optionally its own log).

### Research (`project/research/`)

Investigations that feed a decision — spikes, comparisons, gap analyses. Input to an RFC/ADR, not a
commitment to build and not a record of what was decided (that's `log/` or the ADR itself).
