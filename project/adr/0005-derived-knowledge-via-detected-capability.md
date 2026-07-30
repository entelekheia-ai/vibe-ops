<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0005: Derived knowledge is consumed through a detected capability, never a named product

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Deciders | Danilo Borges |

---

## Context

Some repositories carry a **derived knowledge artifact** — a generated index, a knowledge graph, a symbol
database, a search index — that answers architecture questions far more cheaply than reading source files.
Where one exists, an `AGENTS.md` that does not mention it sends every agent down the expensive path.

The obvious way to handle that is to have the authoring skill write the tool's name into the generated
file. This plugin is public and is installed into repositories whose tooling it knows nothing about, and
the failure is asymmetric: an instruction naming a tool that is not installed is not merely unhelpful, it
is **false**, and it sits in the always-on block degrading the instructions around it (ADR-0004). It also
rots on its own schedule — the tool gets renamed, replaced, or dropped, and the line survives.

A second failure appeared while applying this to the plugin's own workspace: a derived index almost never
covers the whole tree. An index built over two directories, described as if it covered the repository,
makes an agent trust an empty result. **An index whose scope is unstated lies by omission.**

## Decision

**We will have skills instruct agents to detect a capability and describe it generically, never to write a
product name into a generated artifact.**

- The authoring skill's instruction is conditional on what is found on disk: *if the repository carries a
  derived index, point at it and say what it answers* — phrased so a repository without one produces no
  line at all rather than a broken one.
- The generated line names the **artifact and its path**, which is verifiable, rather than the tool that
  produced it, which is not. Whoever maintains that tooling documents the invocation where the tooling
  lives.
- Any pointer to a derived index **must state the index's scope** — what it covers and what it does not.
  A pointer without a scope is not written.
- Absence degrades to silence. No placeholder, no "if you have X", no TODO.

## Options considered

- **Option A — name the tool in the generated `AGENTS.md`.** Simplest and most actionable where it applies.
  Rejected: it writes one workspace's tooling choice into every repository the plugin touches, it is false
  wherever the tool is absent, and it makes the plugin's output track a third party's naming.
- **Option B — omit derived knowledge entirely.** Rejected: where an index exists it is the single highest-
  value line in the file, and dropping it to avoid a conditional is trading real value for a small amount
  of authoring complexity.
- **Option C — name the tool but guard it with a conditional sentence** ("if this repo uses …"). Rejected:
  the conditional consumes budget in every repository to serve the minority that have the tool, and a
  conditional instruction is exactly the kind of line the relevance gate discards wholesale.
- **Option D (chosen) — detect the capability, point at the artifact by path, state its scope, emit nothing
  when absent.**

## Consequences

Easier: generated output stays true in repositories the plugin has never seen, and a repository that
adopts, replaces or drops such tooling changes one path rather than an instruction spread across files.
Stating scope turns an empty query result from a false negative into an answer.

Harder: the skill's instruction is conditional, which is harder to write and harder to verify than a fixed
line. Detection is a heuristic — a repository can carry a derived index under a name the skill does not
recognize, and the line simply will not be written. That is the intended failure direction: a missing
pointer costs one expensive search, a wrong pointer costs trust in the whole file.

Accepted risk: nothing mechanically enforces the scope statement. It is a checklist item in
`authoring-agents-md`, and an index pointer written without one will not be caught by the validator.

## Related

- [ADR-0003](0003-instruction-file-architecture.md) — what belongs in a generated instruction file.
- [ADR-0004](0004-budgeted-artifacts-and-guards.md) — why a false or conditional line is not merely wasted
  space.
- [`skills/authoring-agents-md/SKILL.md`](../../skills/authoring-agents-md/SKILL.md) — the step that
  applies this.
