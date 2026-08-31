---
vibe-ops-template: log@2
name: moving-a-composed-entry-to-another-ops
description: Moving an entry between ops without moving its `settings` slice leaves the entry running
             unconfigured — `settings` is keyed by ops id, so the orphaned slice is never read and nothing
             reports it.
kind: trap
path:
  - "vibeops.config.ts"
  - "cli/packages/ops-*/ops.json"
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

# Moving a composed entry to another ops leaves its configuration behind, in silence

> **Not current truth.** This records what was attempted on 2026-08-23 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Move one entry from `ops-self` to a new ops, by cutting its object out of one `ops.json` and pasting it
into the other. The entry's `paths`, `options` and `fixture` all travel inside that object, so the move
looks complete.

## What happened

The entry ran with no configuration at all and reported 13 failures in files it was never meant to read.

Its `settings` slice — twelve `ignore` globs and one `level` promotion, the whole path policy separating
a record that HAS an old heading from a document that SAYS records have it — stayed under the old ops id
and was never read again. No error, no warning: `settingsFor(config, "<ops id>")` returns undefined for a
name nothing declares, which is indistinguishable from an ops that declares no settings.

It failed loudly only by luck. The orphaned slice was mostly exclusions, so losing it widened the
population and the entry hit files it should have skipped. An orphaned slice that had been narrow would
have made the entry examine MORE and stay green, and nothing would have reported that either.

## The mechanism

`settings` is keyed by ops id, and an entry carries no reference to the slice that configures it. The two
are joined by a name held in a third file, so a refactor that changes which ops an entry belongs to breaks
the join without touching either side of it.

## What to do instead

Move the `settings` slice in the same commit as the entry, and read the run's `examined` counts before and
after — a population that changed size is the signal, and it is the only one available. If the slice is
shared by entries that are not all moving, split it rather than duplicating it.

The same hazard applies in reverse to a renamed ops: `harness sync` and `check` translate settings by id
too, so an id change orphans every slice at once.
