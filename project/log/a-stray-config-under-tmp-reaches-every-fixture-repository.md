---
vibe-ops-template: log@2
name: a-stray-config-under-tmp-reaches-every-fixture-repository
description: >-
  A leaked vibeops.config.local.mjs sitting in /private/tmp was picked up by the config cascade of
  every temp-dir fixture repository below it — a virgin scratch install reported harness.applied it
  never had, and nothing looked wrong from inside the repo.
kind: trap
path:
  - "cli/packages/core/src/config.ts"
attempted: 2026-08-22
source: Plan-033 npm-only acceptance run, task the-norm-travels-as-a-package
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# A test fixture under `/tmp` inherits any config a past run leaked above it

> **Not current truth.** This records what was attempted on 2026-08-22 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Plan-033's npm-only acceptance: pack every package, install into a scratch repository under the session
scratchpad (itself under `/private/tmp`), and run `vibe-ops harness status` expecting "never promulgated
to".

## What happened

`harness status` reported **2 record types behind**, in a repository holding no config file at all. The
answer came from `/private/tmp/vibeops.config.local.mjs` — `applied: { adr: 1, plan: 2 }` — a fixture
some earlier test run had leaked at the top of `/tmp`. Deleting it restored "never promulgated to".
Every test in this repository that builds a repo via `mkdtemp(tmpdir(), …)` sits below that path, so one
leaked file can quietly shape the config of the whole suite while every individual test still passes.

## The mechanism

Established. `searchPath` in `cli/packages/core/src/config.ts` walks from the repository root up toward
the home directory collecting `vibeops.config*` at every level — the deliberate linter-style cascade. A
temp fixture's parent chain is `/private/tmp/...`, and the cascade has no reason to treat `/tmp`
differently from any other ancestor. The leak itself came from a test that wrote its fixture config to
`tmpdir()` directly instead of into its own `mkdtemp` directory.

## What to do instead

When a fixture repository answers with configuration nobody wrote, check the ancestor chain first:
`ls /private/tmp/vibeops.config*` (and each level up to `/`). In a test, write fixture config **inside
the `mkdtemp` directory**, never to `tmpdir()` itself. A mechanical guard is possible — the cascade
could stop at the filesystem temp root, or a test-suite sweep could assert `/tmp` holds no
`vibeops.config*` before running — but neither exists today; this entry is the sensor until one does.
