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

# ADR-0011: Population belongs to configuration, not a gate

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-10 |
| Deciders | Danilo Borges |

<!-- Status lifecycle: Proposed → Accepted → (Deprecated | Superseded by ADR-XXXX) -->

---

## Context

Sizing the acceptance for an ops composing `markdown-link` and `breadcrumb` over this repository's whole
tracked-markdown surface — "a clean run" — meant actually running both gates unfiltered, the way a
composition would, rather than trusting the corpus probe that had shipped the two gates in the first
place. The run was not clean: 14 findings, all false. Thirteen were `markdown-link` firing on files under
`plugin/skills/*/templates/`, whose links are written to resolve in whatever repository the template is
copied into, never this one. One was `breadcrumb` firing on a bare mention of its own trigger phrase,
written into this repository's governance record while describing an earlier fix.

Both were population faults, not detection faults — each gate correctly reported what it saw; the
population it was handed included files that were never its concern. And both traced to the same root
cause: the `**/templates/**` exclusion this repository needs already existed in three divergent forms —
the shell runner's own file listing filters it out, one gate (`memory-slug`) filters it internally with a
hardcoded `if (file.includes("/templates/")) continue;`, and a third gate (`markdown-link`) applies no
filter at all. A fourth copy, written inside `markdown-link` to fix its 13 false findings, would have
matched the existing pattern rather than ended it.

## Decision

Population exclusion is a typed contract on an ops's own configuration slice, applied by `defineOps`
itself, and a gate may never filter its own population by a repository-specific rule.

Two keys, read from `settings.<ops id>` in `vibeops.config.ts`:

- **`ignore`** — glob patterns to exclude, keyed by entry label; `"*"` applies to every entry in the ops,
  a label narrows further, additively.
- **`disabled`** — a *reason string*, never a boolean, naming why one entry does not run here at all. The
  entry reports `SKIP` with that reason rather than running, or being silently absent.

```ts
settings: {
  governance: {
    ignore: { "*": ["**/templates/**"] },
    disabled: { "record-header-rfc": "rfc records still migrating" },
  },
},
```

This is the missing sibling of `OpsGateEntry.paths`, not a new inhabitant of `options`. The split already
existed and this makes it explicit: `paths` (and now `ignore`/`disabled`) decide **what was read**, and
only the composition can decide that, because a signal's identity includes the population it was read
over (RFC-0001). A gate's own `options` (`schema`, `fragment`, `against`, …) decide **how a gate judges**,
and stay free-form because only the gate can validate them — and validating them never changes what was
examined.

A run reports `ignored` beside `examined`. A population that shrinks in silence is exactly what `examined`
already exists to prevent being confused with a clean reading: 13 findings becoming 0 must not read as a
repair.

## Options considered

- **Fix `markdown-link` directly, with its own `/templates/` check** — cheapest for the one gate in hand.
  Rejected: it is the fourth copy of an exclusion that already existed three times, and a fourth divergent
  copy is what produced this ADR's own evidence, not a fix for it.
- **A negation pattern inside `OpsGateEntry.paths`** (e.g. `"!**/templates/**"`) — keeps the population
  contract inside the composition, where `paths` already lives. Rejected: `filterByGlobs` (and
  `path.matchesGlob`, the native primitive under it) has no negation syntax, so this would mean writing a
  small glob-negation language rather than reusing what exists, for a feature (excluding a sub-scope of an
  already-declared scope) that a second, purely-additive key expresses directly.
- **Configuration keys, owned by core, applied by `defineOps` (chosen)** — additive on top of the existing
  `paths`/`options` split, no new glob syntax, and the repository-specific fact (`**/templates/**` matters
  *because this repository ships templates*) lives in the repository's own config rather than compiled
  into a gate that travels to every repository using it. `disabled` as a reason string, not a boolean,
  mirrors the shell runner's own `VIBE_OPS_DISABLED_CHECKS` doctrine, already proven in this repository:
  a declared disablement is a ledger entry, never a silent pass.

## Consequences

Adding a population exclusion for the next repository-specific fact is a config entry, not a gate change
— no gate under `cli/packages/gates/` may ever again grow a hardcoded path check, and `memory-slug`'s
hardcoded `/templates/` filter was deleted as the first instance of that demotion. `ignore` and `disabled`
apply uniformly to every gate an ops composes, including gates written by someone who has never seen this
repository's configuration — a third-party gate is scoped by configuration exactly the same way a built-in
one is.

The cost accepted: `ignore["*"]` narrows every entry in an ops at once, so a config author who wants one
entry's population narrowed and not another's must reach for that entry's own label — the two-tier
(`"*"` then label) design exists to keep the common case (one repository-wide exclusion) a single line,
at the cost of a config author needing to know the label when the exclusion is meant to be narrower.

## Related

`project/tasks/004-the-governance-ops.md` (where this was designed and measured), `project/plans/010-the-document-model-under-the-gates.md`
(Track 5.5), [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) (the gate/ops split
this extends — a signal's identity includes its population).
