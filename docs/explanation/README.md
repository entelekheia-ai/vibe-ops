# explanation/

**Understanding-oriented** docs: background and rationale — the "why" behind the design, the architecture
map, trade-offs, and how the pieces fit. Discursive, not step-by-step. Settled decisions live as ADRs
([`project/adr/`](../../project/adr/)); this folder gives the connective narrative around them.

- [**The document model, and why a gate never opens a file**](the-document-model.md) — what replaced
  seventeen private regular expressions, why it is layered, and how the gate/ops/document split divides
  detection from population.
