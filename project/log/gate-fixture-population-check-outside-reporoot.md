---
vibe-ops-template: log@2
name: gate-fixture-population-check-outside-reporoot
description: A gate test whose fixture needs a path OUTSIDE repoRoot (e.g. repoRoot/..) must nest
             repoRoot inside its own mkdtemp workspace, or parallel test files silently share the same
             parent directory and pollute each other's fixtures.
kind: trap
path:
  - "cli/packages/gates/test/**"
attempted: 2026-08-13
source: project/plans/025-the-harness-module-and-the-norm-it-promulgates.md (Track 4)
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# A gate fixture that walks outside `repoRoot` needs its own nested workspace

> **Not current truth.** This records what was attempted on 2026-08-13 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

The `runner-provenance` gate checks a path relative to `repoRoot`'s **parent**
(`repoRoot/../vibe-ops/...`). Its test fixtures followed the same pattern every other gate test in this
package uses: `mkdtemp(path.join(tmpdir(), "vibeops-<name>-"))` as `repoRoot` directly.

## What happened

`npm test` reported the "a snapshot with no live sibling to shadow" case failing, while running the same
file alone (`node --test cli/packages/gates/test/runner-provenance.test.ts`) passed every time. Every
fixture's `repoRoot` was a direct child of the shared OS tmpdir, so `repoRoot/..` resolved to the SAME
directory across every test in the file. The "a snapshot that outranks a live sibling" test wrote a
sibling checkout into that shared parent; the "no sibling" test, run in the same tmpdir generation,
inherited it and saw a sibling that its own fixture never created.

## The mechanism

Established: verified by nesting `repoRoot` inside a per-test `mkdtemp` workspace
(`<workspace>/repo`, so `repoRoot/..` became `<workspace>`, exclusive to that test) — the flake did not
recur across repeated full-suite runs afterward.

## What to do instead

For any gate (or any test) whose population check reads a path outside `repoRoot`, create `repoRoot` as
a subdirectory of its own fresh `mkdtemp` workspace, never directly at the tmpdir root:

```ts
const workspace = await mkdtemp(path.join(tmpdir(), "vibeops-<name>-"));
const repoRoot = path.join(workspace, "repo");
await mkdir(repoRoot, { recursive: true });
```

A gate that only ever reads inside `repoRoot` has no such trap — this applies specifically to a
population check that walks upward or sideways out of it.
