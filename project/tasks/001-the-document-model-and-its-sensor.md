<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# Task: The document model and its sensor

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-10 |
| Author | Danilo Borges |
| Issue | none |
| Plan | [plans/010-the-document-model-under-the-gates.md](../plans/010-the-document-model-under-the-gates.md) — Track 1 |

---

## Context

Track 1 of Plan-010, and the one every other track stands on. Six gates in `cli/packages/gates/` open
their own files and find what they need with regular expressions; the next three need the *same*
structure out of the same markdown. This track puts a parsed document in `cli/packages/core/`, hands it
to gates through `GateRunContext`, and adds the test that fails when the grammar set stops loading.

No gate reads the model yet — Track 3 is the first consumer. That is deliberate: the seam ships with
this track so its shape is settled before three gates depend on it, and the acceptance is therefore a
test rather than a changed report.

Two facts found while sizing the work already contradict what the plan assumed, and both are in
*Surprises & Discoveries* below. Neither changes the design; one changes the order (the pin is measured
before anything is built) and one is a correction to the plan's own text.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Pin the runtime against the grammar, by measurement | S |
| 2 | P0 | The grammar registry, read from each package's own manifest | M |
| 3 | P0 | `DocumentModel` and the lazy per-run store | M |
| 4 | P0 | The seam on `GateRunContext` | M |
| 5 | P0 | The grammar-load sensor, and two guards beside it | S |
| 6 | P1 | State what the dependency costs, in `cli/AGENTS.md` | S |
| 7 | P1 | Correct the quoted injection query in Plan-010 | S |

### 1. Pin the runtime against the grammar, by measurement — P0

**What:** a compatibility matrix, then an **exact** pin — no caret — in
`cli/packages/core/package.json`.

**Why:** the parser runtime and the grammars are coupled by binary interface, and the published metadata
is no guide to where that coupling holds. `@tree-sitter-grammars/tree-sitter-markdown@0.3.2` declares a
peer of `tree-sitter: ^0.21.1`; `@tree-sitter-grammars/tree-sitter-yaml@0.7.1` declares `^0.22.4`. Those
ranges do not intersect, and the runtime is published up to `0.25.1`. A caret range here floats onto a
version the grammar was never built against, and the failure arrives as a load error at run time, not as
an install error.

**Change:** in a scratch directory, for each of `tree-sitter` `0.21.1`, `0.22.4` and `0.25.1` against
markdown `0.3.2` — construct a parser, set the language, parse a document over 40 KB with the callback
form, and count `ERROR` nodes. Record **every cell in this dossier, including the failures**: the pin is
only as good as the evidence for it, and a matrix with the losing rows deleted proves nothing. Pin the
highest version that passes.

The baseline the matrix has to beat: `tree-sitter@0.21.1` parses markdown `0.3.2` correctly on
`darwin-arm64`, measured 2026-08-10 over a 173-file markdown corpus, with link and heading sets identical
to a CommonMark reference implementation. It is also what npm installs unprompted, being the grammar's
declared peer. The other two cells are unmeasured.

**Only the markdown grammar is declared in this track.** YAML belongs to Track 2, and the peer conflict
above is exactly why adding it is not free — that gets resolved there, with an override or a different
grammar, not smuggled in here.

**If no cell passes, the track stops and reports.** Working around a runtime that cannot load its own
grammars would be building on the thing this track exists to detect.

### 2. The grammar registry, read from each package's own manifest — P0

**What:** `cli/packages/core/src/grammars.ts` — the declared list of grammar packages, and resolution
from a file extension to one of them.

**Why:** hand-writing `".md" → markdown` is a second copy of something the package already states, and it
is the copy that goes stale the day a grammar adds a file type.

**Change:** every grammar package carries a `tree-sitter` array in its own `package.json`, one descriptor
per grammar it ships. Markdown's holds two:

```json
[{ "scope": "text.markdown", "path": "tree-sitter-markdown",
   "injection-regex": "^(markdown|md)$", "file-types": ["md"],
   "injections": "tree-sitter-markdown/queries/injections.scm" },
 { "scope": "text.markdown_inline", "path": "tree-sitter-markdown-inline",
   "injections": "tree-sitter-markdown-inline/queries/injections.scm" }]
```

Read `file-types` to build the extension map. Carry `injection-regex` and the resolved absolute
`injections` path on each descriptor — **declared now and read by nothing until Track 2**, which needs
the regex to match a fence label and the query file to find the spans.

Two traps, both already paid for once:

- The module exports `{ name, language, inline, nodeTypeInfo }`, and `setLanguage` must be given the
  **module wrapper**, not `module.language`. Passing the raw language object leaves `nodeSubclasses`
  undefined and the tree comes back with wrong node types. It does not throw.
- `inline` is a **second grammar from the same package**, and it is not reachable by index from the
  descriptor array, whose `path` is a directory name. Map the `text.markdown_inline` descriptor to
  `module.inline` explicitly.

### 3. `DocumentModel` and the lazy per-run store — P0

**What:** `cli/packages/core/src/document.ts`, exported from `cli/packages/core/src/index.ts`.

```ts
export interface Document {
  readonly file: string;         // repository-relative
  readonly text: string;
  readonly languageId?: string;  // from the descriptor's scope
  readonly tree?: Tree;          // absent when no grammar resolved
  readonly uncovered?: string;   // why there is no tree — never silently absent
}
export interface DocumentStore { get(file: string): Document }
export function createDocumentStore(repoRoot: string): DocumentStore;
```

**Why:** three gates asking structural questions of one file must parse it once, and a file the model
cannot parse has to say so rather than arrive looking empty. A run that skipped a file and reported
success is the failure this whole plan exists to remove.

**Change:**

- **Use the callback form of `parse`, always.** The string form refuses input at 32,767 bytes with
  `Invalid argument`. Eight tracked files in this repository are already past it, the largest at 44,328
  bytes. An implementation taking the string form passes every small test and fails exactly on the
  documents that matter.
- **Parse on first `get`; cache by repository-relative path; never parse eagerly.** `trackedFiles`
  returns the whole repository, a gate scoped to `project/**` must not pay for the rest, and a `--file`
  run must parse one file.
- **A file with no grammar still returns a `Document`** — text present, tree absent, `uncovered` naming
  the reason. Same shape for a file that cannot be read: one bad file must not take down a run of six
  gates.

### 4. The seam on `GateRunContext` — P0

**What:** a required `documents: DocumentStore` on `GateRunContext` in `cli/packages/core/src/gate.ts`,
built once per run in `cli/packages/core/src/ops.ts`.

**Why:** required rather than optional, so a gate reads structure without a branch for the case where
nobody handed it any. The store is lazy, so building it costs nothing on a `--list` or a `--file` run.

**Change:**

- `ops.ts` — construct it beside `pluginDir`, and pass it in the per-entry gate context. Nothing else in
  the run loop changes.
- The six test files under `cli/packages/gates/test/` build roughly thirty gate contexts as inline object
  literals, and every one of them stops typechecking. Give each file a local `ctx(files)` helper rather
  than adding one field thirty times — the literals already repeat themselves, and the diff is smaller
  either way.

### 5. The grammar-load sensor, and two guards beside it — P0

**What:** `cli/packages/core/test/grammars.test.ts`.

**Why:** Plan-010's stated acceptance for this track is a test that **fails when the runtime is moved off
its pin** — the same discipline `defineGate` applies when it refuses a declaration its code does not
back.

**Change:** three tests.

- **Load.** For every declared grammar: import it, construct a parser, set the language, parse a snippet,
  assert the root node type and zero `ERROR` nodes.
- **The ceiling.** Parse a generated fixture larger than 32,767 bytes and assert a tree with no `ERROR`.
  This is the regression guard against a later "simplification" back to `parser.parse(text)`.
- **Resolution.** `.md` resolves to a grammar; an unknown extension returns a `Document` with no tree, a
  non-empty `uncovered` reason, and its text intact.

### 6. State what the dependency costs, in `cli/AGENTS.md` — P1

**What:** one line on the `packages/core/` row.

**Why:** that row says core "depends on nothing else here, so it builds first", and after this track it
carries its first runtime dependency and that dependency is **native**. Prebuilt binaries ship for
`darwin-arm64`, `darwin-x64`, `linux-x64` and `win32-x64` — and **not** for `linux-arm64`, which compiles
from source at install time. `npm install` can now fail on a platform where it previously could not.

### 7. Correct the quoted injection query in Plan-010 — P1

**What:** the Design section of `project/plans/010-the-document-model-under-the-gates.md` presents the
markdown grammar's `injections.scm` as four patterns. The shipped file has **five**.

**Why:** it reads as a verbatim quote and is wrong by omission, and the omitted pattern is not
decorative — it is a second frontmatter route. Correcting a factual quote in a living plan is
maintenance, not a design change, so it needs no supersession.

**Change:** add the missing pattern,

```scheme
(document . (section . (thematic_break) (_) @injection.content (thematic_break))
 (#set! injection.language "yaml"))
```

and one sentence recording what the inline grammar's own `injections.scm` turns out to contain:

```scheme
((html_tag) @injection.content (#set! injection.language "html"))
((latex_block) @injection.content (#set! injection.language "latex"))
```

The plan's design says the resolver recurses and therefore needs a depth bound. That is now a measured
statement rather than a defensive one: markdown injects inline, and inline injects again. The recursion
fires on the first document the resolver ever sees.

## Implementation order

- [ ] P0 — Matrix and pin (item 1). Record every cell, passing and failing.
- [ ] P0 — `grammars.ts`, extension map read from the descriptors (item 2).
- [ ] P0 — `document.ts` and the store: callback-form parse, lazy cache (item 3).
- [ ] P0 — Export both from `cli/packages/core/src/index.ts`.
- [ ] P0 — `GateRunContext.documents`, wired in `ops.ts` (item 4).
- [ ] P0 — The six gate test files moved onto the new context shape (item 4).
- [ ] P0 — `grammars.test.ts`, all three tests (item 5).
- [ ] P1 — `cli/AGENTS.md` core row (item 6).
- [ ] P1 — Plan-010's quoted query corrected (item 7).
- [ ] Tick Track 1 in Plan-010 and name this dossier on that line.

Verification, from the npm workspace root:

```bash
npm install     # first native dependency — watch for a missing prebuild
npm run build   # core builds first, explicitly
npm run typecheck
npm test
node cli/packages/cli/dist/bin.js agents-md --list
```

The track is done when `npm test` passes; moving the pin to an adjacent version makes
`grammars.test.ts` fail; a document over 32,767 bytes parses with no `ERROR` node; and `agents-md`
reports exactly what it reported before — no gate reads the model yet, so any change there is a
regression rather than progress.

## Surprises & Discoveries

Two entries exist before the work starts, both found while sizing it. The rest is written while the work
happens; reconstructed at the end it is worthless.

- Observation: the published peer ranges of the two grammars this plan needs do not intersect, so the
  two cannot be installed together without an override.
  Evidence: markdown `0.3.2` declares `tree-sitter: ^0.21.1`; yaml `0.7.1` declares `^0.22.4`; the
  runtime is published to `0.25.1`. Markdown's `peerDependenciesMeta` key is spelled `tree_sitter` with
  an underscore, so the `optional: true` it carries applies to no declared peer at all.

- Observation: a grammar package declares its own file types and injection regex in its `package.json`,
  so the extension map is readable rather than authorable — the same "read the routing, do not invent
  it" property the plan established for injections turns out to cover extension resolution too.
  Evidence: the installed markdown package's `tree-sitter` array carries `file-types: ["md"]` and
  `injection-regex: "^(markdown|md)$"` per descriptor, alongside the path to each grammar's
  `injections.scm`.

## Closure

- [ ] Run `/vibe-ops:close task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
