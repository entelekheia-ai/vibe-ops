---
"@entelekheia/governance-knowledge": minor
"@entelekheia/vibe-ops-core": minor
"@entelekheia/vibe-ops-cli": minor
---

`@entelekheia/governance-log` retires as a package (project/plans/040-\*.md Track 3, [ADR-0020](../project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md)). `@entelekheia/governance-knowledge` takes its place, moved whole — same source history, same `type.json` data — and ships **two units** from one manifest: `log` (`project/log/`, unchanged in every observable way: type name, noun, MCP tool, settings key, ownership fragment's globs, template, migrations) and `learning` (`project/learnings/`, a fact that holds beyond one repository, pure sugar today — `resolve` only).

`DEFAULT_GOVERNANCE_BINDINGS.log` now points at `@entelekheia/governance-knowledge` (no `#fragment` needed — `log` is the package's default-exported unit, from the `.` export); a repository that declares nothing about `log` sees no change. `learning` is **not** in the default bindings — a repository binds it only when it has learnings of its own to keep.

Both units share one policy facet, `lifecycle` (`policy/lifecycle.md`, moved from `plugin/references/knowledge-lifecycle.md` with its `vibe-ops-reference: knowledge-lifecycle@1` stamp byte-identical): the promotion test that decides which of the two a fact becomes is one document, and both units can serve it.

**Finding, not fixed here:** the CLI's bare-noun dispatch (`loadModule` in `cli/packages/cli/src/resolve.ts`) resolves a governance binding's `packageName` only, never its `#type` fragment — so `vibe-ops learning <verb>` with `types.learning` declared currently loads and runs the **same module** as `vibe-ops log <verb>` (the package's `.` export), silently. `activateGovernance` (used by `records norm`, ownership globs and template resolution) is unaffected, because a multi-unit package's `units` array carries every unit's DATA regardless of which entry module happened to load. Only the terminal/MCP verb dispatch for a *second* noun sharing a package is affected, and only once a repository actually binds one. [ADR-0020](../project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md) flagged this as deferred; this release is what makes it observable.
