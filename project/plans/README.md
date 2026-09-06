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
| 034 | [the ops become data, and the governances feed them](./shipped/034-the-ops-become-data-and-the-governances-feed-them.md) | Backlog | nothing |
| 035 | [the audience boundary](035-the-audience-boundary.md) | Backlog | nothing (034 shipped) |
| 031 | [ownership fragments, and the shaped class](./shipped/031-ownership-fragments-and-the-shaped-class.md) | Backlog | nothing |
| 032 | [the ownership verb, and the configuration it writes](./shipped/032-the-ownership-verb-and-the-configuration-it-writes.md) | Shipped | — |
| 036 | [the proxy grows](036-the-proxy-grows.md) | Backlog | nothing (opportunistic) |

## Suggested attack order

**Plan-034 shipped 2026-08-22** — the derivation and the `.json` collection landed; the chain's claim
is proven (adding a type is "publish a package, add one config key"). What follows is renumbered.

**Plan-031 shipped 2026-08-22** — the shaped class, composition with origin and the repository's
narrowings landed; Plan-017 closed alongside it, its migration assumption reversed by the shipped-corpus
policy (terminal records keep their shape; living ones migrate opportunistically when edited).

**1. Plan-035 — the audience boundary.** While the `.json` collection is fresh — the
field is meant to be born in the data form rather than added to the TypeScript shape and migrated later.

**Plan-032 shipped 2026-09-06** — RFC-0004, the managed layer, the sync ceremony with its receipt, the
`config` and `ownership` nouns, three gates; the one repository holding a state file migrated.

**3. Plan-036 — the proxy grows.** Opportunistic throughout: each track is small and independent, and
Track 1 (package-exported snippets) is what finally empties `35-dogfooding-drift.sh`'s pair list.

**Then** [Plan-022](022-retiring-a-shell-fragment-its-port-has-replaced.md) — retiring shell fragments
their gates replaced is easier once 035 has classified every fragment's audience.

## Everything else

The plans outside this chain — 008, 015–023, 028 — are unaffected by it and keep their own order. (004 closed 2026-08-22 as overtaken — the research-skill capability shipped outside this repository; 008 is open with its own goals unmet, and is the one record deliberately left at `plan@0.1` until its work finishes.)
`vibe-ops plan status` is the coherence check; `vibe-ops records list --type plan` is the roll call.
