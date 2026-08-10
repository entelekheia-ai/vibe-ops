# AGENTS.md — cli/

An npm monorepo: the deterministic half of vibe-ops, runnable from a terminal or over MCP without the
Claude Code plugin installed. **The npm workspace root is the repository root**, one directory up, so
there is exactly one `node_modules` and every command below is run from there.

The repository-wide map is [`../AGENTS.md`](../AGENTS.md); the plugin is [`../plugin/`](../plugin/AGENTS.md).

## Layout

| Path | What is not obvious about it |
|---|---|
| [`packages/core/`](packages/core/) | `@entelekheia/vibe-ops-core` — the contract (`defineModule`, `defineGate`, `defineOps`), the `vibeops.config.ts` cascade, the eita emission seam, and (Plan-010 Track 1) the `DocumentModel`: a tree-sitter parse behind `GateRunContext.documents`, now (Track 2) recursed into its own injected layers — a fenced block, a frontmatter block, markdown's inline layer — via `src/injections.ts`. Depends on nothing else **in this workspace**, so it still builds first — but it now carries runtime dependencies, and they are **native**. `tree-sitter` ships prebuilt binaries for `darwin-arm64`, `darwin-x64`, `linux-x64` and `win32-x64`; **not** `linux-arm64`, which compiles from source at install time, so `npm install` can fail there where it previously could not. **Two grammar-manifest conventions coexist**, and `grammars.ts` reads both: markdown declares its grammars in a `"tree-sitter"` array inside its own `package.json`; yaml carries no such key there at all and ships a standalone `tree-sitter.json` instead, with the same fields under a `"grammars"` array. A third grammar needs to be checked against both before assuming either is universal. |
| [`packages/cli/`](packages/cli/) | `@entelekheia/vibe-ops-cli` — the `vibe-ops` binary, module dispatch, the **stateless** MCP server, and the `hook` surface (`src/hook.ts`) a skill-scoped `hooks:` block calls by name. Also the programmatic API a third-party module builds against. |
| [`packages/module-<id>/`](packages/) | One module, one package. `module-check` is the reference implementation. |
| [`packages/module-check/sh/`](packages/module-check/sh/) | The seventeen checks, still shell, owned by the module that runs them. `--list` shows what was composed; `--self-test` builds a deliberately broken fixture and asserts every check fires on it. |
| [`packages/gates/`](packages/gates/) | `@entelekheia/vibe-ops-gates` — detectors with no notion of scope, one folder per gate. Four ported from `module-check/sh/checks/`; `pairing` and `claude-md-content` are new, with no shell precedent. The rest stay shell until an ops composes them (RFC-0001). |
| [`packages/ops-agents-md/`](packages/ops-agents-md/) | `@entelekheia/vibe-ops-agents-md` — the first ops: composes seven `packages/gates/` entries over the instruction surface, five of them ports. Runs **beside** the shell fragments it ports, not instead of them, until the two are shown to agree. |
| [`test/`](test/) | The **plugin's** shell tests, not the CLI's — `measure-nudge-noise.sh` is the only instrument for what a hook cannot observe about itself: what the model did after it fired. Each package's own tests live in `packages/*/test/`. |

## The module contract

A module is a package that default-exports `defineModule(definition, run)`. The `definition` is read by
every surface — `--help`, flag parsing, and the MCP tool schema — so a module that describes itself
wrongly is wrong everywhere at once rather than in one surface nobody checks.

```ts
import { defineModule } from "@entelekheia/vibe-ops-core";

export default defineModule(
  { id: "thing", version: "0.0.1", summary: "One line, shown in --help and as the MCP description",
    flags: [{ name: "dry-run", type: "boolean", description: "…" }] },
  async (context) => ({ code: 0, summary: "what happened" }),
);
```

- **Discovery is convention plus dynamic `import()`. There is no registry file, deliberately** — a
  registry is a second place to forget, and a module missing from it looks broken rather than absent.
  A bare `check` resolves to `@entelekheia/vibe-ops-module-check`; a name starting with `@`, `.` or `/`
  is taken verbatim, which is what makes `vibe-ops @scope/pkg --flag` and a local path both work.
- **Adding a module = adding a package.** The only other places to touch are `BUILTINS` in
  [`packages/cli/src/bin.ts`](packages/cli/src/bin.ts) (help text and the MCP default set) and the
  layout table above. A third-party module needs neither.
- **A module never reaches for `process.argv`, `process.cwd()` or the repo layout.** Everything
  positional is resolved once, by the CLI, into the `ModuleContext` it is handed — which is why a module
  behaves identically under MCP and under a terminal.
- **Branch on `context.surface` before printing or prompting.** Under `mcp` there is no terminal, and
  writing to stdout corrupts the stdio transport. Use `context.log`, never `process.stdout`.
- **The report goes in `data`; `context.log` is the terminal's copy of it.** An MCP client renders
  `structuredContent` and **discards the text content** — measured against Claude Code 2.1.226, where
  `agents-md` returned `{failures:0}` and its findings never arrived. So `data` must stand alone, and
  a module logs only when `surface === "cli"`. Report arrays carry their own length: no `count`
  beside the array it summarises, and no "composed N" preamble.
- **`destructive: true`** makes the CLI confirm before running. Set it on anything not trivially undone.

## Gates and ops

A `check.sh` fragment fuses three things: what it detects, where it looks, and whether it records an
observation. [RFC-0001](../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) splits
them the way `eita` splits `trait` from `profile`. A **gate** (`defineGate`, `packages/gates/`) is a
pure detector — it does not know which repository it is in or whether anything downstream records what
it finds. An **ops** (`defineOps`, `packages/ops-<id>/`) is a named composition of gates over declared
paths, and it decides which of them emit — it *is* a module, so dispatch, MCP and config learn no
second concept.

- **The ops owns emission, never the gate.** Population (`--examined`) and moment are knowable only to
  the composition; a gate handed a file list cannot enforce "zero examined is not a reading"
  ([`plugin/references/harness-pair.md`](../plugin/references/harness-pair.md)).
- **The emitter is built by the ops, not injected.** `defineOps` calls `createEmitter` itself, from
  `context.config.artifactDir` — emission is doubly opt-in the same way a plain module's is, but the
  decision of *what* emits lives in the composition's own entries (`{ gate: "…", emits: true }`).
- **Overlapping ops double-count, deliberately.** Two ops running the same gate over intersecting paths
  record the same finding twice, because they are different signals — a signal's identity includes the
  population it was read over, carried in the `ops:<id>` tag on every observation.
- **A gate is resolved the same three ways a module is** (`packages/cli/src/resolve.ts`): a bare name
  under `@entelekheia/vibe-ops-gates/<name>`, a scoped package verbatim, or a path. No registry.
- **`<plugin>/` in a declared path** expands to wherever the target's plugin surface actually is —
  `plugin/` here, the root in a flat repo — via `resolvePluginDir`/`expandPluginToken` in
  `packages/core/src/files.ts`. Hardcoding one layout for the other makes a dogfooded pair unreachable
  in the other, which is exactly the bug the shell runner's `$PLUGIN_DIR` already exists to avoid.
- **A gate declares `fixable: true` and a `fix()` third argument to `defineGate` together, or neither.**
  `fix()` receives the findings `run()` just returned and repairs the mechanical ones — `pairing` creates
  a missing sibling `CLAUDE.md` but never edits one that exists without the import, because that is a
  judgement about someone else's content, not a mechanical repair.
- **`--file <path>` scopes an ops to one file instead of the tracked-file sweep**, and does not require
  the file to be tracked — a hook fires right after a write, before `git add`. **`--fix` repairs only
  what it names**: bare for every fixable gate in the composition, `--fix pairing` for one,
  `--fix a,b` for several; naming a gate the composition does not contain fails before anything runs.
  Every repaired finding is re-run to confirm, and the result reports `repaired` separately from
  `findings` still standing — a `--fix` that covered two of five gates says so, rather than a green line.
- **A `--file` run emits nothing**, even when the entry it scopes declares `emits: true`. A signal's
  identity includes the population it was read over (RFC-0001), and a per-write reading of one file is a
  different signal from a repository sweep — conflating them under the same id would make the series
  uninterpretable. A per-edit signal, if ever wanted, needs its own id.

## The hook surface

`vibe-ops hook <ops> [--fix <gates>]` ([`packages/cli/src/hook.ts`](packages/cli/src/hook.ts)) is what a
skill-scoped `PostToolUse` `hooks:` block names as its `command` — no shipped script, because the CLI
reads the payload and answers in the hook's own protocol itself. `Surface` (`packages/core/src/context.ts`)
has a third value, `"hook"`, alongside `"cli"` and `"mcp"`; a module prints only under `"cli"`, so under
`"hook"` nothing reaches stdout except the one line this verb itself writes.

- **Reads `tool_input.file_path` off stdin**, exits silently (no output, exit 0) unless its basename is
  `AGENTS.md` or `CLAUDE.md`, then runs `<ops> --file <that path>` with the caller's own flags.
- **Silence is the default outcome.** Repairing nothing and finding nothing produces no output at all —
  the same "silent unless its exact condition holds" discipline every hook in `plugin/hooks/` follows.
- **Always exits 0.** This is an advisory surface, never a blocking one; a finding it cannot fix is
  reported in `additionalContext`, not enforced by exit code.
- **A malformed payload or an unresolvable ops fails silent, not open-while-appearing-to-work**
  (ADR-0009 obligation 3) — the sensor for a broken *registration* is `25-hooks-registration.sh`, not
  this process's exit code.
- **Both sides of `--file`'s path comparison are realpath-ed** (`toRepoRelative` in `ops.ts`) — a hook
  payload's path is Claude Code's own bookkeeping, unresolved, and `repoRoot` came from
  `git rev-parse --show-toplevel`, which resolves symlinks. macOS resolving `/tmp` through `/private/tmp`
  is what caught this live: resolving only one side scoped every gate to an empty population.

## Configuration

`vibeops.config.ts` is searched from the repository root **upward to the home directory** — the same
cascade a linter uses, for the same reason: the per-repo file holds what is true of that repo, the home
file holds the operator's preferences, and neither should restate the other. Nearest wins per key;
`settings` merges one level deep so a repo overriding one module's settings does not discard the home
file's settings for every other module.

`.ts` is loaded by dynamic `import()` and relies on Node's native type stripping (**≥22.18**), so a
config file costs no dependency and no build step. `.mjs` and `.js` work identically.

## The eita seam

A module that observes something worth recording declares `emits`; everything else has no emitter and
cannot record by accident. **Emission is doubly opt-in** — the module declares `emits` *and* the config
names an `artifactDir`. Either alone produces no emitter, so nothing is ever written somewhere nobody
chose.

eita's doctrine holds unmodified: a producer records **what was observed** and never scores, ranks or
grades. There is deliberately no `severity`, `pass` or `score` field, and a test asserts none appears —
thresholds belong to the consuming product. Emitting an id the module does not declare **throws**, so
the definition and the code cannot silently disagree.

## Working here

```bash
npm install            # from the repository root — one node_modules for the whole tree
npm run build          # core first, explicitly (see below)
npm run typecheck
npm test               # builds first via pretest
node cli/packages/cli/dist/bin.js check
```

- **`npm run build` builds `core` explicitly before `--workspaces`.** Workspaces build in *directory*
  order, not dependency order, so `cli` sorts ahead of `core` and would typecheck against its stale
  `dist/` and report success. That produced a false green three times in eita before the line existed.
- **The checks are shell and stay shell.** Porting seventeen fragments to TypeScript is a separate act;
  doing it as part of packaging would have shipped seventeen freshly-written checks with no history of
  having caught anything. `packages/module-check/src/index.ts` is their front door, not a rewrite.
- **A fragment gets `$ROOT` and `$PLUGIN_DIR`, and they are not the same.** `$ROOT` is the repository
  being checked; `$PLUGIN_DIR` is where its plugin surface lives — `plugin/` here, the root in a repo
  laid out flat. Hardcoding one for the other made every dogfooding pair unreachable in a flat repo,
  which is exactly where the self-test fixture caught it.
- **`sh/` ships in the package's `files`**, so the fragments travel with an install and are resolved
  relative to the module — never from `PATH`, never by searching upward for a checkout.
- **`npm link -w @entelekheia/vibe-ops-cli` puts `vibe-ops` on PATH**, resolving its unpublished internal
  dependencies from this workspace's own `node_modules` rather than a registry. Needed to exercise the
  `hook` surface as a skill actually calls it — `cli/README.md` has the full recipe.

## Keeping this file current

Triggers: a package is added or renamed; the module contract gains or loses a field; the config cascade
changes; the build order changes; a fragment starts needing something `$ROOT`/`$PLUGIN_DIR` does not
give it. Adjust the one affected line and point at the source rather than restating it.
