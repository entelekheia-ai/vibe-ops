# Governance

How decisions and work are recorded in this repository. Three artifact types, three questions:

| Artifact | Question | Lives in | Lifecycle |
|---|---|---|---|
| **RFC** | "Should we do X, and how?" | `project/rfc/` | Draft → Review → Accepted → Implemented (frozen) · or Rejected |
| **ADR** | "We decided X, because Y" | `project/adr/` | Proposed → Accepted (immutable) → Superseded by a new ADR |
| **Task** | "We decided — here's what to change" | `project/tasks/` (dossier) + a GitHub issue | Planned → In Progress → Done → dossier deleted (git history archives it) |

## Flow

1. Open design → **RFC**. It needs review/ratification before leaving `Draft`. Illustrative code in an RFC
   communicates intent; it is not the implementation.
2. A settled, hard-to-reverse choice → **ADR** (often distilled from an RFC's *Decisions Closed*). Immutable
   once Accepted; to change it, write a new ADR that supersedes it. Never edit or delete an accepted ADR.
3. Decided work → a **task**: a GitHub issue (status, assignment, executive summary) plus an ephemeral
   `project/tasks/NNN-slug.md` dossier (the detailed working log). At closure, distill the summary + durable
   lessons up into the issue and `research/learnings/`, record the breadcrumb
   `git show <sha>:project/tasks/NNN-slug.md` in the issue, then delete the dossier.

Each `project/<folder>/AGENTS.md` states that folder's rules in detail. Investigations feeding decisions
live in `project/research/`; reusable lessons in `project/research/learnings/`.
