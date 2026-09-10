# @entelekheia/governance-classification

**The information-classification policy: the four levels, and what each permits in a committed file.** A
`vibe-ops` governance package that is itself a policy, checked by `ops-exposure` rather than filed as a
record.

## Why

A repository travels alone and its visibility can flip from private to public in a hurry, so every record
this plugin writes has to be written as if it were already public — the exposure contract this package
ships as its `exposure` facet says what may cross that line (published sources, named and linked freely)
and what may never (a machine path, a sibling repository's name, a personal-memory slug, a pointer to a
private companion document). `ops-exposure`'s `private-name` rule reads the same classification levels
(`secret`, `confidential`, `internal`) to decide **how** a finding may speak — at `secret` it names only
where the material appears, never quoting it — which is why the level lives here rather than being invented
per rule.

The code in `src/index.ts` is four lines that call `@entelekheia/governance-base`'s `defineGovernance` and
point it at this package's own root; `authoring.md` and `migrations/` follow the same shape every other
governance package uses, even though `classification` files no numbered record of its own (`numbered:
false`, `dirs: ["project"]`).

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A repository activates it by listing `classification` in `vibeops.config`, or by depending on it directly
under a different type name (RFC-0003).

## Usage

```
$ vibe-ops records norm --type classification --facet policy --name exposure --print
---
vibe-ops-reference: exposure-contract@1
---

# Exposure contract — what a record may carry into a repository

Applies to everything this plugin writes into a target repository — ADRs, RFCs, plans, task dossiers,
`AGENTS.md`, README — and to the issue comments `close` posts, which are the only surface that leaves
the repository altogether.
...
```

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
