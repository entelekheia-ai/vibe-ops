# @entelekheia/governance-plan

**The `plan` governance: what only an implementation plan needs.** A `vibe-ops` governance package —
`type.json`, template, authoring rubric and migration notes — activated by naming `plan` in a repository's
`config.types`.

## Why

A plan answers *"how do we build X?"* and is the permanent design record, never deleted once shipped. This
package's `type.json` declares the shape: a header table carrying `Status`, `Created` and `Author`; a
status chain of `Backlog` → `In Progress` → `Shipped`; two **living sections** — `Decision Log` and
`Outcomes & Retrospective` — that accumulate entries across the plan's whole life instead of being written
once; and an `archive: "shipped"` directory a closed plan moves into, keeping its number. `authoring.md`
covers what the template's own comments cannot: how to break work into tracks, when a track earns its own
closure box, and what the retrospective owes the plan's original goals.

The code in `src/index.ts` is four lines that call `@entelekheia/governance-base`'s `defineGovernance` and
point it at this package's own root; every mechanic — numbering, the header table, the living sections,
the closure box, migration dispatch — lives in `governance-base`, not here.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A repository activates it by listing `plan` in `vibeops.config`, or by depending on it directly under a
different type name (RFC-0003).

## Usage

```
$ vibe-ops plan resolve
DIR=project/plans
TPL=cli/packages/governance-plan/templates/plan.md (config)
TPL_VERSION=plan@3
AUTHORITY=.agents/rules/governance.md
PAD=3
EXISTING=40
NEXT=041
PLAN_ACTIVE=In Progress
PLAN_TERMINAL=Shipped
LIVING=Decision Log, Outcomes & Retrospective
plans live in project/plans, next number 041
```

`plan` is one of the few types with its own CLI noun rather than routing through `records`: `vibe-ops
plan status` reads every plan whose `Status` disagrees with its own track checkboxes, `vibe-ops plan
context` builds the plan-mode guidance from the template's own markers, and `vibe-ops plan close <plan>`
sets the terminal status and moves the file into `shipped/`.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
