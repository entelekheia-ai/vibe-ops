---
vibe-ops-template: log@2
name: committing-from-a-linked-worktree-ran-the-gate-fixtures-inside-the-real-repository
description: Committing from a linked worktree failed the nudge-behaviour check under pre-commit only, and the fixture's git init had reinitialised the real repository as bare — git exports GIT_DIR and GIT_INDEX_FILE to a worktree's hooks, and every git call a fixture makes then lands in the committing repository.
kind: trap
path:
  - ".githooks/pre-commit"
  - "cli/packages/module-check/sh/check-agents-md.sh"
attempted: 2026-09-03
source: Plan-032 Track 2, commit af630a5
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Committing from a linked worktree runs the gate's fixture repositories inside the real one

> **Not current truth.** This records what was attempted on 2026-09-03 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Commit a track's work from a linked worktree (`git worktree add` under a scratch directory), with the
repository's own `pre-commit` gate wired through `core.hooksPath`, as any commit from the main checkout.

## What happened

The gate refused the commit with `FAIL [nudge-behaviour] after a turn spent in another repository, plans
already settled this session were named again`. The same gate run directly in the worktree —
`sh cli/packages/module-check/sh/check.sh`, and `sh .githooks/pre-commit` by hand — passed 17 of 17, and
had passed under `pre-commit` in the main checkout the same day.

After the first refused attempt, the main checkout answered `fatal: this operation must be run in a work
tree` to every command and `git worktree list` showed it as `(bare)`: `core.bare` had become `true` in the
shared `.git/config`. Repaired with `git config core.bare false`; nothing in the working tree was lost.

## The mechanism

Established by dumping the hook's environment with a throwaway `core.hooksPath`: inside a linked
worktree's `pre-commit`, git exports `GIT_DIR=<repo>/.git/worktrees/<name>` and
`GIT_INDEX_FILE=<that>/index`, both absolute. The `nudge-behaviour` fragment builds fixture repositories
under `TMPDIR` and runs `git` inside them; with `GIT_DIR` exported, every one of those calls addressed the
committing repository instead, and the fixture's `git init` reinitialised it — which is what sets
`core.bare` when the directory git is told about is not the working tree it is run from. In the main
checkout the hook receives a relative `GIT_DIR=.git`, which is why the same fragment passed there.

## What to do instead

The gate now does `unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE GIT_PREFIX` on entry
(`cli/packages/module-check/sh/check-agents-md.sh`); the root it checks arrives as an argument or from
the working directory, never from those. Any new fragment or gate that builds a fixture repository and
runs `git` in it inherits that protection only when run through that script — a fixture run some other
way from a hook needs the same `unset` first. If a checkout ever reports itself bare after a hook ran,
check `git config core.bare` before anything else.
