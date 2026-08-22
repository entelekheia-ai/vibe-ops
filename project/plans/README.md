<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# The plans, and the order to attack them

Not a record — an index, written by hand and kept short. Each plan owns its own design; this file owns
only **what to pick up next and why that one**. Numbering never changes and a shipped plan keeps its
number in [`shipped/`](shipped/).

## The RFC-0003 chain, in dependency order

[RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) asked for a governance type to become a
pluggable unit. Three plans shipped it; four carry what is left.

| # | Plan | Status | Blocked by |
|---|---|---|---|
| 029 | a record type becomes a resolved name | Shipped | — |
| 030 | the type unit and the compositions derived from it | Shipped (Tracks 3–6 superseded by 033) | — |
| 033 | one artifact, one governance package | Shipped | — |
| 034 | [the ops become data, and the governances feed them](034-the-ops-become-data-and-the-governances-feed-them.md) | Backlog | nothing |
| 035 | [the audience boundary](035-the-audience-boundary.md) | Backlog | 034 |
| 031 | [ownership fragments, and the shaped class](031-ownership-fragments-and-the-shaped-class.md) | Backlog | nothing |
| 032 | [the ownership verb, and the configuration it writes](032-the-ownership-verb-and-the-configuration-it-writes.md) | Backlog | 031 |
| 036 | [the proxy grows](036-the-proxy-grows.md) | Backlog | nothing (opportunistic) |

## Suggested attack order

**1. Plan-034 — the ops become data.** First because it is the only open plan holding an *active*
duplication: five ops entries restate `required` field lists that each governance package's `type.json`
already declares, kept honest by a guard test rather than by design. Every week it stands is a week the
two can be edited apart. It is also fully specified, it unblocks 035, and it finishes the claim the whole
chain was for — 033 proved the norm *resolves* from a package; only 034 proves the composition *derives*,
so that adding a type really is "publish a package, add one config key".

**2. Plan-031 — the shaped class.** Next because it converts standing debt into a closed record: eight
plans in this repository are still stamped `plan@0.1` and warn on every `governance` run, and Track 3's
migration over them is what closes Plan-017 as well. It needs nothing from 034.

**3. Plan-035 — the audience boundary.** Straight after 034, while the `.json` collection is fresh — the
field is meant to be born in the data form rather than added to the TypeScript shape and migrated later.

**4. Plan-032 — the configuration format RFC.** The largest unknown, and now the gate on three separate
capabilities (ownership narrowing, governance install/update, a committed `harness.applied`). Worth
attacking only after 031 has produced a real narrowing to serialise; starting earlier means designing a
format for one hypothetical writer.

**5. Plan-036 — the proxy grows.** Opportunistic throughout: each track is small and independent, and
Track 1 (package-exported snippets) is what finally empties `35-dogfooding-drift.sh`'s pair list.

**Then** [Plan-022](022-retiring-a-shell-fragment-its-port-has-replaced.md) — retiring shell fragments
their gates replaced is easier once 035 has classified every fragment's audience.

## Everything else

The plans outside this chain — 004, 008, 015–023, 028 — are unaffected by it and keep their own order.
`vibe-ops plan status` is the coherence check; `vibe-ops records list --type plan` is the roll call.
