# AGENTS.md — cli/

An npm monorepo: the deterministic half of vibe-ops, runnable from a terminal or over MCP without the
Claude Code plugin installed. **The npm workspace root is the repository root**, one directory up, so
there is exactly one `node_modules` and every command below is run from there.

The repository-wide map is [`../AGENTS.md`](../AGENTS.md); the plugin is [`../plugin/`](../plugin/AGENTS.md).

## Layout

| Path | What is not obvious about it |
|---|---|
| [`packages/core/`](packages/core/) | `@entelekheia/vibe-ops-core` — the contract, the config cascade, the eita seam, and the tree-sitter document model behind `GateRunContext.documents`. **How to read a document is [its own README](packages/core/README.md)**, not restated here: the block-vs-inline split, `lineAt` over `startPosition.row`, and what `uncovered` obliges. Depends on nothing else **in this workspace**, so it builds first — but its runtime dependencies are **native**: `tree-sitter` ships prebuilt binaries for `darwin-arm64`, `darwin-x64`, `linux-x64` and `win32-x64`, **not** `linux-arm64`, which compiles from source, so `npm install` can fail there where it previously could not. **Two grammar-manifest conventions coexist** and `grammars.ts` reads both — markdown declares grammars in a `"tree-sitter"` array in its own `package.json`; yaml has no such key and ships a standalone `tree-sitter.json` with the same fields under `"grammars"`. Check a third grammar against both before assuming either is universal. |
| [`packages/cli/`](packages/cli/) | `@entelekheia/vibe-ops-cli` — the `vibe-ops` binary, module dispatch, the **stateless** MCP server, and the `hook` surface (`src/hook.ts`) a skill-scoped `hooks:` block calls by name. Also the programmatic API a third-party module builds against. |
| [`packages/module-<id>/`](packages/) | One module, one package. `module-check` is the reference implementation. `module-plan`, `module-task` and `module-log` are the three governance **nouns** (Plan-011); `module-records` answers for `adr`/`rfc`, the two record types with no noun of their own. `module-harness` is the first module declaring `needsSource`, so it reads the installed norm at `context.sourceRoot` as well as the repository it acts on. Five of its six verbs read — `resolve`/`shape`/`status`/`catalog`/`audit`; **`sync` is the only thing here that writes into another repository**, and it does so on a linked working tree so the target's checkout is never touched, stopping at a branch and a tag it neither merges nor pushes. What it may overwrite is `plugin/ownership.json`, read through `src/ownership.ts` — **a path with no entry there is not permission**, and the run stops. |
| [`packages/records/`](packages/records/) | `@entelekheia/vibe-ops-records` — the governance record library the nouns share: where records live, the next number, a plan's status chain and living sections, the closure box, filing and closing, and (`shape.ts`) a record's own shape — its headings and how many entries stand under a named section, which is what `records show` projects. `entriesUnder` returns **`undefined` for an absent section and `0` for an empty one**; collapsing the two is the defect the verb exists to remove. **Action, never detection** — it mutates and resolves destinations, which is exactly what a gate may not do. It is also a second foundation package: it sorts after every `module-*` that depends on it, so `npm run build` builds it explicitly, like `core`. |
| [`packages/module-check/sh/`](packages/module-check/sh/) | The seventeen checks, still shell, owned by the module that runs them. `--list` shows what was composed; `--self-test` builds a deliberately broken fixture and asserts every check fires on it. The script stays **Node-free and standalone** — `vibe-ops check --self-test` chains it with each ops's own `--self-test` above it, so one command proves every detector still fires without the runner ever needing a build. |
| [`packages/gates/`](packages/gates/) | `@entelekheia/vibe-ops-gates` — detectors with no notion of scope, one folder per gate; seventeen of them. Nine read the document model rather than the file, and how to do that is [core's README](packages/core/README.md); only `budget` (counts lines), `bridge` (reads `git ls-files -s` for the symlink mode bit) and `fragment-parity` (holds no repository knowledge at all, see below) do not. Five have shell precedent under `module-check/sh/checks/` — `budget`, `bridge`, `check-frontmatter`, `memory-slug`, `markdown-link`; `pairing`, `claude-md-content`, `breadcrumb`, `record-header`, `template-version`, `template-heading-drift`, `fragment-parity`, `disabled-declared`, `runner-provenance`, `unstated-destination`, `type-index-drift` and `record-frontmatter` have none. Two are worth knowing before composing them: **`record-header`** and its frontmatter-carrier sibling **`record-frontmatter`** each take `options.type` and `options.required` and throw without them, so one entry per record type — the type name and its field list are DATA, from that type's own `types/<t>/type.json` (Plan-030 Track 2), and neither gate holds a list of the types this repository ships. Which of the two a type gets is its manifest's `schema.carrier`: `table` or `frontmatter`. `record-header`'s header-table reader is shared with `packages/records/`, not duplicated; **`fragment-parity`** takes `{runner, fragment, against, options?}` and reports only what a shell fragment caught that its port missed (`port-regression`) — the comparison RFC-0001 requires before a fragment is removed; `options` forwards to the gate under test, needed because `check-frontmatter` cannot be compared under its `skill` schema without it (Plan-013). The remaining eleven fragments stay shell until an ops composes them. |
| [`packages/ops-agents-md/`](packages/ops-agents-md/) | `@entelekheia/vibe-ops-agents-md` — the first ops: composes eight `packages/gates/` entries over the instruction surface, five of them ports. The eighth, `agent-frontmatter`, has no shell precedent and gets no `fragment-parity` entry — parity compares a gate against the fragment it replaces, and this one replaces nothing. Runs **beside** the shell fragments it ports, not instead of them, until the two are shown to agree. |
| [`packages/ops-governance/`](packages/ops-governance/) | `@entelekheia/vibe-ops-governance` — the second ops: four `record-header` entries, one `record-frontmatter` entry (`log`, whose fields are frontmatter rather than a header table) and six `template-version` ones, `markdown-link`, `breadcrumb`, and `fragment-parity` comparing `20-links.sh` against `markdown-link`. Every entry is scoped to a record directory; the one that was not now lives in `ops-self` below. |
| [`packages/ops-self/`](packages/ops-self/) | `@entelekheia/vibe-ops-self` — the third ops, and the one whose population is the near-complement of `governance`'s: not the records, but the prose describing this repository's own machinery. It exists separately for a measured reason — `governance` excludes `**/templates/**` from every entry through one `"*"` line, which is a **safe default** a new gate inherits without thinking, and `template-heading-drift` is the one gate for which those shipped copies are the subject rather than noise. Composing both under `governance` cost that default. Its subject is this repository's claims about its own machinery, which is **not only prose**: `type-index-drift` compares the generated `types/index.json` against the type units it is built from, and is the ops's first `fixable` entry — `--fix type-index-drift` regenerates it. |
| [`test/`](test/) | The **plugin's** shell tests, not the CLI's — `measure-nudge-noise.sh` is the only instrument for what a hook cannot observe about itself: what the model did after it fired. Each package's own tests live in `packages/*/test/`. |

## The module contract

A module is a package that default-exports `defineModule(definition, run)`. The `definition` is read by
every surface — `--help`, flag parsing, and the MCP tool schema — so a module that describes itself
wrongly is wrong everywhere at once rather than in one surface nobody checks.

**A module may declare `commands`, which makes it a noun with verbs** (`vibe-ops plan status`). The verb
is `argv[0]` from a terminal and the `command` field over MCP, and it is validated **in `runModule`** —
not in `bin.ts` — because that is the one place both surfaces pass through. The same is true of
`destructive`: the terminal confirms with a TTY prompt, MCP requires an explicit `confirm: true`, and
neither may skip the gate by being the surface it is.

**And of flags**, which was the sentence's aspiration and is now its behaviour. A verb's own `flags` merge
with the module's and are valid for that verb only; `runModule` refuses anything else, naming the sibling
verb that owns it, and enforces `required`. One list serves all three surfaces — `declaredFlagsFor` in
[`packages/cli/src/run.ts`](packages/cli/src/run.ts), read by the terminal's parser, by that refusal, and
by the MCP schema. Until Plan-027 Track 2 there was no refusal at all on the MCP path: an inapplicable
flag was accepted, ignored and reported as success, which the tool's own schema invited by advertising
every verb's flags for every verb. **A `choices` domain reaching the MCP schema is the union across every
verb declaring that flag**, never one verb's — one static shape per tool cannot scope a domain, and
publishing the narrower one makes a valid sibling call unconstructible. The same holds for `required`,
which reaches the schema only when it is module-wide.

**Positional arguments reach every surface.** `vibe-ops task close <dossier>…` is `args` in the MCP input
schema too; a verb reachable from a terminal and from nowhere else is a bug, and there is a test per track
asserting it is not (`packages/cli/test/mcp-nouns.test.ts`).

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
- **`repoFromFirstArg: true`** makes the CLI resolve `repoRoot` from the module's first positional
  instead of from the working directory, and **consume it** so the module never sees it. Only for a
  module whose subject *is* a repository — `check` sets it; `task close <dossier>…` must not, or a file
  path would be read as a repository. It exists because a module may not touch `process.cwd()`, so a
  relative `.` or `../other` is unresolvable inside one: `vibe-ops check .` was accepting an argument it
  silently ignored and keying off the working directory, which was right for `.` by accident and wrong
  for every other value.

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
  **`options` is expanded too, by the same ops** (`expandOptionTokens`), so a path there is no longer a
  different kind of string — the asymmetry this paragraph used to describe in prose is gone rather than
  documented. A gate that expands `<plugin>/` itself keeps working: the second pass finds no token.
- **`<records:<type>>` resolves to where that type's records actually live** — declared `records.dirs`,
  else the first existing candidate, else the first candidate. A type the map does not name (`log`,
  `research`, one a repository brings) gets the generic `project/<type>` convention, which is what makes a
  custom type resolvable without the map growing an entry. A **declared** directory is used even when it
  does not exist: the entry then examines zero files against the path the repository named, which is
  attributable, where a quiet fallback elsewhere is not.
- **`<template:<type>>` in `options` resolves to where that type's template actually is** — the
  repository's `records.templates`, else the first existing candidate (`project/templates/`, `templates/`,
  `.agents/templates/`), else the plugin surface, which is what a repository whose templates *are* its
  distributable needs. `<plugin>/templates/…`
  was the literal before, and in a flat repo it resolved to the repository root — a path `setup repo`
  never writes, so `template-version` was inert in **every** repository this tooling scaffolds and said
  `SKIP`. The search order has one copy, in core; `packages/records/` builds its candidate map from it.
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

`vibe-ops hook <surface>` ([`packages/cli/src/hook.ts`](packages/cli/src/hook.ts)) is the **one namespace
for every entry point that reads a hook payload on stdin** — `ops <ops> [--fix <gates>]` (PostToolUse, an
ops over the file just written), `plan-context` (UserPromptSubmit), `new-context` (UserPromptExpansion),
`harness-status` (SessionStart).
They are not variations on one hook: the payload field, the guard and the `hookEventName` in the reply
differ in each; what they share is the envelope, and that is what the namespace names. **`ops` is a
reserved first word**, so an arbitrary ops name can never shadow a surface, nor a new surface someone's
ops. The rest of this section is about the `ops` surface specifically, and it is what a
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

**Each directory holds three files, layered, not one.** `vibeops.config.*` is committed;
`vibeops.config.local.*` is the operator's, clone-local and gitignored; **`vibeops.config.local.json` is
the machine's** — the only config file this tooling itself writes, where `harness sync` records what it
promulgated, and parsed rather than imported. All three contribute, nearest first, so a committed config
ships fully populated while a clone overrides only what is true of that machine. The trio
repeats at every level, which is what gives the home directory the personal-override file this section
used to describe with no mechanism behind it. **The directory walk still outranks the trio** — a nearer
committed file beats a farther local one, asserted by a test because inverting it yields a cascade that
still looks correct while a stale home file governs every repository. `loadOne()` therefore returns every
match in a directory rather than the first, which is the thing to preserve if it is ever refactored:
returning the first makes a local file *replace* the committed one it exists to layer over
([ADR-0014](../project/adr/0014-clone-local-configuration-layers-rather-than-replaces.md)).

**The state file is a third layer, not a fourth name in the local half**, and that is not a filing
preference: within a half the first match wins, so a clone holding both it and a `vibeops.config.local.ts`
would silently lose one of them — the machine's state or the operator's overrides, depending on the order
chosen, with no error either way.

`harness.applied` lives there — which version of each record type was **promulgated** into this clone, not
what any artifact was written against, which is that artifact's own frontmatter. Absence is a state and is
never zero, and unlike `settings` **the map** merges nearest-wins whole: a half-inherited one would answer
for a repository it was never applied to. `harness.boundary` and `harness.source` beside it layer per key
like everything else — the whole-key rule was written when `applied` was the only entry, and keeping it
there would have had the machine's state file discard an operator's declared `source`.

`.ts` is loaded by dynamic `import()` and relies on Node's native type stripping (**≥22.18**), so a
config file costs no dependency and no build step. `.mjs` and `.js` work identically.

**An ops's own settings slice may carry `ignore`, `disabled` and `level`, typed and honored by
`defineOps` itself — never inside a gate.** They are the repository's half of the split RFC-0001 draws
between a gate (a pure detector) and an ops (a named composition): `ignore` and `disabled` change
**what was read** and `level` changes **whether a finding blocks**, none of which a detector may decide;
a gate's own `options` (`schema`, `fragment`, `against`, …) change **how a gate judges**, and stay
free-form, validated by the gate. A gate must never filter its own population by a repository-specific
rule — that was `memory-slug`'s hardcoded `/templates/` check, one of three divergent copies of the same
exclusion (task 004), and a fourth copy inside a different gate would have matched the pattern rather
than fixed it.

**`level` is the same argument applied to the verdict.** `GateFinding.level` is stripped before anything
reaches the emitter, because a producer that records a verdict has already done the consuming product's
job — so whether a rule blocks belongs to the repository too. A gate still declares a level and that is
the **default**; config keyed by a finding's `rule`, an entry's `label`, or `"*"` overrides it, **most
specific wins** (unlike `ignore`, which is additive). Without it a gate hardcoding `warn` is unfixable
from outside: `template-version-behind` warns because a template bump leaves every record behind at
once, which is right mid-migration and wrong for a repository that has finished one.

```ts
settings: {
  governance: {
    ignore: { "*": ["**/templates/**"] },              // every entry in this ops
    disabled: { "record-header-rfc": "still migrating" }, // a reason, never a boolean
    level: { "template-version-behind": "fail" },      // by rule, label, or "*"; most specific wins
  },
  check: { disabled: { "machine-paths": "the private layer" } }, // the shell runner, same spelling
},
```

**`check` honors `disabled` under the same key and the same shape**, translating it into the
`VIBE_OPS_DISABLED_CHECKS` the shell runner already read — appended after whatever the environment
carries, so an invocation-time override still wins. A repository whose only declaration was that variable
had a different configuration per caller: the same gate run from a hook or from a sibling directory
reported its whole declared backlog as failures, 38 of them, measured 2026-08-14.

`"*"` applies to every entry in the ops; a gate's own label narrows further, additively with `"*"`,
never replacing it. `disabled` takes a reason string — never a boolean — so a disablement is a ledger
entry rather than a silent pass, and the disabled gate reports `SKIP` naming the reason instead of
running at all. A run also reports `ignored` beside `examined`: a population that shrank in silence is
indistinguishable from a clean run, and only one of the two is a reading. `SKIP` (like `ok`) prints only
under `--verbose` — silence is the default outcome for a clean or disabled entry, matching `check.sh`.

## The eita seam

A module that observes something worth recording declares `emits`; everything else has no emitter and
cannot record by accident. **Emission is doubly opt-in** — the module declares `emits` *and* the config
names an `artifactDir`. Either alone produces no emitter, so nothing is ever written somewhere nobody
chose.

eita's doctrine holds unmodified: a producer records **what was observed** and never scores, ranks or
grades. There is deliberately no `severity`, `pass` or `score` field, and a test asserts none appears —
thresholds belong to the consuming product. Emitting an id the module does not declare **throws**, so
the definition and the code cannot silently disagree.

**An emitter throws for two unrelated reasons and they are told apart, because they mean opposite
things.** An undeclared id (`UndeclaredObservationError`) is this repository's own composition
disagreeing with its own definition and stays **fatal** — no target may declare it away. A failure to
*write* is the destination, not the reading: it becomes an `emit-failed` finding, default **`warn`**,
levelable like any other through `settings.<ops>.level`. Until they were separated, an unwritable
`artifactDir` aborted the whole ops, so a sensor that could not record refused a commit whose content was
clean — which is how a `harness sync` into a linked working tree read as the *target's* gate rejecting
the promulgation. The objection to not blocking is that a reading goes missing in silence; a named
finding in the run's output and in `data` answers the silence, not the blocking.

**An `artifactDir` declared under `.git/` is resolved through `git rev-parse --git-common-dir`**
(`resolveArtifactDir`, `packages/core/src/files.ts`), never through the working tree. In a linked working
tree `.git` is a *file*, so the plain resolve produces a path under a file and `mkdir` raises `ENOTDIR`.
The common dir is `.git` in an ordinary checkout, so this **moves no existing artifacts**, and it is the
better answer anyway: every working tree of one clone accumulates where a drain reads. The test that
proves it must use a real linked working tree — against an ordinary checkout the old code gives the same
answer and the test proves nothing.

## Working here

```bash
npm install            # from the repository root — one node_modules for the whole tree
npm run build          # core first, explicitly (see below)
npm run typecheck
npm test               # builds first via pretest
node cli/packages/cli/dist/bin.js check
```

- **`npm run build` builds `core`, `records` and `module-harness` explicitly before `--workspaces`.**
  Workspaces build in *directory* order, not dependency order, so `cli` sorts ahead of all three and
  would typecheck against their stale `dist/` and report success. That produced a false green three times
  in eita before the line existed, and once more here — `module-harness` was added to the list only after
  a from-scratch build failed on `cli` while every incremental build had passed. **A package earns a
  place in `build:foundation` by being *statically* imported by something that sorts ahead of it.** That
  is why `module-harness` is there and no other `module-*` is: `cli` reaches every other module through a
  dynamic `import()` with a computed specifier, which creates no compile-time dependency, but
  `src/harness-status.ts` imports `module-harness` by name. **Verify a new cross-package import with
  `rm -rf cli/packages/*/dist && npm run build`** — an incremental build cannot see this class of break.
- **A NEW detector is a gate, never a new shell fragment.** `packages/gates/` plus an ops entry is the
  unit (RFC-0001), and the direction of travel is one way: fragments become gates, never the reverse.
  A gate is composable, testable, levelable, ignorable and fixable from config; a fragment is none of
  those. **The existing seventeen fragments stay shell** — porting them is a separate act, and doing it
  as part of packaging would have shipped seventeen freshly-written checks with no history of having
  caught anything (`packages/module-check/src/index.ts` is their front door, not a rewrite). That
  sentence protects what already exists; it is **not** licence to add an eighteenth. Read it that way
  once already: `36-type-index-drift.sh` was written as a fragment on the strength of it, then deleted
  and rewritten as `gates/type-index-drift` — the version that could declare `fixable` and regenerate
  what it found stale.
- **A fragment declares `CHECK_VERSION`, an integer, and the runner refuses one that does not** — the
  same axis and the same rule as `version` on a `GateDefinition`, moving only when a consumer of the
  check's output must handle it differently. It surfaces as `<id>@<version>` in `--list`, in the emitted
  record's instrument field, and in what `fragment-parity` reports having compared. The variable is
  cleared before each fragment is sourced: a fragment that forgot would otherwise inherit its
  predecessor's number, which is worse than the omission because it looks like an answer.
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
