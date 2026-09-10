# @entelekheia/governance-style

**The default writing voice: how a generated document is phrased, budgeted, tabled and diagrammed.** A
`vibe-ops` governance package that files no record — it contributes *sections* to whatever the CLI is
about to write, and a repository may stack several of them.

## Why

Every other governance package answers *what* a document contains; this one answers *how* it is written.
Keeping the two apart is what lets a repository swap its voice without touching a single template, and
lets a per-artifact variation cost only its delta instead of a second copy of the whole rubric.

`style/general.md` is the base layer, applying to every artifact: language, prescriptive phrasing, the
direct-and-literal rule, map-not-narrative structure, the size budget, when a diagram earns its place, and
the prohibition on leaking private state. Beside it, one fragment per target named in `type.json`'s
`targets` — `style/readme.md` and `style/agents-md.md` — each carrying only that artifact's delta.

The merge unit is the **section**, not the file: a section declares a key (`<!-- key: … -->`, or its
heading's slug), and a later layer reusing that key overrides it. Which layer wins is the *binding's*
decision, never the package's — `on` and `rules` live in the target repository's `types.style`, so a style
package can offer a section but can never declare itself the winner. Composition happens in
`composeStylePolicy` (`@entelekheia/governance-base`); this package is one layer among possibly several.

### Why `style/`

The fragments live in a subdirectory rather than at the package root because `readme.md` at the root *is*
`README.md` on a case-insensitive filesystem — APFS, NTFS — which left a package targeting `readme` unable
to document itself, and let a package's own README be served as its `readme` fragment. See
[issue #31](https://github.com/entelekheia-ai/vibe-ops/issues/31) and ADR-0022. Fragments are read from
`style/` only; a package still shipping them at its root contributes nothing.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

It is the default layer of the `types.style` stack — a repository that declares nothing gets it. Naming
any layer makes the repository responsible for the whole stack, so name this one first to keep the default
voice beneath a variation:

```jsonc
// vibeops.config.mjs
types: {
  style: ["@entelekheia/governance-style", "@scope/my-house-voice"],
}
```

## Usage

```
$ vibe-ops records norm --type style --facet policy --for readme --print
# Authoring style — how a generated document is written
...
## A README is presentation, not process history

Write what a newcomer runs and uses, in the order they need it — install, then usage, then links to
deeper docs. A decision, a status update or a narrative of how the project got here belongs in an ADR, a
plan or a log, never in the README; ...
```

`--explain` names the origin package and file of every composed section, which is how a stack's collisions
are read.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
