# AGENTS.md — adr/

**Architecture Decision Records** — each captures one decision that is hard to reverse: "we chose X,
because Y, and we accept consequence Z". Smaller grain than an RFC.

- An RFC argues a *direction* ("should we do X, and how?"); an ADR records a *settled choice*.
- ADRs are often distilled out of an RFC's *Decisions Closed* section so the decision becomes findable on
  its own, but an ADR can also stand alone for a decision made outside any RFC.
- If the design is still open, it does **not** belong here — write or update an RFC first.

## Lifecycle

```
Proposed → Accepted → (Deprecated | Superseded by ADR-MMMM)
```

**An ADR is immutable once Accepted.** To change a decision, write a *new* ADR that supersedes the old one
and set the old one's `Superseded by`. Never edit the substance of an accepted ADR and never delete one —
the chain of ADRs is the project's decision history.

## Creating one

Use `/vibe-ops:new-adr`, or copy [`../templates/adr.md`](../templates/adr.md) to `NNNN-<kebab-title>.md`.
Numbering: zero-padded `NNNN`, monotonic, **never renumber**. One decision per file; the title is the
decision as a short noun phrase. Fill Context → Decision → Options considered → Consequences (rejected
options are the point).

See [`../../GOVERNANCE.md`](../../GOVERNANCE.md) for the full process.
