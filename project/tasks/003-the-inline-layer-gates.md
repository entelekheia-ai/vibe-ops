<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# Task: The inline-layer gates

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-10 |
| Author | Danilo Borges |
| Issue | none |
| Plan | plans/010-the-document-model-under-the-gates.md — Tracks 3 and 4 |

<!-- Status lifecycle: Planned → In Progress → Done → (dossier removed; git history is the archive) -->

---

## Context

Tracks 3 and 4 of Plan-010, taken together. Track 1 shipped one parsed tree per file; Track 2 recursed
into its injected layers. Nothing reads either yet — that was the stated posture of both tracks, and this
task ships the first two consumers: the link gate ported off
`cli/packages/module-check/sh/checks/20-links.sh`, and the archival-reference gate that has never existed
in any form.

They are one task for three measured reasons, not for convenience. Both read the same layer, and neither
can read the block tree: parsing prose with the block grammar produces no `inline_link` node and no
`code_span` node at all, only an opaque `inline` node holding loose punctuation tokens. The second gate
exists because of the node class the first must exclude — every archival reference in this repository is
written inside backticks, which is exactly what the shell fragment strips before it looks for links, and
exactly why none of them has ever been validated. And neither gate can report a finding until the same
missing piece is written: `GateFinding.line` is a host line number, and Track 2 left layer positions
parent-relative on purpose.

Track 5 reads `pipe_table` in the block layer and shares no code with either gate; Track 6 is the
composition and carries the fragment comparison as a reported finding. Both are deliberately out of scope
here and become the closing task.

The ops that would compose these two gates is Track 6 and is **not** in this task. Each gate is exercised
by its own test, the way every gate in `cli/packages/gates/` already is.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Supplement queries: a declared way to complete a grammar's own injections | M |
| 2 | P0 | Position mapping: a layer chain to a host line | S |
| 3 | P0 | `gates/markdown-link/` — the port | L |
| 4 | P0 | `gates/breadcrumb/` — the reference gate, detection only | M |
| 5 | P0 | The comparison against the fragment, measured and recorded | S |
| 6 | P1 | The two comments this task makes false | S |

### 1. Supplement queries: a declared way to complete a grammar's own injections — P0

**What:** a second source of injection queries, written in the same query language the grammar authors
use and run through the same machinery. A grammar keeps its own `injections.scm`; this repository may add
a `.scm` of its own for that grammar's scope, and the resolver runs both.

**Why:** markdown's `injections.scm` delivers a paragraph's content to the inline grammar but never a
table cell's — a cell becomes a `pipe_table_cell` node, which the query does not name, so the delivery
never fires and `[x](y.md)` inside a cell is never built into a link. Measured over the 93 tracked
markdown files: 305 links reachable through the declared layers and **93 more inside table cells across
19 files**, unreachable. Every `AGENTS.md` layout table and every record header table is in that second
set. The shell fragment sees all of them, so a gate walking only declared layers would report 93 fewer
findings than the fragment it ports — a regression, in a track whose acceptance predicts the opposite
direction of divergence, which is exactly how it would have passed unnoticed.

**Change, and why it is a mechanism rather than a branch:** an `injections.scm` that omits a region is
not a markdown problem — it recurs per grammar. A branch on `pipe_table_cell` would teach a generic
resolver one node type of one grammar, and the next instance would teach it another. The resolver already
builds a `Parser.Query` from a path, runs `.matches()`, and reads `injection.language` /
`injection.content`; a supplement is the *same query language from a different file*, so it flows through
the identical code path with no new vocabulary. Verified against the real grammar — this repository's own
query text populates `query.setProperties` and each `match.setProperties` exactly as the grammar's own
patterns do:

```scheme
; A table cell holds inline markdown, but the block grammar marks it pipe_table_cell rather
; than inline, so the grammar's own injections.scm never delivers it. Measured 2026-08-10:
; 93 links across 19 files are unreachable without this.
((pipe_table_cell) @injection.content (#set! injection.language "markdown_inline"))
```

Five properties keep it general:

- **Supplements are data, in files.** `cli/packages/core/queries/injections/<scope>.scm`, one per grammar
  scope (`text.markdown.scm`). Adding one for another language is adding a file; no TypeScript changes.
- **Loaded symmetrically with the declared one.** `GrammarDescriptor` gains
  `supplementalInjectionsPath?: string`, resolved in `grammars.ts` beside `injectionsPath`. The two differ
  only in where the file came from — the grammar's package, or here.
- **No branch in the resolver.** `resolveLayers` runs `queryInjections()` once per query and concatenates.
  No node type and no scope is named anywhere in `injections.ts`.
- **Additive only.** A supplement may add a delivery; it may not suppress a declared one. Removing what a
  grammar declares has different consequences and is deliberately not available.
- **Its justification travels with it.** The query language takes `;` comments, so each supplement states
  what the grammar omits and what was measured, in the file a reader opens.

`Layer` gains `origin: "declared" | "supplemental"` rather than a second parallel array: a gate wants one
walk over every layer, and the audit question — what did we add? — is a field, not a shape.

**Two guards, because both failure modes are silent.** A supplement naming a scope no registered grammar
declares, or naming a file that is not there, **fails loudly at load** — the same discipline
`resolveLanguageObject` already applies to an unrecognised scope. And `cli/packages/core/package.json`
declares `"files": ["dist"]`, so a `queries/` directory would not ship: every supplement would resolve to
nothing for an installed consumer while working perfectly from this checkout. Add `queries` to `files`,
the way `module-check` already ships its `sh/`.

**Measured before the work started, so the sensor has a number to assert:** the supplement delivers 1,285
table cells across the corpus and recovers exactly 93 links across exactly 19 files, matching the count
taken independently from the block tree. It costs 28 ms over the whole 93-file corpus, against the 88 ms
of block parsing already being paid.

### 2. Position mapping: a layer chain to a host line — P0

**What:** two small functions in `cli/packages/core/`. A walk over a `Document`'s layers yielding each
layer with its accumulated **host** offset, and a line lookup from a host offset against the document's
own text.

**Why:** `GateFinding.line` is a host line number, and Track 2 left positions parent-relative on purpose,
recording that a consumer wanting a host offset walks the parent chain. Both gates here are that consumer,
and a `Layer` carries no pointer to its parent — the accumulation has to happen on the way down, which
makes it the walk's job rather than either gate's, and writes it once instead of twice.

**Change:** offsets compose by plain addition, and that is measured rather than assumed. A node's
`startIndex` is a **JavaScript string index, not a UTF-8 byte offset** — verified on a fixture carrying an
em-dash and an emoji, where `startIndex` was 39, `indexOf` was 39, and the UTF-8 byte offset was 43. This
matters because the corpus is full of em-dashes, and a byte/string mismatch would put every reported line
number quietly off rather than visibly wrong. The whole chain was proven end to end before this dossier
was written: walking `cli/AGENTS.md`'s layers and computing a host line for its first link returns 7,
which is where that link is.

### 3. `gates/markdown-link/` — the port — P0

**What:** `cli/packages/gates/markdown-link/`, reading the model instead of opening the file, replacing
the detection half of `cli/packages/module-check/sh/checks/20-links.sh`.

**Why:** the fragment deletes everything between backticks before extracting links. That is correct for
its own purpose and is the reason an entire class of reference is invisible to it. The grammar draws the
same distinction structurally instead: a link written inside a code span parses as a `code_span` with no
link node under it, so the exclusion needs no stripping pass and cannot be over-applied.

**Change:** collect every node carrying a `link_destination` child, which covers `inline_link` and `image`
uniformly — the corpus holds 305 of the first and none of the second today, but the fragment's `](` regex
matches an image too, so handling both now costs nothing and prevents a later divergence.
`shortcut_link` (14 in the corpus, bracketed prose such as `[task]`) carries no destination and is
skipped, which is also what the fragment does. Then replicate the fragment's skip list — `http`, `#`,
`mailto:`, an unexpanded `${` — strip any `#anchor`, and report its three failure modes: an absolute path,
a path that climbs outside the repository, and a path that does not resolve. Evidence strings say what a
reader needs in order to go fix it, not what the detector did.

### 4. `gates/breadcrumb/` — the reference gate, detection only — P0

**What:** `cli/packages/gates/breadcrumb/`, new, finding `git show <sha>:<path>` references inside
`code_span` nodes and checking each against this repository's own history.

**Why:** the corpus carries six of these and nothing has ever validated one. They are written inside
backticks — the exact text the fragment removes first — so this gate is possible at all only because of
the model.

**Change:** four failure modes, each with the level Plan-010's Design assigns it. All four are
mechanically detectable, verified against a real reference and a deliberately bogus one:

| Failure | Detection | Level |
|---|---|---|
| the commit does not resolve here | `git cat-file -e <sha>^{commit}` | fail |
| the path did not exist in that commit | `git cat-file -e <sha>:<path>` | fail |
| the file is still in the working tree | the path exists on disk | warn |
| malformed against the form found in the corpus | the pattern does not match | fail |

**Detection only — no `fix()`, and the gate does not declare `fixable`.** Plan-010 puts the reference
*form* out of scope: no record declares it yet, and rewriting a reference toward an undeclared form is not
a mechanical repair. The unrepairable modes warn or fail with the consequence named, following `pairing`'s
precedent that a hard failure the tool refuses to repair is a dead end.

### 5. The comparison against the fragment, measured and recorded — P0

**What:** run the shell suite and the new link gate over this repository, diff the two finding sets, and
record the result here, classified by direction per Plan-010's *Reading a disagreement*.

**Why:** it is Track 3's stated acceptance. Agreement is *not* the expected outcome — the gate should see
strictly more — so a bare "they differ" reads as failure, and the direction is the whole signal.

**Change:** `check.sh` has no per-fragment filter, but every finding from `20-links.sh` carries the id
`links`, so one run of the suite and a filter on `FAIL links ` isolates them. Findings only the fragment
produced are the ones that matter: each is something the port lost, and after item 1 that set is expected
to be empty. **Turning this comparison into a reported finding is Track 6's job, not this task's** — here
it is a measurement written into the record.

### 6. The two comments this task makes false — P1

**What:** the note on `documents` in `cli/packages/core/src/gate.ts` says "no gate in this track reads it
yet", and `cli/AGENTS.md`'s `packages/gates/` row lists the gates and their provenance.

**Why:** both were accurate when written and stop being so the moment item 3 lands. The `gate.ts` line in
particular is the one a reader consults to find out whether the seam is live.

**Change:** name the two new gates and what each reads, and record in the `packages/core/` row that the
model runs supplement queries beside each grammar's declared ones, naming
`cli/packages/core/queries/injections/` as where they live — the fact someone adding a grammar, or
wondering why the model sees more than `injections.scm` declares, needs before assuming the declared query
is the whole story.

## Implementation order

- [ ] P0 — Supplement queries as a mechanism, plus the markdown supplement as its first user (item 1).
      Two sensors: the 93-links-across-19-files count, and a supplement naming an unknown scope or a
      missing file failing loudly at load rather than matching nothing.
- [ ] P0 — Position mapping and its host-line lookup (item 2).
- [ ] P0 — `gates/markdown-link/` and its test (item 3).
- [ ] P0 — `gates/breadcrumb/` and its test (item 4).
- [ ] P0 — The comparison, run and recorded with its numbers (item 5).
- [ ] P1 — The two stale comments (item 6).
- [ ] Tick Tracks 3 and 4 in Plan-010 and name this dossier on both lines.

Verification, from the npm workspace root:

```bash
npm run build
npm run typecheck
npm test
sh cli/packages/module-check/sh/check.sh    # 17 checks, still 0 failed
```

The task is done when `npm test` passes; both gates fire on a fixture carrying one of each failure mode
and stay silent on a clean one; the link gate reproduces every `links` finding the shell fragment produces
on this repository and produces more; and the comparison's numbers are written into this dossier before it
is closed.

## Surprises & Discoveries

Four entries exist before the work starts, all found while sizing it — the rest is filled while the work
happens; reconstructed at the end it is worthless.

- Observation: markdown's `injections.scm` never delivers table-cell content to the inline grammar, so
  23% of this repository's links are unreachable through the declared layers.
  Evidence: the block grammar builds `pipe_table_cell` for a cell and `inline` for a paragraph, and the
  query names only the second; parsing `| [x](y.md) |` yields a `pipe_table_cell` whose children are the
  loose tokens `(`, `.`, `)` with no link node under them. Counted over the 93 tracked markdown files:
  305 links reachable through declared layers, 93 more inside table cells across 19 files.

- Observation: a query this repository writes itself runs through the grammar's own injection machinery
  unchanged, so completing an incomplete `injections.scm` needs no new vocabulary and no branch — which is
  what makes the supplement a mechanism rather than a special case.
  Evidence: a `Parser.Query` built over the markdown grammar from the one-line `pipe_table_cell` pattern
  above populates `query.setProperties` and each `match.setProperties` identically to the grammar's own
  patterns. Run over the corpus it delivers 1,285 cells and recovers exactly the 93 links across exactly
  the 19 files counted independently from the block tree, costing 28 ms against the 88 ms of block parsing
  already being paid.

- Observation: a node's `startIndex` is a JavaScript string index, not a UTF-8 byte offset, so layer
  offsets compose with plain addition and `text.slice` is the correct way to read a span.
  Evidence: on `"Prose — with an em-dash 🔥 then [link](target.md) here."` the `link_destination` node
  reports `startIndex` 39, `text.indexOf("target.md")` is 39, and the UTF-8 byte offset of the same
  position is 43.

- Observation: the block layer contains no `inline_link` and no `code_span` node whatsoever — both gates
  in this task are possible only because Track 2 made the inline layer addressable.
  Evidence: parsing prose containing a link and a code span with the block grammar produces a `paragraph`
  holding one opaque `inline` node whose children are loose punctuation tokens; the same text parsed with
  the inline grammar produces `inline_link` with `link_text` and `link_destination`, and `code_span` with
  its delimiters. A link written inside a code span produces a `code_span` with no link node at all.

## Closure

- [ ] Run `/vibe-ops:close task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
