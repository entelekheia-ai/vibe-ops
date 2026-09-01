---
vibe-ops-template: adr@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0014: Clone-local configuration layers over the committed file rather than replacing it

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-13 |
| Deciders | Danilo Borges |

---

## Context

Configuration resolves through a cascade: the file nearest the repository root wins per key, and the
search continues upward to the operator's home directory. Until now there was exactly one file per
directory, committed, holding what is true of that repository.

Two needs arrived together that a single committed file cannot serve. A promulgation mechanism has to
record which version of each record type it wrote into **this clone** — a fact about one working tree on
one machine, which committing would turn every promulgation into a diff in a file the repository owns.
And the committed configuration's own comment already told operators that personal preferences belong
outside it, while offering no file to put them in.

The resolver read a per-directory list of candidate filenames and returned the **first match**, which
matters because it decides what "adding another filename" means.

## Decision

We will resolve **two files per directory** — a clone-local one, ignored by version control, and the
committed one — and **merge both**, with the local winning per key. The pair repeats at every level of the
cascade, including the home directory. The directory walk continues to outrank the pair: a nearer
committed file beats a farther local one.

A committed configuration may therefore ship fully populated while a clone overrides only the handful of
keys that are true of that machine, restating nothing.

## Options considered

- **Option A — one more filename in the existing candidate list.** One line of change. Rejected: the
  resolver returns the first match per directory, so the local file would *replace* the committed one
  rather than layer over it — a clone declaring one override would silently discard everything the
  repository declared about itself, and nothing would report it.
- **Option B — a separate resolution pass for clone-local values, outside the cascade.** Keeps the
  existing resolver untouched. Rejected: it makes two places to look for the same kind of answer, and a
  second merge rule would have to be invented and kept in agreement with the first.
- **Option C (chosen) — the resolver returns every match in a directory, local first, merged through the
  existing rule.** One concept, one merge rule, and the pair generalises to every level for free. The cost
  is that a directory can now contribute more than one source.

## Consequences

**Easier.** A repository can declare a complete configuration without worrying that a contributor's local
override erases it. Operator-wide preferences finally have a home the tooling actually reads. And the
promulgation state has somewhere to live that no commit will ever contain.

**Harder.** Reasoning about where a value came from now requires reading two files per level rather than
one — which is why the loaded result reports *every* file that contributed rather than one per directory.
An ignored file is also invisible to anyone who did not create it, so a committed sample declaring which
keys exist is not optional decoration; without it the feature is undiscoverable.

**A risk accepted deliberately.** A stale local file in the home directory could govern behaviour in every
repository the operator opens. The directory walk outranking the pair is what bounds it — any repository
that declares its own answer wins — and that ordering is asserted by a test rather than left as a
property someone might refactor away, because inverting it produces a cascade that still looks correct.

**One key does not follow the merge rule.** The promulgation state merges nearest-wins *whole* rather than
per record type: "this clone is on plan@3" is a fact about a single working tree, and a half-inherited map
assembled from two levels would answer for a repository it was never applied to.

## Related

- [Plan-025](../plans/shipped/025-the-harness-module-and-the-norm-it-promulgates.md) — the promulgation work this
  decision was made for; Track 3.
- [RFC-0002](../rfc/0002-bootstrapping-a-repository-and-what-auto-configuration-may-decide.md) — why the
  state stored is a version applied rather than a set of switches, which is what needed a clone-local home
  in the first place.
