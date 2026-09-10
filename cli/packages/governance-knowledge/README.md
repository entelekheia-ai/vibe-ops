# @entelekheia/governance-knowledge

**The knowledge governance: what a piece of work taught, as two units sharing one promotion test.** A
`vibe-ops` governance package shipping two record types from one manifest — `log` (`project/log/`) and
`learning` (`project/learnings/`, opt-in) — activated by naming `log` and/or `learning` in a repository's
`config.types`.

## Why

Both units record what the work taught; they differ in **what the fact is true of**. A log entry is true
of a path in this repository — someone meets it again by opening that file or working in that folder, and
it is write-once: `numbered: false`, no status, retired by `log sweep` rather than edited. A learning is
true of a language, a tool, a library, or a working habit — it travels to any repository. The admission
test is the same for both: *where does someone meet this again?* A path answers `log`'s `path:` field; a
scope with no path of its own answers `learning`'s `scope:` field. Neither answer means neither record —
what is left is a decision (an ADR) or nothing at all, and a small `project/log/` is this tier working as
intended.

`type.json` declares both units as one array under `"units"` rather than two separate manifests — each
carries its own template, schema (`frontmatter`, not a header table) and migrations directory
(`migrations/` for `log`, `migrations-learning/` for `learning`), but `authoring.md` is shared: the rule
that separates the two matters more than either one alone.

The code in `src/index.ts` is four lines that call `@entelekheia/governance-base`'s `defineGovernance` and
point it at this package's own root.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A repository activates either or both units by listing `log` and/or `learning` in `vibeops.config`.
`/vibe-ops:new-log` is the skill that files a log entry; a learning is filed by `/route-learnings`.

## Usage

```
$ vibe-ops records norm --type log --facet authoring --print
---
vibe-ops-reference: records/knowledge@1
---

# Log and learning — what only these two need

This package ships two types with one set of rules, because the rule that matters is the one that
separates them. Both record what the work taught; they differ in what the fact is true of.
...
```

`log` has its own CLI noun rather than routing through `records`: `vibe-ops log index` regenerates the
index from the entries themselves, `vibe-ops log sweep` reports entries whose `path:` no longer resolves,
and `vibe-ops log lint` checks that the name matches the filename, `kind` is `trap` or `debt`, and the
`attempted` date is real.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
