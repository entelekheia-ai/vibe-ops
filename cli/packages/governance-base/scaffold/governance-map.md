## Where a learning goes

An entry a dossier records as a surprise does not stay there. At closure each one is tested for
recurrence, discoverability, and whether a guard already covers it, then routed to whichever surface
matches what the fact *is* — a line in `AGENTS.md`, a scoped rule, a skill, a mechanical guard, a
decision record, or nowhere at all. The reverse applies too: an instruction line that a new guard has
made redundant gets deleted.

**Every record type has a closure that performs this routing**, so no unit of work can reach its end
without passing through one. They differ in what survives — an ephemeral dossier is deleted, a permanent
design record is kept — and not in whether the routing happens.

## Issue pairing

Where a record pairs with a tracking issue, the split is always the same: **the issue owns status and the
executive summary; the file owns the design and the working record.** What differs is the ending, and
each type's own section above says which ending is its.

## Decision record

Every decision leaves a trail — a proposal's *Decisions Closed*, a decision record of its own, a plan's
`Decision Log`, or a task's write-back into its source document. When a decision is hard to reverse or
will be questioned later, prefer the decision record: a decision that lives only in a chat log or a
closed pull request gets relitigated.

---

This file is the **map**. The lifecycle mechanics it summarises — stage gates, immutability, numbering,
the closure sequence — are also in the `project/**`-scoped rule at
[`.agents/rules/governance.md`](.agents/rules/governance.md), which loads automatically while you work
inside `project/`. The rule adds the operational detail; this document adds the shape of the whole.
