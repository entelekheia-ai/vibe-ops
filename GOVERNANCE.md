# Governance

How decisions and work are recorded in this repository. Four artifact types, four questions:

| Artifact | Question | Lives in | Ratified? |
|---|---|---|---|
| **RFC** | "Should we do X, and how?" | [`project/rfc/`](project/rfc/) | Yes — leaves `Draft` only after review |
| **ADR** | "We decided X, because Y" | [`project/adr/`](project/adr/) | The decision itself is the record |
| **Task** | "We decided — here's what to change" | [`project/tasks/`](project/tasks/) (dossier) + a GitHub issue | No |
| **Research / log** | "What we looked at" / "how we got here" | [`project/research/`](project/research/) · [`project/log/`](project/log/) | No — supporting material, not a decision |

## Flow

1. Open design → **RFC**. Illustrative code in an RFC communicates intent; it is not the implementation.
2. A settled, hard-to-reverse choice → **ADR** (often distilled from an RFC's *Decisions Closed*). Immutable
   once Accepted; to change it, write a new ADR that supersedes it.
3. Decided work → a **task**: a GitHub issue plus an ephemeral `project/tasks/NNN-slug.md` dossier. Closure
   goes through `/vibe-ops:close-task` — write back to the source doc, propagate to living docs, spawn an ADR
   if a decision emerged, then distill + delete the dossier.
4. Supporting material along the way: `project/research/` for investigation that fed a decision,
   `project/log/` for the narrative an ADR is too terse to carry (optional, paired 1:1 with an ADR when it
   exists).

The **lifecycle mechanics** — stage gates, immutability rules, numbering, the closure sequence — live in the
`project/**`-scoped rule this repo carries (`.agents/rules/governance.md`, loaded automatically when working
inside `project/`), not duplicated here. This file is the map; the rule is the operational detail.

## Decision record

Every decision leaves a trail: an RFC's *Decisions Closed* section, an ADR, or a task's write-back into its
source doc. When a decision is hard to reverse or will be questioned later, prefer an ADR — a decision that
lives only in a chat log or a closed PR gets relitigated.
