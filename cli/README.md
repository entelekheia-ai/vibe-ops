# vibe-ops CLI

**The deterministic half of [vibe-ops](../README.md), without the plugin.** The Claude Code plugin steers
an agent; this runs the checks and operations that either pass or fail — from a terminal, from CI, or as
MCP tools.

## Install

Not published to a registry yet. From a clone of this repository:

```bash
npm install          # from the repository root — one node_modules for the whole tree
npm run build
node cli/packages/cli/dist/bin.js check
```

To get `vibe-ops` as a command on PATH — the plugin's skill-scoped hooks call it by name, not by path —
link the workspace instead of installing from a registry:

```bash
npm link -w @entelekheia/vibe-ops-cli   # from the repository root, after npm install && npm run build
vibe-ops check
```

`npm link` resolves the three internal `@entelekheia/vibe-ops-*` dependencies from this workspace's own
`node_modules` rather than a registry, so it works even though nothing here is published. Rebuilding
(`npm run build`) is picked up by the next invocation — each run of the command is a fresh process, so
there is no server to restart.

## Usage

```bash
vibe-ops check                  # every check against the repository you are standing in
vibe-ops check --list           # what would run, and the file each check comes from
vibe-ops check --self-test      # assert the checks still fire on a deliberately broken fixture
vibe-ops check --verbose        # the full run, not only what failed

vibe-ops agents-md               # the first ops — runs beside `check`, not instead of it (RFC-0001)
vibe-ops agents-md --list        # the gates composed, and the paths each runs over
vibe-ops agents-md --audit       # the same report, always exit 0
vibe-ops agents-md --file AGENTS.md         # scope to one file — does not need to be tracked
vibe-ops agents-md --fix pairing            # repair only what "pairing" can fix; bare --fix repairs all

vibe-ops governance              # the second ops — adr/plan/rfc/task header tables, links, breadcrumbs
vibe-ops governance --list       # the gates composed, and the paths each runs over
vibe-ops governance --verbose    # the full run, not only what failed

# The governance nouns. These ACT on one record's lifecycle; the ops above only detect.
vibe-ops plan resolve            # where plans live, the next number, the status chain, the living sections
vibe-ops plan status             # every plan whose Status disagrees with its own track boxes
vibe-ops plan context            # the plan-mode guidance, built from the template's own markers
vibe-ops plan close <plan>       # terminal status, then move to shipped/ keeping the number

vibe-ops task resolve            # the same block, plus the GitHub remote and auth
vibe-ops task guard <dossier>…   # which of these still have an unchecked closure box
vibe-ops task close <dossier>…   # the ordering-sensitive tail of closure; --dry-run previews it

vibe-ops log lint                # name matches filename, kind is trap|debt, no status, a real date
vibe-ops log sweep               # entries whose path: no longer resolves — candidates, never deletions
vibe-ops log index               # regenerate the index from the entries; --check reports drift instead

vibe-ops records resolve --type adr|rfc  # the layout block for a record type with no noun of its own
vibe-ops records list --type plan        # the shipped types here — nothing on a noun answers this
vibe-ops records resolve --type policy   # a type YOU declared, or an installed package did

vibe-ops @scope/pkg --flag      # a third-party module, by package name
vibe-ops ./path/to/module       # a module you are developing

vibe-ops mcp                    # every module as MCP tools, over stdio
vibe-ops mcp --http --port 7337 # the same, over stateless streamable HTTP

vibe-ops hook ops agents-md --fix pairing       # a PostToolUse hook's own command — reads its payload on
                                             # stdin, answers on stdout, silent unless there's something
                                             # to say. What a skill's `hooks:` block names directly.
```

A clean run prints one summary line. The expensive reader is an agent, not a terminal, and seventeen `ok`
lines say nothing the summary does not.

## Configuration

`vibeops.config.ts` is searched from the repository root **upward to your home directory**, so per-repo
facts and personal preferences each have a home and neither restates the other. Nearest wins per key.

```ts
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export default {
  modules: ["check", "agents-md", "governance"],  // which modules `vibe-ops mcp` exposes
  artifactDir: ".git/gate-artifacts",             // absent disables observation recording entirely
  settings: {},                                   // per-ops, keyed by ops id
} satisfies VibeOpsConfig;
```

`.ts` needs no loader and no build step — Node strips the types natively (**≥22.18**). `.mjs` and `.js`
work the same way.

### `ignore` and `disabled` — the population contract, for an ops

Two keys any ops's own `settings` slice may carry, typed and honored by `defineOps` itself — never
inside a gate. `ignore` changes **what was read**; a gate's own `options` change **how it judges**, and
stay free-form because only the gate can validate them. Mixing the two into one gate-internal filter is
exactly the divergence this contract replaced: `**/templates/**` used to be excluded three different
ways (the shell runner's own file listing, a hardcoded check inside one gate, and not at all inside
another), and the third case alone was 13 false findings the day it was measured.

```ts
settings: {
  governance: {
    // "*" applies to every entry in this ops; a gate's own label narrows further, additively.
    ignore: { "*": ["**/templates/**"] },
    // A reason, never a boolean — a disablement is a ledger entry, not a silent pass. Reports
    // SKIP naming the reason, and is visible only under --verbose, same as any other SKIP.
    disabled: { "record-header-rfc": "rfc records still migrating to the new header shape" },
  },
},
```

A run also reports `ignored` beside `examined` — a population that shrank in silence would be
indistinguishable from a clean run, and only one of the two is a reading.

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
| [`@entelekheia/vibe-ops-cli`](packages/cli/) | The `vibe-ops` binary, dispatch, the MCP server, and the `hook` surface a skill's `hooks:` block calls by name |
| [`@entelekheia/vibe-ops-module-check`](packages/module-check/) | The governance gate — seventeen shell fragments |
| [`@entelekheia/vibe-ops-gates`](packages/gates/) | Detectors with no notion of scope, one per gate — what an ops composes |
| [`@entelekheia/vibe-ops-agents-md`](packages/ops-agents-md/) | The first ops: the instruction surface, composed from `vibe-ops-gates` |
| [`@entelekheia/vibe-ops-governance`](packages/ops-governance/) | The second ops: adr/plan/rfc/task header tables, links, and archival breadcrumbs |
| [`@entelekheia/vibe-ops-self`](packages/ops-self/) | The third ops: the prose describing this repository's own machinery, which `governance` excludes |
| [`@entelekheia/governance-base`](packages/governance-base/) | The reusable governance components the noun modules share — layout, numbering, lifecycles, closure, the `defineGovernance` sugar |
| [`@entelekheia/governance-plan`](packages/governance-plan/) · [`-task`](packages/governance-task/) · [`-log`](packages/governance-log/) · [`-adr`](packages/governance-adr/) · [`-rfc`](packages/governance-rfc/) | One artifact, one governance package (ADR-0019): the type's data and its verbs together; adr and rfc are pure sugar |
| [`@entelekheia/vibe-ops-module-records`](packages/module-records/) | The cross-type verbs — census, handling, show, list, and `norm`, the facet the plugin skills read |
| [`@entelekheia/vibe-ops-module-harness`](packages/module-harness/) | What a repository's harness is, and promulgating the norm into it |

Working on them: [`AGENTS.md`](AGENTS.md).
