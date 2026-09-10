# @entelekheia/governance-instructions

**The instruction surface: `AGENTS.md`, its `CLAUDE.md` import, the `.agents/` ↔ `.claude/` bridge, and
`repo-guardrails.md`.** A `vibe-ops` governance package that scaffolds the files an agent reads on entry,
rather than filing a numbered record.

## Why

A repository has several places to put an instruction for an agent, and they are not interchangeable — a
hook or a lint enforces regardless of what the agent decides, a path-scoped rule loads only for matching
files, an always-on rule carries the same priority as the instruction file itself, and a skill loads only
on demand. This package's `surfaces` facet is that routing rule: which mechanism a given fact belongs in,
and why raising compliance means moving *up* that ladder rather than sideways along it. Its `scaffold`
writes the mechanics that make the ladder work in a target repository: a root `CLAUDE.md` that imports
`AGENTS.md` (so a nested `AGENTS.md` with no sibling import is never silently unread),
`.agents/rules/repo-guardrails.md`, and the `.agents/skills/` folder the plugin's own skills bridge into
`.claude/skills/` as relative symlinks.

The code in `src/index.ts` is four lines that call `@entelekheia/governance-base`'s `defineGovernance` and
point it at this package's own root; `instructions` ships no template and no numbering (`numbered: false`,
`dirs: []`) because there is exactly one `AGENTS.md` per repository, not a series of records.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A repository activates it by listing `instructions` in `vibeops.config`, or by depending on it directly
under a different type name (RFC-0003). `/vibe-ops:authoring-agents-md` is the skill that writes and
refreshes the `AGENTS.md` itself.

## Usage

```
$ vibe-ops records norm --type instructions --facet policy --name surfaces --print
---
vibe-ops-reference: instruction-surfaces@1
---

# Instruction surfaces — which file gets a fact, and how it reaches the agent

Decision record: ADR-0003.

A repository has several places to put an instruction and they are not interchangeable. This file is
the routing rule and the mechanics behind it.
...
```

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
