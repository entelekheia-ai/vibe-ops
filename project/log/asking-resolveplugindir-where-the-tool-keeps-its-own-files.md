---
vibe-ops-template: log@2
name: asking-resolveplugindir-where-the-tool-keeps-its-own-files
description: >-
  `resolvePluginDir` answers "where is the TARGET's plugin surface", so using it to locate files
  the tooling ships — templates, migration notes — resolves to the target's root in a flat repo,
  where nothing writes; the failure is a silent SKIP or a blocking `unhandled`, never an error.
kind: trap
path:
  - "cli/packages/core/src/files.ts"
  - "cli/packages/ops-*/src/index.ts"
  - "cli/packages/module-*/src/index.ts"
attempted: 2026-08-14
source: task template-version-gate-resolves-wrong-templates-path
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Asking `resolvePluginDir` where the tooling keeps its own files

> **Not current truth.** This records what was attempted on 2026-08-14 and what happened then. Check it
> against the tree before relying on it.

`resolvePluginDir(repoRoot)` answers one question: **where is the target repository's plugin surface** —
`plugin/` when that repository ships a Claude Code plugin manifest, the repository root otherwise. The
`<plugin>/` token expands through it.

It was used twice to answer a different question — *where does this tooling keep its own files* — and both
uses failed in the same way, in every repository except this one:

- **`<plugin>/templates/<type>.md`** in the `template-version` entries resolved to `<target-root>/templates/`
  in a repository that ships no plugin. The setup skill writes governance templates to
  `project/templates/`, so the gate looked where nothing writes, read the absence as *"this repository
  keeps no records of that type"*, and reported `SKIP`. It had been inert since the gate was added.
- **`resolvePluginDir(repoRoot) + skills/migrate/migrations`** in the plan, task and records modules
  located the migration notes. A consumer repository ships none, so the version dispatch walked an empty
  note set and every record not already at the current version came back `unhandled` — which `blocks()`
  treats as a stop. `plan close` and `task close` refused any older record, reporting *nothing describes
  that shape* about a shape two committed notes describe in full.

**Both failures are silent or misattributed.** One is a `SKIP` indistinguishable from a repository that
genuinely has no records of that type; the other blames the target's records for a path problem in the
tool. Neither raises an error, and neither is visible in a fixture shaped like this repository, because
here `resolvePluginDir` returns `plugin/` and both paths exist.

The rule that separates the two questions: **the tooling's own files are at `context.sourceRoot`** — the
installed norm, which a module reaches by declaring `needsSource: true` — and `<plugin>/` is only ever
about the target. Where the target itself declares a location (`records.dirs`, `records.templates`), the
token that reads that declaration is the right answer instead, per
[ADR-0017](../adr/0017-a-composition-names-a-location-by-token-not-by-path.md).

Both call sites were repaired. What is not guarded is a third one: nothing prevents `resolvePluginDir`
from being asked the wrong question again, and its own doc comment describes what it does correctly
without warning what it is not for.
