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
| Status | Done |
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

**Measured 2026-08-10, darwin-arm64, fixture = this repository's own `CHANGELOG.md` (44,328 bytes on
disk).** Each cell: construct a `Parser`, `setLanguage(module)` — the module wrapper, not `module.language`
— parse with the callback form, walk the tree counting `ERROR`/`isMissing` nodes and a full node-type
histogram.

| `tree-sitter` | Install | `ERROR` nodes | `totalNodes` | Histogram vs. baseline |
|---|---|---|---|---|
| `0.21.1` | clean (declared peer) | 0 | 4229 | baseline |
| `0.22.4` | `--force` (peer wants `^0.21.1`) | 0 | 4229 | **identical** |
| `0.25.1` | `--force` (peer wants `^0.21.1`) | 0 | 4229 | **identical** |

All three cells pass, and all three produce the byte-for-byte same histogram — same `atx_heading` (37),
same `list_item` (89), same total node count, down to the punctuation-token tallies. The declared peer
range is conservative, not load-bearing: the ABI has not moved across `0.21`–`0.25`. **Pinned:
`tree-sitter@0.25.1`** (highest that passes) in `cli/packages/core/package.json`, exact, no caret.

`link`/`shortcut_link`/`fenced_code_block` all read `0` in the histogram — not a defect. The block grammar
parses those spans as opaque `inline` nodes; resolving them is the second grammar in the same package
(`text.markdown_inline`), which is a Track 2 concern, not this one.

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
  undefined — **measured against `tree-sitter@0.25.1`, this throws** a `TypeError` on the first node
  access (`Cannot read properties of undefined (reading '91')`, inside the library's own
  `unmarshalNode`), not the silent wrong-node-types corruption this bullet originally assumed from
  prior research on an unspecified earlier version. Corrected rather than left standing, because the
  Load test in item 5 relies on exactly this: the trap is asserted to be *loud*, and it is.
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

- [x] P0 — Matrix and pin (item 1). Record every cell, passing and failing.
- [x] P0 — `grammars.ts`, extension map read from the descriptors (item 2).
- [x] P0 — `document.ts` and the store: callback-form parse, lazy cache (item 3).
- [x] P0 — Export both from `cli/packages/core/src/index.ts`.
- [x] P0 — `GateRunContext.documents`, wired in `ops.ts` (item 4).
- [x] P0 — The six gate test files moved onto the new context shape (item 4).
- [x] P0 — `grammars.test.ts`, all three tests (item 5).
- [x] P1 — `cli/AGENTS.md` core row (item 6).
- [x] P1 — Plan-010's quoted query corrected (item 7).
- [x] Tick Track 1 in Plan-010 and name this dossier on that line.

Verification, from the npm workspace root:

```bash
npm install     # first native dependency — watch for a missing prebuild
npm run build   # core builds first, explicitly
npm run typecheck
npm test
node cli/packages/cli/dist/bin.js agents-md --list
```

The track is done when `npm test` passes; a document over 32,767 bytes parses with no `ERROR` node; and
`agents-md` reports exactly what it reported before — no gate reads the model yet, so any change there
is a regression rather than progress.

**"Moving the pin makes the test fail" needed correcting against measurement — see Surprises &
Discoveries below.** It does not hold for *any* adjacent version, because the matrix in item 1 found
the ABI stable across the whole `0.21`–`0.25` range. What the Load test in item 5 actually catches,
confirmed by measurement: the wrong-wrapper regression (item 2's trap, now a thrown `TypeError`, not a
silent one) and a runtime old enough to fail outright — `tree-sitter@0.20.0` cannot even install against
this toolchain's Node version. The sensor is real; the specific claim about *adjacent* versions was not.

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

- Observation: the matrix in item 1 found the tree-sitter/markdown ABI stable across the entire
  measured range, not merely at the declared peer. The original plan for this track's acceptance —
  "moving the pin to an adjacent version makes `grammars.test.ts` fail" — does not hold, and stood
  uncorrected until this measurement.
  Evidence: `tree-sitter` 0.21.1, 0.22.4 and 0.25.1 against markdown 0.3.2 produced byte-for-byte
  identical parse trees of a 44,065-character fixture (4229 nodes, identical histogram). The runtime
  binds through N-API, which is why minor-version drift within a stable N-API window costs nothing —
  the coupling the peer range warns about is real, but coarser than "any version off the declared peer".

- Observation: the "wrong wrapper" trap recorded under item 2 (`setLanguage(module.language)` instead
  of `setLanguage(module)`) throws on this pinned runtime; a prior note (sourced from research on an
  unspecified earlier tree-sitter version, corrected in item 2 above) had it as a silent corruption.
  Evidence: on `tree-sitter@0.25.1`, calling `.setLanguage(md.language)` and then reading
  `tree.rootNode.type` throws `TypeError: Cannot read properties of undefined (reading '91')` inside the
  library's own `unmarshalNode` — confirming `grammars.test.ts`'s Load test genuinely discriminates this
  regression rather than passing it silently.

- Observation: a tree-sitter version old enough to predate this toolchain's Node ABI fails at
  `npm install`, not at parse time — a different failure mode than the ERROR-node count the matrix in
  item 1 measured for.
  Evidence: `tree-sitter@0.20.0` ships no `darwin-arm64` prebuild for Node 26 and its `node-gyp rebuild`
  fallback fails outright on this machine (`gyp ERR!`, exit non-zero) — probed in the same scratch
  directory as the matrix, outside the three cells this track's pin decision is based on.

## Closure

- [x] Run `/vibe-ops:close task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
