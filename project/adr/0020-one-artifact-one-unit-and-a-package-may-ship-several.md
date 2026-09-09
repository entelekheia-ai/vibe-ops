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

# ADR-0020: One artifact, one unit — and a package may ship several

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-08 |
| Deciders | Danilo Borges |
| Supersedes | [ADR-0019](0019-one-artifact-one-governance-package-activated-by-config.md) |

<!-- Status lifecycle: Proposed → Accepted → (Deprecated | Superseded by ADR-XXXX) -->

---

## Context

ADR-0019 settled two things at once and only one of them is under revision here. The part that stands,
unchanged and reaffirmed: **the config is the registry** — a repository states which package serves each
type, there is no scan, and an unresolved binding is reported rather than guessed at.

The part that needs a smaller grain is the sentence "one artifact, one governance **package**". It was
written when every governed artifact was a numbered record and each had its own subject. RFC-0005 adds
`knowledge`, which governs two artifacts that are the same subject read twice: a **log** entry is a trap
addressed by a path inside one repository, and a **learning** is a fact that holds beyond any one
repository. Both are what a piece of work taught, both pass the same promotion test, and that test is a
single document.

Under the package-grain rule the options were both wrong. Two packages means publishing the promotion
test twice and letting the copies drift — the exact failure the base layer exists to remove. One package
serving one type means the two artifacts collapse into one, and the distinction that decides *where a
fact goes* is what would be lost.

The mechanism did not permit the third option either. `activateGovernance` matched a package's single
`unit.type` and cached by package name, so a second binding to the same package was handed whatever the
first had resolved — the same unit under a different name, silently.

## Decision

We will read the rule as **one artifact, one unit**, and allow a package to ship several units.

- A manifest declares either a single unit, as it always has, or a `units` array of full unit objects.
  Declaring both is refused: which one activation should answer with would otherwise be a guess.
- A binding names the unit through the `#type` fragment RFC-0003 already defined — `"learning":
  "@entelekheia/governance-knowledge#learning"` — and the activation cache is keyed by
  `<package>#<type>`.
- A type's **name** remains its identity everywhere it is observable: the noun, the MCP tool, the
  settings key, the ownership fragment's globs, the skills. A type moving into a multi-unit package is
  not a rename and must not read as one.
- Everything ADR-0019 decided about *activation* stands: the config is the registry, there is no scan,
  and a binding that does not resolve is reported.

## Options considered

- **Option A — one package per artifact, always (ADR-0019 as written)** — the rule stays a single
  sentence, at the cost of publishing one shared policy twice and maintaining two copies of it. Rejected:
  the drift it creates is the failure the shared layer exists to prevent.
- **Option B — one package, one type; the second artifact becomes a mode of the first** — no mechanism
  changes, and the distinction that decides where a fact belongs disappears into a flag. Rejected: the
  distinction is the whole content of the type.
- **Option C (chosen) — one unit per artifact, several units per package** — the grain moves down one
  level, `#type` does the selecting, and the cache key gains the type. Costs a manifest form, a
  refusal, and a cache key that must not be got wrong; the failure mode of getting it wrong is silent,
  which is why it is the case a test names.

## Consequences

**Easier.** Two artifacts that share a policy can share a package and publish it once. A package author
writes one manifest with two units instead of two repositories' worth of scaffolding. `governance-log`
retires as a *package* while `log` survives as a *type*, which is the shape that keeps ADR-0019's
stability promise intact.

**Harder.** "One artifact, one package" was a rule you could check by looking at a directory listing;
"one artifact, one unit" is a rule about a file's contents. A package shipping several units is also a
package whose units share a release cadence — deliberately, since they share a policy, but it is a
coupling that did not exist before and it is the reason a package should not accumulate unrelated units.

**The silent failure this makes possible, and what answers it.** A cache keyed by package name serves
the wrong unit without any error, and a wrong unit still resolves, still has a template, still answers.
`cli/packages/core/test/governance-activation.test.ts` names that case directly — a second binding to
the same package must not be served the first binding's unit — because it is not visible from any
output.

**Deferred.** The CLI dispatches a bare noun to a module, and a package shipping two units builds two
modules from one manifest, each naming its unit through `defineGovernance`'s `type` option. That the two
modules coexist under one package is exercised when `governance-knowledge` is built, not here.

## Related

- [ADR-0019](0019-one-artifact-one-governance-package-activated-by-config.md) — the decision this
  supersedes; its activation half is reaffirmed unchanged.
- [RFC-0005](../rfc/0005-every-shipped-file-belongs-to-a-governance-and-the-plugin-binds-the-cli.md) —
  where `knowledge` is specified, and why it is one package with two units.
- [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) — the `#type` fragment this decision
  puts to work.
- [Plan-040](../plans/shipped/040-every-shipped-file-belongs-to-a-governance.md) — Track 2 is where the
  mechanism landed.
