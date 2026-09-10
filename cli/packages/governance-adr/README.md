# @entelekheia/governance-adr

**The `adr` governance: what only an Architecture Decision Record needs.** A `vibe-ops` governance
package — `type.json`, template, authoring rubric and migration notes — activated by naming `adr` in a
repository's `config.types`.

## Why

An ADR answers *"we decided X, because Y"*, one decision per record. This package's `type.json` declares
the shape: a header table carrying `Status`, `Date` and `Deciders`; a status chain of `Proposed` →
`Accepted`, with `Deprecated` and `Superseded` as branches off `Accepted`; and `immutableFrom: "Accepted"`
— an accepted ADR's body never changes, a later decision supersedes it instead. `authoring.md` covers what
the template's own comments cannot: default to `Status: Accepted` unless the user says otherwise, write
**Options considered** with at least one honestly rejected alternative, and update only the `Status` and
`Superseded by` rows of the record being superseded — never its body.

The code in `src/index.ts` is four lines that call `@entelekheia/governance-base`'s `defineGovernance`
and point it at this package's own root; every mechanic — numbering, the header table, the lifecycle
chain, migration dispatch — lives in `governance-base`, not here.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A repository activates it by listing `adr` in `vibeops.config`, or by depending on it directly under a
different type name (RFC-0003).

## Usage

```
$ vibe-ops records resolve --type adr
DIR=project/adr
TPL=cli/packages/governance-adr/templates/adr.md (config)
TPL_VERSION=adr@2
AUTHORITY=.agents/rules/governance.md
PAD=4
EXISTING=21
NEXT=0022
adr records live in project/adr, next number 0022
```

The same noun reads the authoring rubric:

```bash
vibe-ops records norm --type adr --facet authoring --print
```

`vibe-ops new adr <topic>` (the plugin skill) is what actually files a new record from the template.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
