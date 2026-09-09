# AGENTS.md — {{REPO_NAME}}

> **This file has not been authored yet.** It was written by `vibe-ops setup scaffold` so the repository
> has the instruction file its own gate requires, and everything below this line is a prompt, not a map.
> Run `/vibe-ops:authoring-agents-md` — or write it by hand against the sections below — and delete this
> paragraph when you do.

{{ONE_LINE_DESCRIPTION}}

## Layout

<!-- A row earns its place by saying something `ls` does not. Delete this comment and the example row. -->

| Path | What is not obvious about it |
|---|---|
| `project/` | This repo's governance records, and the one folder with a path-scoped rule (`.agents/rules/governance.md`) that auto-loads only while you work inside it. |

## How this repo works — not obvious from the code

<!-- The "don't do this or it breaks" invariants, each with the breakage it prevents. Anything
     mechanically checkable becomes a check instead of a sentence here. -->

## Source of truth

| For | Read |
|---|---|
| Which record answers which question | [`GOVERNANCE.md`](GOVERNANCE.md) |
| Record lifecycles, numbering, immutability | [`.agents/rules/governance.md`](.agents/rules/governance.md) |
| Install and usage | [`README.md`](README.md) |

## Keeping this file current

Updating it is **part of any task that changes the shape of the tree** — a stale map is worse than none.
Triggers: a top-level folder appears or moves; a fact stops being true; a new invariant is discovered.
