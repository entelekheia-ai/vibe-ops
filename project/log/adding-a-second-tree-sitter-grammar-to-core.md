---
name: adding-a-second-tree-sitter-grammar-to-core
description: Two tree-sitter grammar packages in cli/packages/core/ declare peer ranges for the
             tree-sitter runtime that do not intersect; npm install ERESOLVEs until the runtime is
             pinned exactly and the grammar's peer is overridden — measure the ABI before trusting that.
kind: debt
path:
  - "cli/packages/core/package.json"
attempted: 2026-08-10
source: project/tasks/001-the-document-model-and-its-sensor.md (Plan-010, Track 1)
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template log@0.1 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# Adding a second tree-sitter grammar to core will ERESOLVE against the first

> **Not current truth.** This records what was attempted on 2026-08-10 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Track 1 added `@tree-sitter-grammars/tree-sitter-markdown@0.3.2` (declares a peer of
`tree-sitter: ^0.21.1`) as `cli/packages/core/`'s first runtime dependency, pinned to `tree-sitter`
`0.25.1` exact. Plan-010's Track 2 is expected to add
`@tree-sitter-grammars/tree-sitter-yaml@0.7.1` to the same `package.json`, and that package declares a
peer of `tree-sitter: ^0.22.4` — a different floor from markdown's, on the same runtime.

## What happened

`npm install` at the workspace root ERESOLVEs: npm's peer resolution takes each grammar's declared
range literally, and `^0.21.1` and a runtime pinned to `0.25.1` are outside markdown's own declared
range once a second grammar's range is also in play. Forcing past it (`--force`) installs, but is not
evidence the two grammars actually work together — only that npm stopped objecting.

The actual fix, once forced: measure. Track 1's matrix (`tree-sitter` 0.21.1/0.22.4/0.25.1 against
markdown 0.3.2, parsing this repository's own `CHANGELOG.md`) found the runtime/grammar ABI stable
across that whole range — byte-for-byte identical parse trees, same node count, same histogram. An
`overrides` entry in the **root** `package.json` (not `cli/packages/core/package.json` — npm overrides
apply from the workspace root) pins the grammar's own peer resolution to the same exact version:

```json
"overrides": { "@tree-sitter-grammars/tree-sitter-markdown": { "tree-sitter": "0.25.1" } }
```

Also true and easy to miss reading the grammar's `package.json` by eye: markdown's
`peerDependenciesMeta` key is spelled `tree_sitter` with an underscore, not `tree-sitter` — so the
`optional: true` it carries applies to no declared peer at all, and the peer is not actually optional
regardless of what that block seems to say.

## The mechanism

Not fully established for *why* the ABI held across three minor versions — plausibly because
`node-tree-sitter`'s native binding is N-API-based and N-API carries strong ABI stability guarantees
across Node/V8 versions, which would make a grammar's compiled `.node` file portable across a wider
runtime range than its declared peer admits. Not verified against the tree-sitter project's own release
notes; treat as a working theory, not a confirmed cause.

## What to do instead

When Track 2 adds a second grammar here: expect the same ERESOLVE, and do not resolve it by widening
the override on faith. Repeat Track 1's method — build a small compatibility matrix for the new
grammar against the runtime versions in play, parsing a real fixture and diffing the resulting tree
(root type, node histogram), before adding or widening an `overrides` entry. If a cell fails, that is
the finding, not a bug in the matrix.

## Confirmed (2026-08-10, Track 2)

`@tree-sitter-grammars/tree-sitter-yaml@0.7.1` (peer `^0.22.4`) reproduced the exact ERESOLVE this entry
predicted the moment it was added to `cli/packages/core/package.json` alongside markdown's `^0.21.1`.
The matrix repeated as instructed — `tree-sitter` `0.21.1`/`0.22.4`/`0.25.1` against yaml, parsing this
repository's own frontmatter (a folded multi-line scalar, a list, nested keys) — and found the same
outcome as markdown's: byte-for-byte identical parse trees across the whole range (0 errors, 57 nodes,
root `stream`, on every cell). The root `overrides` entry was extended with a second grammar pinned to
the same `0.25.1`, alongside markdown's. See `project/tasks/002-the-injection-resolver.md`, item 1, for
the full per-cell table before that dossier is deleted at closure.
