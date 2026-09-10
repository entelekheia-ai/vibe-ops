# @entelekheia/governance-task

**The `task` governance: what only an issue-linked work dossier needs.** A `vibe-ops` governance package —
`type.json`, template, authoring rubric and migration notes — activated by naming `task` in a repository's
`config.types`.

## Why

A task answers *"what is being worked on right now?"* — an ephemeral dossier, not a permanent record: it
is deleted at closure, and what it taught is distilled back into the issue and routed onward. This
package's `type.json` declares the shape: a header table carrying `Status`, `Created`, `Author` and
`Issue`; a short status chain, `Planned` → `In Progress` → `Done`; and no archive directory, because a
finished task does not move, it closes. `authoring.md` covers what the template's own comments cannot: how
a `Surprises & Discoveries` entry earns its place, and what the closure box requires before `task close`
will run.

The code in `src/index.ts` is four lines that call `@entelekheia/governance-base`'s `defineGovernance` and
point it at this package's own root; every mechanic — numbering, the header table, the closure box,
migration dispatch — lives in `governance-base`, not here.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A repository activates it by listing `task` in `vibeops.config`, or by depending on it directly under a
different type name (RFC-0003).

## Usage

```
$ vibe-ops task resolve
DIR=project/tasks
TPL=cli/packages/governance-task/templates/task.md (config)
TPL_VERSION=task@3
AUTHORITY=.agents/rules/governance.md
PAD=3
EXISTING=7
NEXT=008
GH_REMOTE=entelekheia-ai/vibe-ops
GH_AUTH=ok
task dossiers live in project/tasks, next number 008
```

`task` is one of the few types with its own CLI noun rather than routing through `records`: `vibe-ops
task guard <dossier>…` reports which dossiers still have an unchecked closure box, and `vibe-ops task
close <dossier>…` runs the ordering-sensitive tail of closure — tick, commit, delete, repoint, post —
with `--dry-run` to preview it first.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
