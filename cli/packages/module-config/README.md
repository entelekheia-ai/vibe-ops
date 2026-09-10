# @entelekheia/vibe-ops-module-config

**The effective value of a `vibeops.config` key, the file that decided it, and every value it shadows.**
A vibe-ops module: the `config` noun on the `vibe-ops` CLI, and the same verbs as MCP tools.

## Why

`vibeops.config.{ts,mjs,js,json}` is searched from a repository upward to the home directory, in three
layers per directory — local, declared and managed — and the nearest file wins per key. That cascade is
useful and, without a reader, opaque: a key's value can come from any of a dozen files, and the ones it
shadows are invisible. This module reads the cascade `@entelekheia/vibe-ops-core` already builds and
answers "why is this key set to this" without asking anyone to trace the search order by hand.

It also owns the one write these skills need. Every other writable key already has its own verb —
`vibe-ops ownership set`, `vibe-ops harness sync` — so this module refuses a key it does not own by name,
rather than writing wherever it is pointed.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

## Usage

```
$ vibe-ops config get artifactDir
artifactDir = ".git/gate-artifacts"
origin: declared:/Users/danilo/Development/entelekheia/vibe-ops/vibeops.config.ts
```

```bash
vibe-ops config get <dotted.key>              # effective value, origin, and what it shadows
vibe-ops config list                          # every effective key
vibe-ops config list --show-origin            # plus the file behind each one, and leftover files
vibe-ops config set types.<name> <package>    # bind a record type to a package, in the managed layer
vibe-ops config unset types.<name>            # remove that binding
```

`set`/`unset` write only `types.<name>` into the managed layer (`vibeops.config.json`). A key outside that
shape — `types.style`, which is a stack of layers rather than one package name, or a key another verb
already owns — is refused with the verb that does own it, not silently accepted.

Add `--json` to any command for the structured object instead of `KEY=value` lines.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
