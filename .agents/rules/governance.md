---
description: Lifecycles for project/ governance artifacts (ADR / RFC / task / log / research) — when each is immutable, frozen, or ephemeral, and how they link.
paths: ["project/**"]
---

## project/ governance — lifecycles

The **what and why** of each artifact type lives in [`../../GOVERNANCE.md`](../../GOVERNANCE.md) (the
human-facing doc). This rule is the **operational detail** for working inside `project/` — load it only
when a file under here is in context.

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

### Task (`project/tasks/`)

Lives in **two artifacts that own different content**: the GitHub issue owns status, assignment, and the
executive summary; the dossier (`project/tasks/NNN-slug.md`) owns the detailed working log. Ephemeral:

```
Planned → In Progress → Done → (dossier deleted; git history is the archive)
```

At closure, use `/vibe-ops:close-task` — it writes back to the source doc, propagates docs, spawns an ADR if
a hard-to-reverse decision emerged, then distills the summary into the issue with the breadcrumb
`git show <sha>:project/tasks/NNN-slug.md` before deleting the dossier. Never skip the write-back step —
that's the part that actually keeps docs from drifting.

### Log (`project/log/`)

Optional, write-once narrative context that an ADR is too terse to carry — the AI collaboration, dead ends,
and reasoning behind a decision. **Gaps are expected**: most decisions need no log. When one exists, it
pairs 1:1 with an ADR and links to it bidirectionally. Never retro-edit a log to match a later decision — a
superseding decision gets its own ADR (and optionally its own log).

### Research (`project/research/`)

Investigations that feed a decision — spikes, comparisons, gap analyses. Input to an RFC/ADR, not a
commitment to build and not a record of what was decided (that's `log/` or the ADR itself).
