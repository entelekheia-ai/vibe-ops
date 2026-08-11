---
vibe-ops-template: adr@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0010: Supplement injection queries, not a branch per grammar gap

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-10 |
| Deciders | Danilo Borges |

<!-- Status lifecycle: Proposed → Accepted → (Deprecated | Superseded by ADR-XXXX) -->

---

## Context

`cli/packages/core/src/injections.ts` recurses into whatever a grammar's own `injections.scm` names.
Building the first consumer of that model — a gate reading a markdown document's inline content — found
that markdown's own `injections.scm` hands a paragraph's content to the inline grammar but never a table
cell's: a cell parses as `pipe_table_cell`, a node type the query does not name, so the hand-off never
fires. Measured against this repository's own corpus: 93 links across 19 files lived only inside table
cells and were invisible through the declared layers alone — 23% of the corpus, and enough that a link
gate reading only the declared layers would have reported fewer findings than the shell fragment it
replaces, a regression in the direction Plan-010 explicitly predicted would not happen.

The gap is not specific to markdown or to `pipe_table_cell`. Any grammar's `injections.scm` can omit a
region its own authors did not anticipate a consumer caring about, and this repository has no standing to
patch a third-party grammar package to fix its own query.

## Decision

We add a second, optional source of injection queries per grammar scope — a `.scm` file this workspace
maintains at `cli/packages/core/queries/injections/<scope>.scm` — loaded and run through the identical
`Parser.Query` mechanism as the grammar's own declared query, and concatenated with its results. Nothing
in the resolver (`injections.ts`) names a node type or a grammar scope; the only thing scope-specific is
the query text itself, which lives in a file, not in code.

A grammar scope must be explicitly listed (`SUPPLEMENTAL_SCOPES` in `grammars.ts`) to get a supplement
loaded at all, and loading fails loudly — not silently matching nothing — in the two ways that would
otherwise be invisible: the listed scope matches no registered grammar, or the expected file is missing
(the packaging trap: `cli/packages/core/package.json` originally shipped only `dist`, so `queries/` would
not travel with an installed copy of the package).

## Options considered

- **A branch on the missing node type, in the resolver** — `if (node.type === "pipe_table_cell") { … }`
  inside `injections.ts`. Cheapest to write for the one case in hand; rejected because it teaches a
  generic resolver one node type of one grammar, and the second grammar with the same class of gap (any
  grammar's `injections.scm` can under-declare) would teach it another. Explicitly rejected during review
  of the first draft of this design, which took exactly this shape.
- **Patch the grammar package's own `injections.scm`** — forking `@tree-sitter-grammars/tree-sitter-markdown`
  or post-processing its installed query file. Rejected: loses upstream sync on every dependency bump, and
  a patched copy of a third-party file is exactly the kind of drift `ADR-0004`'s "a guard, not a line"
  reasoning warns against — it would need re-applying and re-verifying on every version change.
- **Supplement queries in the same query language, run beside the declared one (chosen)** — additive only,
  data in files, no new vocabulary in the resolver. Costs one extra file per grammar needing a fix, and two
  load-time guards to keep the packaging trap and a scope typo from failing silently. `Layer` gains
  `origin: "declared" | "supplemental"` so a consumer can still ask "what did the supplement add?" without
  a second parallel data shape.

## Consequences

Adding a fix for the next grammar's under-declared `injections.scm` is adding a `.scm` file and one entry
in `SUPPLEMENTAL_SCOPES` — no change to `injections.ts`. A supplement can only add a delivery, never
suppress one the grammar declares, so it cannot silently make something the grammar exposes disappear.

The cost accepted: a layer's origin is now sourced from two files instead of one, so debugging "why did
this span resolve" means checking both `injections.scm` and this workspace's own supplement — mitigated by
`origin` being a field on every `Layer`, not something a reader has to infer. And the packaging list
(`cli/packages/core/package.json`'s `"files"`) now has a second entry (`queries`) that must be kept in sync
with anything the mechanism adds — the load-time guard turns a forgotten update into a hard failure at
`allGrammars()` rather than a silent gap, which is the trade this ADR is making explicit.

## Related

`project/plans/010-the-document-model-under-the-gates.md` (Track 3), `project/tasks/003-the-inline-layer-gates.md`
(item 1, where this was designed and measured), `project/adr/0004-budgeted-artifacts-and-guards.md` (a
guard, not a line — the same reasoning applied here to a query file instead of a shell check).
