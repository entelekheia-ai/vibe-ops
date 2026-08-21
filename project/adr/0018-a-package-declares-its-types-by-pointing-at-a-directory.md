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

# ADR-0018: A package declares its types by pointing at a directory

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-21 |
| Deciders | Danilo Borges |

<!-- Status lifecycle: Proposed → Accepted → (Deprecated | Superseded by ADR-XXXX) -->

---

## Context

RFC-0003 settles that a governance type is resolved through npm and that its identity is the package
shipping it. It deliberately leaves the *shape* of the declaration open — Implementation Note 2 asks only
"what a package publishes to declare a type, and how installed packages are enumerated".

Plan-029 Track 2 had to answer it, and the answer is **an external contract**. Every package that ever
contributes a type implements this field: the shipped `@entelekheia/vibe-ops-types` first, then
`governance-plan`, `dot-agent-freeze`, and anything a third party publishes. Once those exist, changing
the field's name or meaning breaks each of them at once, which is what makes this hard to reverse rather
than a naming preference.

Two further constraints were fixed before the choice was made. A type ships as **data**, so learning that
a package declares one must not execute that package's code — the scan reads and never imports. And npm
**hoists**: in a workspace every dependency resolves from the root `node_modules`, so enumeration walks
upward rather than looking beside the consuming package.

## Decision

We will have a package declare its types with a **manifest field naming a directory**:

```json
{ "vibeOps": { "types": "types" } }
```

The path is relative to the package root, and the type names are **the directory's own subdirectory
names** — `<packageRoot>/<dir>/<name>/type.json`. The manifest never lists the names.

## Options considered

- **Option A — list the names in the manifest** (`"types": ["adr", "plan"]`) — the scan answers "who
  claims X" from `package.json` alone, touching no other file. But it puts a second copy of the directory
  listing beside the directory, and the two drift the first time somebody adds a unit without editing the
  manifest. That is the exact failure `type-index-drift` was written to catch one plan earlier.
- **Option B — a standalone declaration file** (`vibe-ops-types.json` at the package root) — keeps
  `package.json` clean and mirrors what tree-sitter's yaml grammar does. But it is a second file to find
  and a second convention to support, and this workspace already carries the cost of exactly that: the
  header comment on `core/src/grammars.ts` records having to read *both* forms because two grammar
  packages disagreed.
- **Option C (chosen) — a manifest field pointing at a directory** — one source for the names, one place
  to look, and the field itself has precedent inside this same package, where `grammars.ts` reads a
  grammar's own `"tree-sitter"` array out of its `package.json`. The cost is one `readdir` per candidate
  package, paid only for packages that carry the field.

## Consequences

**Easier.** A package adds a type by adding a directory — no manifest edit, so the two can never
disagree. The scan stays cheap: `package.json` is read for every installed package, but the directory is
listed only for the few that declare the field. Reading rather than importing also means the scan sees a
package that would fail to import at all.

**Harder.** Answering "which types does this package claim" now costs filesystem access, so it cannot be
done from a lockfile or a registry response alone — relevant if type resolution is ever wanted before
install. A package that ships the field and no directory declares nothing rather than erroring, which is
the safe direction but is silent; the finding surfaces only at the point a name fails to resolve.

**Accepted risk.** `vibeOps` is an unnamespaced top-level key in `package.json`. It is conventional for
tooling to claim one, and no collision is known, but the name is now spent.

**Follow-up.** Where a resolution finding *lands* is deliberately not settled here: `resolveTypeName`
returns the reason as data and throws nothing, so an ops reports it as a finding and a verb as a line.
Fixing one caller's shape onto every other was avoided while the ambiguity case still has no consumer.

## Related

- [RFC-0003](../rfc/0003-a-governance-type-as-a-pluggable-unit.md) — Implementation Note 2, which this
  answers. The RFC decided npm is the protocol; this decides what a package says.
- [Plan-029](../plans/shipped/029-a-record-type-becomes-a-resolved-name.md) — Track 2, where the scan and
  the binding table were built, and whose Decision Log carries the three smaller choices made beside this
  one.
- [Plan-030](../plans/030-the-type-unit-and-the-compositions-derived-from-it.md) — Track 3, the first
  package that will implement this field.
