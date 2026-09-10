# @entelekheia/governance-base

**The machinery every governance package is built from, not a governance type of its own.** It carries
the `defineGovernance` sugar, the `type.json` reader, numbering, lifecycle and migration mechanics — and
two policies that describe that machinery rather than any single artifact.

## Why

`governance-adr`, `governance-rfc`, `governance-plan`, `governance-task`, `governance-license`,
`governance-classification`, `governance-instructions` and `governance-knowledge` each ship a `type.json`,
a template, an `authoring.md` and a set of migrations — and nothing else. Every one of their `src/index.ts`
files is four lines that call `defineGovernance({ root, version })` and point it at their own package
root. This package is where those four lines do their work: it resolves a type's directory, its template
and its next number (`layout.ts`), reads and renders header tables and frontmatter (`header-table.ts`,
`frontmatter.ts`), drives a record's status chain and its living sections (`plan-fields.ts`, `closure.ts`),
composes migration notes and dispatches a record to the one that applies (`dispatch.ts`), and reads a
type's own facets for the `records norm` verb every plugin skill calls (`norm-facet.ts`).

**`base` is also a governance type of its own kind — policy-only, with no record and no template.** Its
`type.json` declares `numbered: false`, an empty `dirs` list, and two `facets`:

- **`convergence`** (`policy/convergence.md`) — the two kinds of skill (target-state vs. event) and the
  four verbs a target-state skill applies (`create`, `adopt`, `migrate`, `leave`).
- **`migration`** (`policy/migration.md`) — how a template version bump is declared and carried through
  the packages that depend on this one.

It also owns `scaffold/`, the born-organized repository baseline (`AGENTS.md`, `README.md`, `.gitignore`,
`.editorconfig`, the `docs/` Diátaxis skeleton, `package.json` in both single-package and workspace
shapes) that `/vibe-ops:setup repo` writes into a new repository.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it as a dependency of every
`governance-*` package.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

A third-party governance package (RFC-0003) declares it the same way: `defineGovernance` is the only
supported way to build one, so depending on this package is how a type gets numbering, a lifecycle chain
and the `norm` verb without reimplementing any of them.

## Usage

Reading one of its own two policies goes through the same `records norm` verb every other type's facets
go through:

```
$ vibe-ops records norm --type base --facet policy --name convergence --print
---
vibe-ops-reference: convergence-policy@2
---

# Convergence policy — two kinds of skill, four verbs
...
base policy from package
```

The trailing `base policy from package` line is `norm`'s own provenance marker — it names where the
printed facet came from, the same way every other type's `norm --print` output ends.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
