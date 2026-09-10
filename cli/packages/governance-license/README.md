# @entelekheia/governance-license

**The `license` governance: the licence texts this tooling hands out, their pinned sources, and the
scaffold a repository needs to carry one.** A `vibe-ops` governance package, but not a *record* type — a
repository holds exactly one licence, and it is never numbered.

## Why

A licence handed to another repository must be the licence, byte for byte — a paraphrase reads as
legal-sounding prose and is wrong in the operative clauses, and nobody re-reads a `LICENSE` file after it
lands. `templates/SOURCES.tsv` is the anchor against that: one row per licence id, carrying the URL it was
published at and the sha256 of the file as published, which `ops-mirror`'s `license-text` entry checks a
shipped text against.

`type.json`'s own `scaffold` is what `/vibe-ops:license-setup` writes into a target repository: a `NOTICE`
and `AUTHORS` template for a fork carrying two attributions, `scripts/verify-license-text.sh` and
`scripts/ensure-license-headers.sh`, and the two GitHub Actions workflows that run them. `authoring.md`
covers the one rule a shipped text must never break: no copyright line naming a person, because a template
copied into somebody else's repository would credit this plugin's author for work that is not theirs.

The code in `src/index.ts` is four lines that call `@entelekheia/governance-base`'s `defineGovernance` and
point it at this package's own root.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A repository activates it by listing `license` in `vibeops.config`, or by depending on it directly under a
different type name (RFC-0003). `/vibe-ops:license-setup` is the skill that actually asks which licence and
writes the scaffold.

## Usage

```
$ vibe-ops records norm --type license --facet authoring --print
---
vibe-ops-reference: records/license@1
---

# Licence — what only a licence needs

A licence is not a record: it is not numbered, it carries no header table and no frontmatter, and a
repository holds exactly one. ...
license authoring from package
```

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
