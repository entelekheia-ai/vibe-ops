# vibe-ops CLI

**The deterministic half of [vibe-ops](../README.md), without the plugin.** The Claude Code plugin steers
an agent; this runs the checks and operations that either pass or fail — from a terminal, from CI, or as
MCP tools.

## Install

Not published yet. From a clone of this repository:

```bash
npm install          # from the repository root — one node_modules for the whole tree
npm run build
node cli/packages/cli/dist/bin.js check
```

## Usage

```bash
vibe-ops check                  # every check against the repository you are standing in
vibe-ops check --list           # what would run, and the file each check comes from
vibe-ops check --self-test      # assert the checks still fire on a deliberately broken fixture
vibe-ops check --verbose        # the full run, not only what failed

vibe-ops @scope/pkg --flag      # a third-party module, by package name
vibe-ops ./path/to/module       # a module you are developing

vibe-ops mcp                    # every module as MCP tools, over stdio
vibe-ops mcp --http --port 7337 # the same, over stateless streamable HTTP
```

A clean run prints one summary line. The expensive reader is an agent, not a terminal, and seventeen `ok`
lines say nothing the summary does not.

## Configuration

`vibeops.config.ts` is searched from the repository root **upward to your home directory**, so per-repo
facts and personal preferences each have a home and neither restates the other. Nearest wins per key.

```ts
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export default {
  modules: ["check"],                  // which modules `vibe-ops mcp` exposes
  artifactDir: ".git/gate-artifacts",  // absent disables observation recording entirely
  settings: {},                        // per-module, keyed by module id
} satisfies VibeOpsConfig;
```

`.ts` needs no loader and no build step — Node strips the types natively (**≥22.18**). `.mjs` and `.js`
work the same way.

## Writing a module

A module is a package that default-exports `defineModule`. There is **no registry to add it to**: a bare
name resolves to `@entelekheia/vibe-ops-module-<name>`, and a scoped name or a path is taken verbatim, so
a third-party package is invoked as itself.

```ts
import { defineModule } from "@entelekheia/vibe-ops-core";

export default defineModule(
  {
    id: "thing",
    version: "0.1.0",
    summary: "One line — this becomes the --help text and the MCP tool description",
    flags: [{ name: "dry-run", type: "boolean", description: "Report without writing" }],
  },
  async (context) => {
    context.log(`acting on ${context.repoRoot}`);
    return { code: 0, summary: "nothing to do" };
  },
);
```

The `definition` is the single source for help, flag parsing **and** the MCP schema, so there is nothing
to declare twice. `context` carries the repo root, parsed flags, the resolved config and this module's own
slice of `settings` — a module never reads `process.argv` or `process.cwd()` itself, which is why it
behaves identically under MCP and under a terminal.

## Packages

| Package | What it is |
|---|---|
| [`@entelekheia/vibe-ops-core`](packages/core/) | The contract, the config cascade, the observation emitter |
| [`@entelekheia/vibe-ops-cli`](packages/cli/) | The `vibe-ops` binary, dispatch, and the MCP server |
| [`@entelekheia/vibe-ops-module-check`](packages/module-check/) | The governance gate |

Working on them: [`AGENTS.md`](AGENTS.md).
