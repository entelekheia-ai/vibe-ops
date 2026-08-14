---
vibe-ops-template: log@2
name: harness-status-plugin-root-fallback-unverified
description: CLAUDE_PLUGIN_ROOT as an env-var fallback for the source/target seam is unverified for a
             Claude Code hook subprocess specifically — do not drop the explicit --plugin/--source flag
             on the strength of it alone.
kind: trap
path:
  - "cli/packages/cli/src/run.ts"
  - "cli/packages/cli/src/harness-status.ts"
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

# Do not rely on `CLAUDE_PLUGIN_ROOT` alone for the source/target seam's env-var tier

> **Not current truth.** This records what was attempted on 2026-08-13 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

`resolveSourceRoot` (`cli/packages/cli/src/run.ts`) was designed with three tiers, most-intentional wins:
declared `config.harness.source`, then a `--source` flag, then `process.env.CLAUDE_PLUGIN_ROOT` as the
implicit fallback the SessionStart hook wiring was assumed to already provide. The plan that specified this
called tier 3 "the implicit fallback the hook wiring already provides today."

## What happened

That assumption was never independently measured for a Claude Code **hook** subprocess specifically.
`plugin/references/harness-pair.md:130` states `${CLAUDE_PLUGIN_ROOT}` is "usually unset" for a process
this plugin spawns — but that measurement is for the shell runner's own invocation path
(`resolve_runner()` in `skills/setup/templates/harness/checks/_run.sh`, launched by a git hook or by an
agent's shell tool), not for a `SessionStart` hook Claude Code itself spawns. The two invocation paths are
different enough that the shell-runner measurement cannot be assumed to transfer.

`harness-status.ts` was kept on its own explicit `--plugin <dir>` flag (fed by `hooks.json`, unchanged)
rather than switched to rely on tier 3 alone, specifically because of this gap.

## The mechanism

Not established. `CLAUDE_PLUGIN_ROOT` may or may not be exported into a `SessionStart` hook's environment
— nobody has run the experiment for that specific hook type in this repository.

## What to do instead

Keep `--plugin`/`--source` passed explicitly by any hook or wiring that already knows the plugin root,
rather than removing it in favour of the env-var tier. If someone measures that `CLAUDE_PLUGIN_ROOT` is
reliably set for a Claude Code hook subprocess (not the shell-runner path), record that here or retire
this entry — until then, treat tier 3 as a bonus fallback, never the only path.
