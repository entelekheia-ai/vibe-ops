---
vibe-ops-template: log@2
name: naming-an-ops-after-the-governance-type-it-enforces
description: An ops sharing its id with an activated governance type becomes unreachable — a bare noun
             resolves through the governance map first, and the ops is shadowed with no error.
kind: trap
path:
  - "cli/packages/cli/src/builtins.ts"
  - "cli/packages/ops-*/ops.json"
  - "vibeops.config.ts"
attempted: 2026-08-23
source: Plan-037
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Naming an ops after the governance type it enforces makes the ops unreachable

> **Not current truth.** This records what was attempted on 2026-08-23 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Name an ops after its subject, and name the governance package that owns that subject's policy the same
way: an `ops-classification` composing the rules, and a `governance-classification` holding the document
those rules enforce. The pairing reads well and each package's name says what it holds.

## What happened

`vibe-ops classification --audit` answered `classification has no command "--audit" — valid: resolve`.
The ops was never reached. The name resolved to the governance package, whose only base verb is `resolve`,
and the composition became unrunnable from the CLI while remaining perfectly valid on disk.

Nothing reported the collision. Both packages built, both were registered, and the ops's own tests kept
passing because they import it directly rather than through the resolver.

## The mechanism

A bare noun routes through the effective governance map — shipped defaults composed with `config.types` —
before the package-name conventions that would find `@entelekheia/vibe-ops-<name>` (ADR-0019: the config
is the registry). Activating a type therefore claims that noun for the whole CLI, and an ops holding it
already loses it at the moment the type is activated, not at the moment the ops is written.

## What to do instead

Name the ops for the CHECK and the governance for the SUBJECT, so the two never compete: the policy is
`classification`, the composition that enforces it is `exposure`. The gate keeps the subject's name too —
gate ids are not CLI nouns and do not take part in this resolution.

Before adding either, run `vibe-ops <name>` and see what answers. A name already claimed replies with
another package's verb list, which is the whole signal available.
