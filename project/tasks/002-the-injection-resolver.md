<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# Task: The injection resolver

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-10 |
| Author | Danilo Borges |
| Issue | none |
| Plan | [plans/010-the-document-model-under-the-gates.md](../plans/010-the-document-model-under-the-gates.md) — Track 2 |

---

## Context

Track 2 of Plan-010. Track 1 shipped one parsed tree per file; nothing addresses a sub-region yet — a
fenced block, a frontmatter block, and markdown's own inline layer are opaque text inside the single
top-level tree. This track reads the host grammar's own `injections.scm`, resolves each named language
to an installed grammar (or records it as uncovered), recurses into what resolves, and exposes the
result as layers alongside the existing `Document`. No gate reads a layer yet — Track 3 is the first
consumer, the same posture Track 1 took toward `GateRunContext.documents`.

Four facts below were found while sizing this track, before any code was written, by running the actual
`tree-sitter` `Query` API and fetching the second grammar's manifest — not by reading Plan-010's Design
section alone. They change the shape of the work, not just its size, so they are recorded here rather
than discovered mid-implementation.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Pin yaml against the runtime, by measurement | S |
| 2 | P0 | Read `tree-sitter.json` in `grammars.ts`, alongside `package.json`'s array | M |
| 3 | P0 | The language resolver: three tiers, each proven necessary | S |
| 4 | P0 | The injection resolver: run the query, turn matches into layers | L |
| 5 | P0 | Recursion under a depth bound, and the opaque/uncovered split | M |
| 6 | P0 | Wire layers onto `Document`, lazily, same granularity as the tree | M |
| 7 | P0 | The sensor: one fixture proving every branch | S |
| 8 | P1 | `cli/AGENTS.md` — second native dependency, second manifest convention | S |

### 1. Pin yaml against the runtime, by measurement — P0

**What:** the same three-cell matrix Track 1 ran for markdown (`tree-sitter` `0.21.1`/`0.22.4`/`0.25.1`
against the grammar, callback-form parse, `ERROR` count, node-histogram diff across cells), run for
`@tree-sitter-grammars/tree-sitter-yaml@0.7.1`. A real fixture, not a synthetic one — this repository
has frontmatter blocks in its own governance records to parse.

**Why:** `project/log/adding-a-second-tree-sitter-grammar-to-core.md` says this explicitly: the same
ERESOLVE Track 1 hit (yaml declares `tree-sitter: ^0.22.4`, markdown declares `^0.21.1`) recurs the
moment a second grammar is added to `cli/packages/core/package.json`, and the log entry's own
instruction is to repeat the matrix rather than widen the existing `overrides` entry on faith.

**Change:** add `@tree-sitter-grammars/tree-sitter-yaml` to `cli/packages/core/package.json` at the
version the matrix passes, exact, no caret. Extend the root `package.json`'s `overrides` block to also
pin yaml's own `tree-sitter` peer resolution. Record every cell, passing and failing, in this dossier.

**Measured (2026-08-10):** three-cell matrix, `@tree-sitter-grammars/tree-sitter-yaml@0.7.1` against
`tree-sitter` `0.21.1`/`0.22.4`/`0.25.1`, callback-form parse of this repository's own
`project/log/adding-a-second-tree-sitter-grammar-to-core.md` frontmatter (a folded multi-line
description, a list, nested keys — not a synthetic fixture).

| `tree-sitter` | root type | error count | node count | histogram vs. `0.22.4` |
|---|---|---|---|---|
| `0.21.1` (forced past ERESOLVE) | `stream` | 0 | 57 | identical |
| `0.22.4` (declared floor, installs clean) | `stream` | 0 | 57 | — |
| `0.25.1` (forced past ERESOLVE) | `stream` | 0 | 57 | identical |

Same outcome as Track 1's markdown matrix: the ABI held byte-for-byte across the whole range. Pinned
`@tree-sitter-grammars/tree-sitter-yaml` to `0.7.1` exact in `cli/packages/core/package.json`, and
extended the root `overrides` to pin yaml's own `tree-sitter` peer to `0.25.1`, alongside markdown's
existing entry.

### 2. Read `tree-sitter.json` in `grammars.ts`, alongside `package.json`'s array — P0

**What:** `loadPackage()` in `cli/packages/core/src/grammars.ts` currently reads only `package.json`'s
`"tree-sitter"` array. Extend it to fall back to a package-root `tree-sitter.json`'s `"grammars"` array
when `package.json` carries no `"tree-sitter"` field.

**Why:** yaml ships no `"tree-sitter"` key in `package.json` at all — verified via `npm view` and
unpkg, not assumed. Reading only the older convention resolves zero grammars for the newer one,
silently, which is exactly the kind of gap this workspace's "measure before asserting" practice exists
to catch before it ships.

**Change:** the two shapes differ slightly (`tree-sitter.json`'s entries carry `name` and no `path`) —
normalize both into the same internal `RawTreeSitterDescriptor` shape `loadPackage()` already produces,
rather than branching the rest of the file on which convention a package used. `resolveLanguageObject`'s
per-scope mapping stays as-is; yaml has one grammar, no `inline` counterpart, so it needs one new case
keyed on `"source.yaml"`.

### 3. The language resolver: three tiers, each proven necessary — P0

**What:** a function resolving a captured language string (`"yaml"`, `"yml"`, `"markdown_inline"`,
`"js"`, …) to a `GrammarDescriptor`, or `undefined`.

**Why:** a single-tier resolver (regex only, the naive reading of "the grammar declares its own
`injection-regex`") silently fails two of the three concrete cases already in hand: `"yml"` (in yaml's
`file-types` but not matched by yaml's own `"^yaml$"` regex) and `"markdown_inline"` (no regex declared
for it at all). Getting this wrong reports real, resolvable content as `uncovered`.

**Change:** try, in order, against every registered `GrammarDescriptor`: (a) `injectionRegex?.test(lang)`,
(b) exact membership in `fileTypes`, (c) exact equality against the descriptor's own runtime `.name`
(read off the already-loaded module, not re-required). First match wins; no match means uncovered.

### 4. The injection resolver: run the query, turn matches into layers — P0

**What:** `cli/packages/core/src/injections.ts` — given a grammar and a tree (or a sub-range of one),
construct `new Parser.Query(grammar.language, injectionsQueryText)` from the grammar's own
`injectionsPath` (already resolved and unread since Track 1), run `.matches(node)`, and for each match
derive `(language, contentNode)` via the `setProperties` / dynamic-capture rule below.

**Why:** this is the one piece Plan-010's Design section describes only at the level of a flowchart.
The concrete mechanism — `setProperties` existing at runtime but not in the type declarations — is
exactly the kind of fact that would otherwise be rediscovered by trial and error mid-implementation.
Confirmed by running markdown's own `injections.scm`: `query.setProperties` is an array indexed by
pattern number, and each `QueryMatch` from `.matches()` carries the same shape under `match.setProperties`
when its pattern has one. The one pattern with none (the fenced-block route) instead captures a node
named `injection.language` whose `.text` gives the language dynamically. Resolving a match's language is
therefore uniformly:

```ts
match.setProperties?.["injection.language"] ??
  match.captures.find((c) => c.name === "injection.language")?.node.text
```

**Change:** one function per host grammar/tree pair, returning the raw `(language, contentNode)` pairs
before any recursion or resolution — kept separate from item 3's language resolution and item 5's
recursion so each is independently testable.

### 5. Recursion under a depth bound, and the opaque/uncovered split — P0

**What:** for each `(language, contentNode)` pair: resolve the language (item 3); if it resolves, parse
the content's text with that grammar (callback form, same as `document.ts`) and recurse into that new
tree's own injections; if it does not resolve, record `uncovered` naming the language; if no language
was captured at all (a plain `@injection.content` with neither route), record the span as `opaque` —
content only, never parsed, never reported as a failure to cover it, because none was claimed.

**Why:** markdown injects inline, and inline injects html and latex (both traps Track 1 already found
and recorded in `grammars.ts`'s own comments) — the recursion is measured, not hypothetical, and fires
on the first document the resolver ever sees. A depth bound is needed because nothing guarantees a
grammar set is acyclic; a fixed constant, generous enough to clear the one known case (markdown → inline
→ html/latex, depth 3) with headroom, is enough — a bound hit mid-resolution is its own outcome
(`depth-limit-reached`), never silently folded into `uncovered`, because a language WAS named and WAS
coverable.

**Change:** position is carried **parent-relative** (the byte range within the immediate parent's own
text), not eagerly resolved to host-absolute offsets — cheaper to compute at each level, and no consumer
in this track or the next needs a host-absolute offset yet. A consumer wanting one walks the parent
chain, which this track's shape (each layer nested under its parent) already supports without extra
bookkeeping.

### 6. Wire layers onto `Document`, lazily, same granularity as the tree — P0

**What:** extend `Document` (`document.ts`) with a `layers: readonly Layer[]` field (empty array, not
`undefined`, when nothing resolves — a tree with no injections is a normal outcome, not an absent one):

```ts
export interface Layer {
  readonly languageId: string;                        // the resolved grammar's own scope
  readonly parentStart: number;                        // byte offset within the immediate parent
  readonly parentEnd: number;
  readonly tree: Parser.Tree;
  readonly layers: readonly Layer[];                   // this layer's own injections, recursively
  readonly uncoveredLayers: readonly UncoveredLayer[];  // this layer's own uncovered injections
}
export interface UncoveredLayer {
  readonly language: string;            // the captured language string, as written
  readonly parentStart: number;
  readonly parentEnd: number;
  readonly reason: "no-grammar" | "depth-limit-reached";
}
```

`Document` gains `readonly uncoveredLayers: readonly UncoveredLayer[]` alongside `layers`. **Shipped shape
differs from the design above in one field**, found necessary during implementation, not anticipated by
it: `Layer` itself also carries `uncoveredLayers`, mirroring its own `layers`. See Surprises &
Discoveries — without it, an uncovered language found *inside* a resolved layer (markdown's inline layer
injects html and latex, and neither is installed here) would have nowhere to be recorded and would be
silently dropped, which is exactly the outcome this track exists to prevent.

**Why:** computed at the same point the top-level tree already is (first `.get()`), not behind a second
on-demand cache — Track 2's whole acceptance is proving this against one fixture, and a second laziness
axis inside a store that is already lazy per file adds a cache-invalidation surface for no consumer that
exists yet.

**Change:** `createDocumentStore`'s `get()` gains one step after the existing parse: run item 4's
resolver over the fresh tree, producing `layers`/`uncoveredLayers` before caching the `Document`. A file
whose top-level parse already failed (no grammar, or unreadable) gets empty arrays for both — never
omitted.

### 7. The sensor: one fixture proving every branch — P0

**What:** `cli/packages/core/test/injections.test.ts`, built around one markdown fixture carrying: a
leading, well-formed `---\n...\n---\n` frontmatter block (proving the `"yml"` route resolves once yaml
is installed); a fenced block in a language with an installed grammar (`markdown` itself, fenced inside
itself, proving the dynamic fence route); a fenced block in a language with **no** installed grammar
(proving `uncovered`, reason `"no-grammar"`); and enough prose to guarantee the inline hand-off fires
(proving `markdown_inline` resolves via the name-tier, and that it recurses at least one level further,
matching Plan-010's stated acceptance).

**Why:** Plan-010's stated acceptance for this track is exactly this: "a fixture whose fenced block is
in a language with no installed grammar reporting `uncovered` for that span while the rest of the
document reports normally." One fixture exercising every branch is stronger evidence than the same
assertions spread across several — a regression in the resolution order (item 3) would otherwise slip
past a test that only exercises the tiers it happens to need.

**Change:** assert, from one `store.get()` call: the frontmatter layer's `languageId`, the fenced
block's resolved layer, the uncovered entry's `language` and `reason`, and that the inline layer nests
at least one further layer of its own (proving recursion actually ran, not merely that depth 1
resolved).

### 8. `cli/AGENTS.md` — second native dependency, second manifest convention — P1

**What:** one line, beside the note Track 1 already added to the `packages/core/` row.

**Why:** the row currently says core carries a native dependency and names the prebuild-coverage
caveat. It says nothing about a package needing `tree-sitter.json` support to resolve at all — a fact
someone adding a *third* grammar needs before assuming `grammars.ts` reads every convention the
ecosystem uses.

**Change:** name both manifest conventions and which one each currently-installed grammar uses, so the
next addition knows to check before assuming either is universal.

## Implementation order

- [x] P0 — Matrix and pin for yaml (item 1). Record every cell, passing and failing.
- [x] P0 — `tree-sitter.json` support in `grammars.ts` (item 2).
- [x] P0 — The three-tier language resolver (item 3).
- [x] P0 — The injection resolver, `injections.ts` (item 4).
- [x] P0 — Recursion, depth bound, opaque/uncovered split (item 5).
- [x] P0 — `Layer`/`UncoveredLayer` wired onto `Document` (item 6).
- [x] P0 — `injections.test.ts`, the one-fixture sensor (item 7).
- [x] P1 — `cli/AGENTS.md` core row, second manifest convention (item 8).
- [ ] Tick Track 2 in Plan-010 and name this dossier on that line.

Verification, from the npm workspace root:

```bash
npm install     # second native dependency — watch for the same ERESOLVE Track 1 hit, resolved the same way
npm run build
npm run typecheck
npm test
node cli/packages/cli/dist/bin.js agents-md --list   # unchanged — no gate reads a layer yet
```

The track is done when `npm test` passes; the fixture in item 7 proves a parsed layer, an uncovered
layer, and at least one level of recursion from a single `store.get()` call; and `agents-md` reports
exactly what it reported before.

## Surprises & Discoveries

Four entries exist before the work starts, all found while sizing it — the rest is filled while the
work happens; reconstructed at the end it is worthless.

- Observation: `tree-sitter`'s JS `Query` class exposes `#set!` predicate results as `.setProperties`,
  undocumented in `tree-sitter.d.ts`.
  Evidence: `node_modules/tree-sitter/tree-sitter.d.ts` contains zero mentions of "predicate",
  "setProperties", or "#set"; running markdown's own `injections.scm` via `new Parser.Query(...)` shows
  `query.setProperties` populated per pattern index and `match.setProperties` populated per match.

- Observation: the yaml grammar package declares no `"tree-sitter"` field in `package.json`; it ships a
  separate `tree-sitter.json` instead.
  Evidence: `npm view @tree-sitter-grammars/tree-sitter-yaml@0.7.1 --json` lists no `tree-sitter` key
  among its top-level fields; its `tree-sitter.json` (fetched via unpkg) carries the grammar descriptor
  under a `"grammars"` array instead.

- Observation: resolving a captured injection language to a grammar needs three fallback tiers, not the
  single `injection-regex` match the plan's prose implies.
  Evidence: yaml's own `injection-regex` (`"^yaml$"`) does not match `"yml"`, which is in its own
  `file-types` and is exactly what markdown's normal frontmatter route emits; `"markdown_inline"`
  matches neither a regex nor a file type and resolves only against the inline grammar module's own
  runtime `.name`.

- Observation: a second grammar package in `cli/packages/core/` reproduces the exact peer-range
  conflict Track 1 resolved for markdown, already logged as expected debt.
  Evidence: `project/log/adding-a-second-tree-sitter-grammar-to-core.md`, written at Track 1's closure,
  names `cli/packages/core/package.json` as the path where this recurs and instructs measuring rather
  than trusting an override on faith.

- Observation: `Layer` needs its own `uncoveredLayers` field, not only `layers` — the design sketched in
  item 6 gave a `Layer` no way to carry an uncovered finding discovered while recursing into it, so one
  would be silently dropped rather than reported.
  Evidence: markdown's inline grammar injects `html` and `latex` in its own `injections.scm`
  (`tree-sitter-markdown-inline/queries/injections.scm`), and neither has an installed grammar here.
  Any real markdown document with inline HTML — confirmed against the item 7 fixture's own
  `<span>inline html</span>` — produces exactly this case one level into recursion. Corrected before
  shipping rather than after: `Layer` now carries `uncoveredLayers` alongside `layers`, symmetrically.

## Closure

- [x] Run `/vibe-ops:close task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
