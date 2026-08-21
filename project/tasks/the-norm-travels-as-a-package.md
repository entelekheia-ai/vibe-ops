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

# Task: The norm travels as a package

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-20 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/030-the-type-unit-and-the-compositions-derived-from-it.md](../plans/030-the-type-unit-and-the-compositions-derived-from-it.md), Track 3 |

---

## Context

Plan-030 Track 3, and a **course correction** rather than a new capability. RFC-0003 decided the
protocol: *"the resolution protocol is therefore npm, and a type's identity is the package that ships
it."* Tracks 1 and 2 put the type units in `plugin/types/`, because `sourceRoot` — the only path the CLI
has to the norm — resolves to a plugin tree in all three of its forms. That is consistent with the
machinery and divergent from the protocol, and the divergence has a measurable cost.

**Install the npm CLI alone and there is no norm at all.** No package publishes anything but `dist` (plus
`core`'s `queries`), so every template, authoring rule, migration note and type unit reaches a repository
only through the Claude Code plugin. In a CI runner, or any repository that did not install the plugin,
`migrate` finds no notes, `harness status` is mute, and promulgation has nothing to copy.

**It also supersedes the answer Track 4 was about to take.** Deriving the ops entries needs the installed
types; the plan's recorded answer was to give `defineOps` a `needsSource` passthrough so an ops could read
`sourceRoot`. That reads the norm from a plugin tree — precisely the install that has none. A package the
ops depends on resolves from `node_modules`, needs no change to core, and answers in the case
`needsSource` cannot.

**The mechanism already exists in this workspace.** `core` ships `queries/` beside `dist/`
(`"files": ["dist", "queries"]`) and resolves it relative to `import.meta.url`, with a comment recording
that it resolves identically from a checkout and from an installed package. That is the shape to copy, not
to invent.

**The package is not pure data, and that is the point.** A header has a FORMAT, and the TypeScript that
reads that format is coupled to it: `plan-fields.ts` looks for the plan template's own
`Status lifecycle:` marker and its `===== LIVING SECTIONS` fence, `status.ts` counts the checkboxes under
`## Tracks`, `close.ts` reads a task dossier's shape, `log.ts` reads a log entry's frontmatter contract.
Change the template and that code changes with it. Shipping the template in one package and its reader in
another would put a version boundary through the middle of one fact. So the package carries both — and
what stays in `records` is what does not reference any particular template.

**One package for the five shipped types, not five packages.** RFC-0003's own identifier is
`npm/@scope/governance-policies@0.1#policy@2` — the package name is plural and the type is selected
inside it with a fragment, so a package shipping several types is the modelled case rather than an
exception. The two version marks stay independent exactly as the RFC requires: `@0.1` versions the
package, `@2` versions one type's shape.

**In two parts**, because the split is what makes each verifiable:

| Part | What moves | What proves it |
|---|---|---|
| 1 | the data — `types/`, `templates/`, `references/records/`, `migrations/` — and the readers resolving package-first | the npm-only install resolves the shipped types |
| 2 | the coupled TypeScript — `plan-*.ts`, `status.ts`, `close.ts`, `log.ts` — 1333 lines, 46% of `records` | `records` holds nothing that names a particular template |

Nothing in `plugin/` is deleted in either part. The package becomes the canonical copy; the plugin tree
stays a resolving fallback until Track 5 decides what to vacate.

## Work items

Every `Why` below was run before it was written, per `references/records/task.md`.

| # | Priority | Item | Why (measured) | Effort |
|---|---|---|---|---|
| 1 | P0 | `@entelekheia/vibe-ops-types` — one package, five types, data plus the code coupled to it | Settled above rather than left open: `records` is 2866 lines and 1333 of them (46%) name a particular template — `plan-*.ts` and `status.ts` 563, `close.ts` 311, `log.ts` 251, `layout.ts`'s four-type maps 208. That code cannot version separately from the template it reads. | M |
| 2 | P0 | The package ships `types/`, `templates/`, `references/records/` and `migrations/`, resolved `import.meta.url`-relative | `grep '"files"'` across all thirteen packages returns `["dist"]` everywhere but `core`, which adds `queries`. `grammars.ts` is the one working precedent for reading shipped data out of an installed package. | M |
| 3 | P0 | A norm resolver: the package first, `sourceRoot` second, repository override still winning | `resolveSourceRoot` is `config.harness.source ?? --source ?? CLAUDE_PLUGIN_ROOT` — three names for a plugin tree. Keeping it as a fallback is what lets a repository pin an older norm, and what stops this from breaking the installs that work today. | M |
| 4 | P0 | `resolveTypeUnit` gains the package root; `shippedVersion` and `migrationsDir` follow | These are the three readers of the norm that exist. `migrationsDir()` in `module-plan` is repository-first-then-source today and keeps that order with a third root appended. | M |
| 5 | P1 | The three skills that read the norm by `${CLAUDE_PLUGIN_ROOT}` ask the CLI instead | Measured: exactly three — `migrate` (`templates/<type>.md`), `new-log` (`templates/log.md`), `new` (`references/records/<type>.md`). The `setup` occurrences are its own scaffold and do not move. | M |
| 6 | P1 | `harness sync` promulgates from the package | `sync.ts` reads `path.join(sourceRoot, "templates")` and copies into `project/templates/<t>.md`. It is the one writer, so it is one call site. | S |
| 7 | P1 | A repository with the npm CLI and no plugin resolves the shipped types | This is the acceptance the track exists for, and nothing today can demonstrate it — `CLAUDE_PLUGIN_ROOT` is set by Claude Code alone. | M |

### Notes for the implementation pass

- The `vibe-ops-reference: records/<t>@N` declarations keep their names. Their name is their path under
  `references/`, and the package ships that same relative layout — so `55-references-completeness.sh`
  keeps matching, and no recorded reference version changes.
- Ordering: **package root first, then `sourceRoot`, then the repository's own declaration wins over
  both.** The repository-first rule Track 1 settled is about the target's own files; this is about which
  *norm* answers when the target declares none.
- `plugin/types/index.json` and the `type-index-drift` gate move with the units. The gate reads
  `pluginDir` today; it gains the package root the same way.

## Implementation order

**Part 1 — the data ships and resolves.**

- [ ] P0 — item 1, the package and its layout
- [ ] P0 — items 2–4, shipping the data and the three readers that consume it
- [ ] P1 — items 5–6, the skills and promulgation
- [ ] P1 — item 7, the npm-only acceptance

**Part 2 — the coupled code follows** (its own pass, once Part 1 is green): `plan-fields.ts`,
`plan-file.ts`, `plan-lifecycle.ts`, `status.ts`, `close.ts` and `log.ts` move to the package beside the
templates they read; `records` keeps only what names no particular template. The noun modules
(`module-plan`, `module-task`, `module-log` — 624 lines) follow the same seam and are decided there, not
here.

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file.
