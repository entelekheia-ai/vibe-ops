---
vibe-ops-template: task@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: The type unit and its resolution roots

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/030-the-type-unit-and-the-compositions-derived-from-it.md](../plans/030-the-type-unit-and-the-compositions-derived-from-it.md), Track 1 |

---

## Context

Plan-030 Track 1. A record type's data facets are found today by six different conventions, and
no repository can add a type without editing this one. This dossier gives a type **one
declaration** — a manifest per type, resolved through a root list — without moving a single file.

**The unit is a manifest, not a folder.** The sketch in the plan moved the facets into
`types/<name>/`. Measured against the code, a path here is load-bearing rather than an address,
and four mechanisms read it as meaning: the authoring rules declare their own version *as their
path* under `references/` (`vibe-ops-reference: records/adr@1`) and
`55-references-completeness.sh` matches the two; a migration note's type is parsed out of its
filename by `readMigrationNotes`; `template-heading-drift` receives one notes directory and
attributes each dropped section by that same prefix; `35-dogfooding-drift.sh` pairs each template
with a second copy under `skills/setup/templates/`. A manifest declaring where each facet already
lives costs none of that, and a package shipping a self-contained folder declares that geometry
just as well. **Moving this repository's own five types is separate work with its own track**,
taken up once the unit is proven by a fixture package.

**Resolution is repository first, installed norm second.** It is the order `migrationsDir()` in
`cli/packages/module-plan/src/index.ts` already implements, with its reason written above it, and
the order `records.dirs` / `records.templates` already practise. The alternative would impose a
shape at the moment somebody updated an unrelated package, on tooling that does not run
continuously.

**Two authorities, because there are two populations.** The norm's own facets are generated, so the
CLI reads a generated index shipped inside the plugin tree — `plugin/types/index.json`, never an
npm package's `dist/` (`sourceRoot`, the one reader this index has to serve, means the installed
plugin tree throughout this codebase; `shippedVersion()` already reads
`sourceRoot/templates/<type>.md`, never a `dist/` path). A target repository has no build, so its
artefacts' own headers are the authority there. That split is the pair `vibe-ops harness status`
already compares.

## The unit

Hand-written per type, at `plugin/types/<name>/type.json`. Every path in it is relative to the
manifest, so a unit is relocatable as a whole:

```json
{
  "type": "adr",
  "template": "../../templates/adr.md",
  "authoring": "../../references/records/adr.md",
  "migrations": "../../skills/migrate/migrations",
  "schema": { "carrier": "table", "required": ["Status", "Date", "Deciders"] },
  "numbered": true,
  "pad": 4,
  "depth": 1,
  "dirs": ["project/adr", "adr", "docs/adr"]
}
```

| Facet | Required | Default | Why |
|---|---|---|---|
| `type` | yes | — | The local short name RFC-0003 binds one owner to. |
| `template` | yes | — | An artefact has a form, and this file also declares the type's version. |
| `authoring` | yes | — | `/new` writes the form correctly and invents the content without it. |
| `migrations` | yes | — | A directory, possibly empty. Empty means "no jump recorded"; undeclared means "nowhere to look", and the two must not be the same answer. |
| `schema` | yes | — | Typed by carrier: `table` is read by `record-header`, `frontmatter` by `check-frontmatter`. |
| `numbered` | no | `true` | `log` is addressed by the path where a trap recurs, never by a sequence. |
| `pad` | no | `3` | Only meaningful when `numbered`. |
| `depth` | no | `1` | `2` for a type that archives into a subfolder and keeps its number — `rfc` today, `plan` once `shipped/` exists. |
| `dirs` | no | `project/<t>`, `<t>`, `docs/<t>` | Search order in a **target** repository, which `records.dirs` overrides. It is not where the type is defined. |

**`schema.carrier` is what keeps `log` inside the model.** `log` declares `name`, `description`,
`kind`, `path`, `attempted` and `source` in YAML frontmatter, never in a `| Field | Value |`
table — so its absence from `ops-governance`'s `record-header` entries is a second carrier, not a
missing facet. Deriving entries (Track 4) keys off the carrier, which is what bounds the composed
output's change to the two entries the plan declares in advance rather than leaving it open.

## Work items

Every `Why` below was run before it was written, per `references/records/task.md`.

| # | Priority | Item | Why (measured) | Effort |
|---|---|---|---|---|
| 1 | P0 | The manifest schema and its validator | Nothing today can express a type: `RecordType` is a closed union of four literals at `cli/packages/core/src/config.ts:61`, and three call sites carry `RecordType \| "log"` by hand to work around it. | M |
| 2 | P0 | The resolver over the two roots, repository first | `migrationsDir()` is the only two-root resolution that exists and it covers one facet. The other five have no fallback at all — `findTemplate` searches the repository and stops. | M |
| 3 | P0 | Five units for `adr`, `rfc`, `plan`, `task`, `log`, pointing at current paths | Nothing moves, so the four load-bearing path readers named in Context stay correct by construction. | S |
| 4 | P0 | `log`'s real debt declared in its unit | `plugin/references/records/` holds `adr`, `rfc`, `plan`, `task` and no `log.md`, so `/new` has no rules to read for it. And the pair list in `35-dogfooding-drift.sh` names four templates: `log`'s shipped copy exists and is compared to nothing. | S |
| 5 | P1 | `plugin/types/index.json`, generated, plus the **gate** that rebuilds and compares it | Without it the index wins silently: a version edited in a template's frontmatter and never regenerated is a wrong answer that looks like an answer. A gate, not a shell fragment — new detectors are gates (RFC-0001), and only a gate can declare `fixable` and regenerate what it found stale. | M |
| 6 | P1 | `shippedVersion()` reads the index instead of `sourceRoot/templates/<type>.md` | It is the one function reading the norm's template frontmatter directly, and it feeds both `harness status` and the SessionStart hook. | S |
| 7 | P1 | A fixture unit in a temp root resolves end to end | `records resolve --type adr` already answers today, so it cannot distinguish before from after. The fixture is the only acceptance that can. | M |

### Notes for the implementation pass

- The manifest is **data, never executable**. A type declaration must be readable without importing
  the package that ships it, for the same reason the scan in Plan-029 Track 2 must not execute code.
- `schema.carrier` is `table` or `frontmatter` today, and both consuming gates hold closed schema
  sets — `record-header` throws outside `adr/plan/rfc/task`, `check-frontmatter` serves
  `rule`/`skill`/`agent`. Making them data-driven is Track 2; this one only declares the facet.
- The status chain is **not** a facet. `plan-fields.ts` reads it from the resolved template's own
  `Status lifecycle:` marker, falling back to the repository's governance rule. A field here would
  be a second authority over a number that already has one.
- `dirs` is the target-repository search order, distinct from where the type is defined. Keeping
  the two in one key is what made the plan's original facet table read as if a type owned a
  directory.
- The resolver belongs in `cli/packages/records/src/type-unit.ts`, beside `layout.ts` (search-order
  resolution) and `dispatch.ts` (which already takes a `migrationsDir?: string` rather than computing
  it — the same shape to follow). `records` depends only on `core`, and every consumer that would
  resolve a manifest (`module-plan`, `module-task`, `module-records`, `gates`, `module-harness`)
  already depends on `records`.
- The validator follows `cli/packages/module-harness/src/ownership.ts`'s `readOwnership()` — the one
  existing "parse JSON, validate shape, throw a clear error naming the file" precedent in this
  codebase: `JSON.parse(text) as Partial<T>`, explicit field checks, no schema library (none exists in
  `core` or `records`; `zod` appears exactly once, in `cli`, for MCP tool shapes only).
- **A declared-but-missing facet inside a manifest does not throw** — unlike `layout.ts`'s
  `RecordsConfigError`, which fires when a `vibeops.config.ts`-declared path is missing because that
  path is about to be *written to*. A `type.json`'s paths are read by many read-only callers, and
  RFC-0003's own rule governs: a declared binding is used even when it does not resolve, visible and
  attributable rather than a silent fallback. Only a manifest that fails to *parse* throws (reuse
  `RecordsConfigError`, do not add a second error class). This is the mechanism item 4's `log` debt
  needs: its `authoring` path resolves to `authoringExists: false`, not a crash.
- `35-dogfooding-drift.sh`'s pair list is missing `log` even though its shipped copy under
  `skills/setup/templates/project/templates/log.md` exists. Adding it is one line in the `for pair in`
  block, independent of the resolver work — the other half of item 4.

## Implementation order

- [ ] P0 — items 1–2, the schema and the resolver (not delegable: the manifest shape *is* the design)
- [ ] P0 — items 3–4, the five units and `log`'s declared debt (delegable once the schema is fixed)
- [ ] P1 — items 5–6, the generated index and its single consumer
- [ ] P1 — item 7, the fixture

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file.
