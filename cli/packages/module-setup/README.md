# @entelekheia/vibe-ops-module-setup

**The scaffold: what every activated governance package contributes to a repository, planned or
written.** A vibe-ops module: the `setup` noun on the `vibe-ops` CLI, and the same verbs as MCP tools.

## Why

A repository's baseline — `AGENTS.md`, the `project/` governance skeleton, per-type templates, the
`.agents`/`.claude` bridge, license files — is not one template directory bundled with this package. It is
a composition: every governance type a repository activates (through `vibeops.config`) contributes its own
files, and this module assembles what they contribute into one scaffold. `plan` answers the same question
`scaffold` acts on, from the same code path — a dry run implemented separately would be a second
implementation that could drift about exactly the thing that matters: what gets written into somebody's
repository.

`scaffold` never overwrites a destination it did not create. Anything already there was put there by
someone, so every existing file is skipped and reported unless `--force <path>` names it explicitly. That
is a different question from what `vibe-ops ownership` governs — ownership decides what a later
*promulgation* (`harness sync`) may touch; `setup` is the first write into a repository, where the honest
default is that nothing is empty by accident.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

## Usage

```
$ vibe-ops setup plan .
project/adr/
project/rfc/
...
project/templates/adr.md  ← @entelekheia/governance-adr
AGENTS.md  ← @entelekheia/governance-base
README.md  ← @entelekheia/governance-base
...
warning: unanswered placeholders: REPO_NAME, ONE_LINE_DESCRIPTION, PKG_NAME, ...
29 file(s) from 10 source(s), 7 directory(ies)
```

```bash
vibe-ops setup plan <repo>                       # every file a scaffold would write, and which package it comes from
vibe-ops setup scaffold <repo> [NAME=value ...]  # write it, filling {{NAME}} placeholders from the given values
vibe-ops setup scaffold <repo> --force a.md,b.md # overwrite these specific existing destinations
vibe-ops setup scaffold <repo> --shape workspace # write only the files bound to this repository shape
```

A placeholder nobody answered is left standing (`{{PKG_NAME}}`), visible and greppable, rather than
emptied — an empty string where a name belongs is a file that looks finished and is not. `scaffold` exits
non-zero when anything was refused, even though every other file landed, so a partial run is never read as
a complete one.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
