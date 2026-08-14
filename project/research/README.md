# project/research/

Investigations that feed a decision — comparisons, spikes, gap analyses. Input to an RFC, an ADR or a
plan; **not** a record of what was decided (that is the ADR or `project/log/`) and not a commitment to
build (that is a plan).

A research document is a **snapshot of what was knowable when it was written**. It is superseded by a
later investigation, never edited into agreement with one; when that happens the superseding document is
linked from a banner at the top of the old one, so that whoever opens the old file directly is told.

The columns below exist so the conclusion is legible **without opening the file**. An index of titles is a
list of things you still have to read.

| Research | Conclusion | Feeds |
|---|---|---|
| [How much of the ownership boundary promulgation actually delivers](promulgation-coverage-and-adoption-gaps.md) | The mechanism is complete and its payload is a seventh of the boundary it governs: `harness sync` writes 1 of 7 `norm` entries and none of the 10 `seed` ones. Two of the six undelivered entries cost more than the rest — bridge symlinks (the mode bit is what the `bridge` gate reads) and the commit hook (`core.hooksPath` is clone-local config an ADR constrains). Transversally: **user documentation behaves as a defect sensor** — three defects surfaced writing it that a 447-test suite and a 17-check gate did not. Confidence **high** on the counts, **moderate** on the sensor explanation | what to build after the harness module's tracks closed |
| [What a research document must carry that a later reader cannot reconstruct](research-document-format.md) | Four fields cannot be reconstructed later and are therefore required: the conclusion up front, the observable event that expires it, the method as run, and what was rejected with what would reopen it. Research is dated rather than numbered, and it has a lifecycle. The central claim — that required fields get filled with substance rather than filler — was a prediction at the time of writing, not a measurement | [Plan-004](../plans/004-new-research-skill.md), and the two questions it left open |
| [Why an instruction that is loaded is not an instruction that is followed](positioned-context-and-hooks.md) | There are **three** delivery positions, not two: a line in an instruction file, a guard in CI, and context placed at the moment of the act. An instruction that must hold at a specific moment should be delivered at that moment; where no event exists for that moment, the invariant is weak by construction and should be described that way rather than restated more firmly | the decision on whether this plugin ships hooks; extends [ADR-0004](../adr/0004-budgeted-artifacts-and-guards.md) |
| [What belongs in an agent context file](context-file-practices.md) | Content selection comes before formatting, and the filter is **non-discoverability** — what an agent cannot work out on its own. A size budget is a correctness measure rather than a cost measure. Of the six failure classes found in the audit, only drift is caught by a human re-reading the file, which is why a maintenance loop must be paired with a script | [ADR-0001](../adr/0001-skill-taxonomy-target-state-vs-event.md), [ADR-0003](../adr/0003-instruction-file-architecture.md) |
| [Where knowledge goes after the work is done](knowledge-lifecycle.md) | Authored knowledge (what was decided, what is forbidden, what is not obvious) and derived knowledge (what the code actually is — graphs, language servers, indexes) are complements rather than competitors: small and always-loaded against large and queried on demand. Context files should not carry codebase overviews, but the orientation need behind them is real, and derived knowledge is its correct answer | [ADR-0002](../adr/0002-knowledge-lifecycle.md) |
| [What makes a README worth reading](readme-presentation-practices.md) | Published advice does not agree with itself, and practice contradicts it in specific places. Two inputs are not discoverable from a working tree and must be asked for: the canonical claim and the proof artefact. "Known limitations" is usage rather than status narrative — the line is between *how the project is doing* and *how this will break for you*. Contributor material is a third category of leakage, alongside decision history and status | [Plan-003](../plans/shipped/003-readme-presentation.md) |

The shape each of these must carry — the four fields a later reader cannot reconstruct — is itself the
subject of [one of them](research-document-format.md).
