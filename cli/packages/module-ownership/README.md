# @entelekheia/vibe-ops-module-ownership

**The composed ownership boundary: the effective class of a path, the full list, and the one write over
it.** A vibe-ops module: the `ownership` noun on the `vibe-ops` CLI, and the same verbs as MCP tools.

## Why

Promulgating a norm into a repository (`vibe-ops harness sync`) has to know, for every path it might
touch, whether it may overwrite that path at all — a template it fully owns (`norm`), a file split between
the tooling's structure and the repository's words (`shaped`), a scaffold written once and never touched
again (`seed`), or something the repository alone owns (`repo`). That boundary is composed from the base
harness fragment plus every activated governance package's own fragment, with the repository's own
narrowings from `vibeops.config` applied last. This module reads that composition — built once by
`@entelekheia/vibe-ops-harness` — rather than re-deriving it, and exposes the one write a repository needs
over it: a narrowing, never a widening.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

## Usage

```
$ vibe-ops ownership get README.md
README.md: shaped (**/README.md, @entelekheia/vo-plugin-readme) — The tooling owns the structure via the template and its version stamp; the repository owns every word describing its own package. Promulgation never writes here — README content is package-specific and cannot be generated.
```

```bash
vibe-ops ownership get <path>                        # effective class for one repository-relative path,
                                                      # the entry that decided it, and any other claimants
vibe-ops ownership list                              # every entry, in effective order, plus conflicts
vibe-ops ownership list --show-origin                # plus which fragment or repository file decided each
vibe-ops ownership set <match> <class> --reason <text>  # write one narrowing into the managed layer
```

`get` on a path with no matching entry reports that plainly — absence is never permission. `set` refuses
an unknown class, a missing `--reason`, or a widening: it composes the candidate narrowing the same way
`harness sync` would and reads back whether the composition itself refused it.

Add `--json` to any command for the structured object instead of lines.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
