---
"@entelekheia/vibe-ops-core": minor
"@entelekheia/governance-base": minor
"@entelekheia/governance-adr": minor
"@entelekheia/governance-classification": minor
"@entelekheia/governance-license": minor
"@entelekheia/governance-log": minor
"@entelekheia/governance-plan": minor
"@entelekheia/governance-rfc": minor
"@entelekheia/governance-task": minor
"@entelekheia/vibe-ops-gates": minor
"@entelekheia/vibe-ops-agents-md": minor
"@entelekheia/vibe-ops-governance": minor
"@entelekheia/vibe-ops-for-vibe-ops": minor
"@entelekheia/vibe-ops-module-check": minor
"@entelekheia/vibe-ops-harness": minor
"@entelekheia/vibe-ops-module-records": minor
"@entelekheia/vibe-ops-cli": minor
"@entelekheia/vibe-ops-exposure": minor
"@entelekheia/vibe-ops-mirror": minor
"@entelekheia/vibe-ops-module-config": minor
"@entelekheia/vibe-ops-module-ownership": minor
---

The first published version of every `vibe-ops` package.

Until now the CLI reached its consumers as a git clone of the plugin, which meant `vibe-ops check` ran
from whatever tree the clone happened to be pinned to. These packages make the deterministic half
installable on its own: a repository's commit gate resolves `vibe-ops` from `PATH` and composes the ops
its `vibeops.config` activates, with no copy of anything checked into it.

The layout the version numbers describe: `vibe-ops-core` is the module contract every other package
implements, `governance-*` carries one artifact type each (activated per repository, and writable by
anyone — which is why these packages are versioned independently rather than as a locked group),
`vibe-ops-gates` and the `ops-*` packages hold the checks, and `vibe-ops-cli` is the binary.

Also in this release: `vibe-ops-harness` no longer declares `@entelekheia/vibe-ops-module-records` as a
dependency. It only ever reached that package through a dynamic load by name, and declaring it closed a
dependency cycle that npm workspaces resolve by symlink and a registry cannot. The edge now sits on
`vibe-ops-cli`, which is what assembles an install.
