# @entelekheia/governance-rfc

**The `rfc` governance: what only a Request for Comments needs.** A `vibe-ops` governance package —
`type.json`, template, authoring rubric and migration notes — activated by naming `rfc` in a repository's
`config.types`.

## Why

An RFC answers *"should we do X, and how?"* — a design proposed before it is built, not a decision already
made. This package's `type.json` declares the shape: a header table carrying `Status`, `Created` and
`Author`; a longer status chain than an ADR's, `Draft` → `Review` → `Accepted` → `Implemented`, because a
design is argued over before it is settled; `Rejected` branching off `Review` into an `rejected/` archive,
and `Superseded` off `Accepted`; and `immutableFrom: "Implemented"`. `authoring.md` covers what the
template's own comments cannot.

The code in `src/index.ts` is four lines that call `@entelekheia/governance-base`'s `defineGovernance` and
point it at this package's own root; every mechanic — numbering, the header table, the lifecycle chain,
migration dispatch — lives in `governance-base`, not here.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A repository activates it by listing `rfc` in `vibeops.config`, or by depending on it directly under a
different type name (RFC-0003).

## Usage

```
$ vibe-ops records resolve --type rfc
DIR=project/rfc
TPL=cli/packages/governance-rfc/templates/rfc.md (config)
TPL_VERSION=rfc@2
AUTHORITY=.agents/rules/governance.md
PAD=4
EXISTING=7
NEXT=0008
rfc records live in project/rfc, next number 0008
```

The same noun reads the authoring rubric:

```bash
vibe-ops records norm --type rfc --facet authoring --print
```

`vibe-ops new rfc <topic>` (the plugin skill) is what actually files a new record from the template.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
