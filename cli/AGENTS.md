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
| [`packages/module-<id>/`](packages/) · [`packages/governance-<t>/`](packages/) | One module, one package; since Plan-033 **one artifact, one governance package** (ADR-0019). `module-check` is the reference module implementation. `governance-{adr,rfc,plan,task}` and `governance-knowledge` (which ships `log` and `learning` as two units from one manifest — ADR-0020) each carry their artifact's data (`type.json` at the package root, `templates/`, `migrations/`, `authoring.md`, an `ownership.json` fragment) AND its verbs, built on `defineGovernance` — adr and rfc are pure sugar; plan, task and log absorbed the former `module-plan`/`-task`/`-log`, ids unchanged. A bare noun routes through the **effective governance map** (shipped defaults ⊕ `config.types` — the config is the registry) before the package-name conventions. `module-records` keeps the cross-type verbs — census, handling, show, list, and `norm`, the facet reader the plugin skills call. [`packages/harness/`](packages/harness/) is **CLI-internal** (no governance of its own), declares `needsSource`, and reads the installed norm — the activated packages, or a pinned tree — as well as the repository it acts on. Five of its six verbs read; **`sync` is the only thing here that writes into another repository**, on a linked working tree, stopping at a branch and a tag. What it may overwrite is governed by the **composed** ownership boundary: the harness's own base `ownership.json` plus each activated governance's fragment, origin kept per entry, with the repository's own hand-written `ownership` narrowings from `vibeops.config.ts` applied last — refused when one would widen (a pinned tree's declaration is used whole, never blended). **A path with no entry is not permission**, a doubly-claimed path is refused naming both claimants (peers, never precedence), and the run stops on either. |
| [`packages/module-config/`](packages/module-config/) | `@entelekheia/vibe-ops-module-config` (Plan-032 Track 5) — the effective value of a dotted config key, the file behind it, and every value it shadows (RFC-0004): `get`/`list --show-origin` read the cascade `loadConfig` already builds; `set`/`unset` write ONLY `types.<name>` into the managed layer through `writeManagedConfig` — every other writable key has its own verb (`ownership set`, `harness sync`), and this noun refuses them by name rather than accepting a key it does not own. |
| [`packages/module-ownership/`](packages/module-ownership/) | `@entelekheia/vibe-ops-module-ownership` (Plan-032 Track 5) — `get`/`list --show-origin` read the **composed** boundary `@entelekheia/vibe-ops-harness` already builds (`classOf`/`entryFor`/`composedOwnership`), never re-deriving it; `set` writes one repository narrowing into the managed layer, refusing an unknown class, a missing reason, or a widening by composing the candidate narrowing and reading `refusedNarrowings` back — the same rule the composition already applies, not a second copy of it. |
| [`packages/governance-base/`](packages/governance-base/) | `@entelekheia/governance-base` (ex `records`, renamed in Plan-033) — the reusable governance components the nouns share, and home of the `defineGovernance` sugar: where records live, the next number, a plan's status chain and living sections, the closure box, filing and closing, and (`shape.ts`) a record's own shape — its headings and how many entries stand under a named section, which is what `records show` projects. `entriesUnder` returns **`undefined` for an absent section and `0` for an empty one**; collapsing the two is the defect the verb exists to remove. **Action, never detection** — it mutates and resolves destinations, which is exactly what a gate may not do. It is also a second foundation package: it sorts after every `module-*` that depends on it, so `npm run build` builds it explicitly, like `core`. |
| [`packages/module-check/sh/`](packages/module-check/sh/) | **Eight checks remain shell**, owned by the module that runs them — Plan-038 Track 7 retired the nine whose TypeScript ports met Plan-022's bar (a corpus wide enough, no divergence ever reported, both sides failing the same shared fixture) and deleted `fragment-parity`, the gate that measured them, in the same commit. `--list` shows what was composed; `--self-test` builds a deliberately broken fixture and asserts every surviving check fires on it, and `--emit-fixture <dir>` hands that same fixture to the TypeScript side so `check --self-test`'s `ports` phase can assert the nine retired fragments' ports still fail on it too. **Nothing invokes this script by path any more** — Plan-038 Track 5 moved every gate, this repository's own included, onto `vibe-ops check`, retiring the "Node-free and standalone" property the script used to carry. It was true and load-bearing while a consumer's `pre-commit` resolved the runner itself on a bare checkout, and the fragments were the only reason it could be — so the property retires with them rather than with the last one. |
| [`packages/gates/`](packages/gates/) | `@entelekheia/vibe-ops-gates` — detectors with no notion of scope, one folder per gate; twenty of them. Nine read the document model rather than the file, and how to do that is [core's README](packages/core/README.md); `budget` (counts lines), `bridge` (reads `git ls-files -s` for the symlink mode bit) and the three `config-*` gates plus `modules-omits-builtin` (they read the configuration cascade through `loadConfig`, not a document — Plan-032) do not. Four have shell precedent that has since been retired — `budget`, `bridge`, `check-frontmatter` and `markdown-link` each ported a fragment that Plan-038 Track 7 deleted once the port met Plan-022's bar; `pairing`, `claude-md-content`, `breadcrumb`, `record-header`, `template-version`, `template-heading-drift`, `disabled-declared`, `runner-provenance`, `unstated-destination` and `record-frontmatter` never had shell precedent. Two are worth knowing before composing them: **`record-header`** and its frontmatter-carrier sibling **`record-frontmatter`** each take `options.type` and `options.required` and throw without them, so one entry per record type — the type name and its field list are DATA, from that type's own `governance-<t>/type.json` (Plan-030 Track 2, re-homed by Plan-033), and neither gate holds a list of the types this repository ships. Which of the two a type gets is its manifest's `schema.carrier`: `table` or `frontmatter`. `record-header`'s header-table reader is shared with `packages/governance-base/`, not duplicated. **`mirror` and `classification` each carry many fragments' worth of detection**, because ten of the eleven unported fragments were two operations wearing different data: `mirror` produces a left and a right and reports what is in the left and not in the right (`compare`: `text` | `sha` | `group`), and `classification` reports a pattern that must not appear in a population (`level`: `secret` | `confidential` | `internal`, which decides how a finding may speak). In both, the MODE carries the machinery and the ops carries only data — an `options` that said HOW to detect would move the detection into configuration nothing versions. The eleventh fragment exercises a hook across firings and is a test, not a gate. **`fragment-parity` is gone** — Plan-038 Track 7 deleted it in the same commit as the nine fragments it had finished comparing; it held no repository knowledge of its own, which is exactly what its own header said would let it leave the day its subject did. |
| [`packages/ops-agents-md/`](packages/ops-agents-md/) | `@entelekheia/vibe-ops-agents-md` — the first ops: composes seven `packages/gates/` entries over the instruction surface, four of them ports whose shell fragment Plan-038 Track 7 has since retired (`budget`, `bridge`, `check-frontmatter` under both its `frontmatter` and `skill-frontmatter` labels). The seventh, `agent-frontmatter`, has no shell precedent and never had a `fragment-parity` entry — parity compared a gate against the fragment it replaced, and this one replaced nothing. `vibe-ops check` now composes this ops beside the eight fragments that are still shell, not beside the four this ops itself ported. |
| [`packages/ops-governance/`](packages/ops-governance/) | `@entelekheia/vibe-ops-governance` — the second ops. Its per-type entries are **derived per run from the activated governances** (Plan-034): the `record-schema` rule emits `record-header` or `record-frontmatter` per each type's `schema.carrier` with `required` read from that package's own `type.json`, and `template-version` emits one versioning entry per type — a repository binding a sixth governance package sees its entries appear with no edit here. The static rest is `markdown-link`, `breadcrumb`, the three config-cascade gates (`config-shadow`, `config-managed-committed`, `config-state-leftover` — Plan-032, here because this is the ops every consumer's pre-commit runs) and `modules-omits-builtin` (a declared `modules` list that silently hides a built-in noun from the MCP server), `disabled-declared` (every `settings.<ops>.disabled` names a reason) and `runner-provenance` (a copied-in runner snapshot never silently outranks a live sibling checkout — its fixture writes the sibling as `../vibe-ops/…`, which the self-test keeps inside its own temporary root). `fragment-parity` comparing `20-links.sh` against `markdown-link` is gone with the fragment it read (Plan-038 Track 7). Nothing in `gates/` is composed nowhere: `harness catalog` says so. The collection is `ops.json` at the package root — the canonical form for all three ops since Plan-034 — with `src/index.ts` as typing sugar over `parseOpsDefinition`, holding the narrative JSON cannot carry. |
| [`packages/ops-for-vibe-ops/`](packages/ops-for-vibe-ops/) | `@entelekheia/vibe-ops-for-vibe-ops` — the third ops, and the one whose population is the near-complement of `governance`'s: not the records, but the prose describing this repository's own machinery, read as ITSELF rather than against a counterpart. One entry since Plan-037 moved `template-heading-drift` to `mirror` and Plan-032's three config-cascade gates moved on to `governance` (they protect every consumer's managed file, not this repository's prose); a single-entry composition is not a defect, whereas a composition whose subject needs an "and" is. |
| [`packages/ops-mirror/`](packages/ops-mirror/README.md) | `@entelekheia/vibe-ops-mirror` — the fourth ops: **what one place claims, another place must confirm**. An entry belongs here when describing it by naming only ONE of the two things it reads would be wrong. It is also the boundary an `audience` field was built and reverted for (Plan-035): every entry here is meaningless in a repository holding no vibe-ops checkout, and a repository that does not install this package composes none of them — nothing to declare, nothing to filter. **`settings` is keyed by ops id**, so moving an entry here means moving its settings slice in the same commit; a slice left behind is never read and the entry runs unconfigured, in silence. |
| [`packages/ops-exposure/`](packages/ops-exposure/README.md) | `@entelekheia/vibe-ops-exposure` — the fifth ops: **whether a committed file exposes material above its classification**. The policy it enforces is `@entelekheia/governance-classification`; the ops is named for the check because a bare noun resolves to the governance type first. One entry per rule, and `level` (`secret` | `confidential` | `internal`) decides how a finding may speak rather than labelling it: at `secret` the finding names where only. Every rule quotes the MATCH and never the line — a detector cannot see another entry's rules, so quoting a whole line would eventually print what a stricter rule protects. `private-name` takes its patterns from a path (`VIBE_OPS_DENYLIST`), never from the composition. |
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
second concept. Since Plan-034 the collection's canonical form is the package's own `ops.json`
(`parseOpsDefinition` loads it; `src/index.ts` is typing sugar), and it may name `derives` rules —
per-type entries computed per run from the repository's activated governances, so the entry list is a
fact about the repository, never a hand-maintained copy of the types it serves.

- **The ops owns emission, never the gate.** Population (`--examined`) and moment are knowable only to
  the composition; a gate handed a file list cannot enforce "zero examined is not a reading"
  (`vibe-ops harness policy --name pair --print`).
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

**Each directory holds three layers, not one file** ([RFC-0004](../project/rfc/implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md)):
`local` (`vibeops.config.local.{ts,mjs,js}`, the operator's, clone-local and gitignored), `declared`
(`vibeops.config.{ts,mjs,js}`, committed, hand-written) and **`managed`** (`vibeops.config.json`,
committed, **the only config file this tooling writes** — parsed rather than imported, one key per owning
module through `writeManagedConfig`, read only at the nearest `.git` ancestor and reported in
`LoadedConfig.leave` anywhere else). All three contribute, nearest first, so a committed config ships fully
populated while a clone overrides only what is true of that machine. **The directory walk still outranks
the layers** — a nearer declared file beats a farther local one, and a nearer managed file beats a farther
declared one, asserted by tests because inverting it yields a cascade that still looks correct while a
stale home file governs every repository. `loadOne()` therefore returns every match in a directory rather
than the first per half, which is the thing to preserve if it is ever refactored: returning the first makes
a local file *replace* the committed one it exists to layer over
([ADR-0014](../project/adr/0014-clone-local-configuration-layers-rather-than-replaces.md)).

**`vibeops.config.local.json` is retired and never read**; a leftover one is named in `leave`, and the next
`harness sync` moves its map into the managed file and deletes it.

`harness.applied`, `harness.boundary` and `harness.agreed` come from the `managed` layer **alone** — a
`local` or `declared` copy is stripped at load — and merge nearest-wins whole: `applied` is which version
of each record type was **promulgated** here (not what any artifact was written against, which is that
artifact's own frontmatter; absence is a state and never zero), `boundary` the ownership version it was
promulgated under, `agreed` the receipt — the class of every file promulgation wrote, which the next
`sync` compares the installed declaration against so that only a widening asks for consent. `sync` writes
all three into the promulgation commit itself, so on the base branch they answer only once that branch
merges. `harness.source` stays hand-written and cascades per key like every other key.

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

- **`npm run build` builds `core`, `governance-base`, `governance-plan` and `harness` explicitly before `--workspaces`.**
  Workspaces build in *directory* order, not dependency order, so `cli` sorts ahead of all three and
  would typecheck against their stale `dist/` and report success. That produced a false green three times
  in eita before the line existed, and once more here — the harness was added to the list only after
  a from-scratch build failed on `cli` while every incremental build had passed. **A package earns a
  place in `build:foundation` by being *statically* imported by something that sorts ahead of it.** That
  is why `harness` and `governance-plan` are there and no other module is: `cli` reaches everything else through a
  dynamic `import()` with a computed specifier, which creates no compile-time dependency, but
  `src/harness-status.ts` imports the harness by name and the three plan hooks import `governance-plan`. **Verify a new cross-package import with
  `rm -rf cli/packages/*/dist && npm run build`** — an incremental build cannot see this class of break.
- **A NEW detector is a gate, never a new shell fragment.** `packages/gates/` plus an ops entry is the
  unit (RFC-0001), and the direction of travel is one way: fragments become gates, never the reverse.
  A gate is composable, testable, levelable, ignorable and fixable from config; a fragment is none of
  those. **The eight remaining fragments stay shell** until each one's port meets Plan-022's bar
  (`packages/module-check/src/index.ts` is their front door, not a rewrite) — writing a new one as part
  of packaging would have shipped a freshly-written check with no history of having caught anything.
  Nine already crossed that bar and were deleted in Plan-038 Track 7, alongside `fragment-parity`, the
  gate that had measured them; that removal is **not** licence to add a new fragment in their place. Read
  the "stay shell" sentence that way once already: `36-type-index-drift.sh` was written as a fragment on
  the strength of it, then deleted and rewritten as `gates/type-index-drift` — the version that could
  declare `fixable` and regenerate what it found stale. (That gate later left with the aggregated index
  it compared — Plan-033 — which retires the example, not the rule.)
- **A fragment declares `CHECK_VERSION`, an integer, and the runner refuses one that does not** — the
  same axis and the same rule as `version` on a `GateDefinition`, moving only when a consumer of the
  check's output must handle it differently. It surfaces as `<id>@<version>` in `--list` and in the
  emitted record's instrument field. The variable is cleared before each fragment is sourced: a fragment
  that forgot would otherwise inherit its predecessor's number, which is worse than the omission because
  it looks like an answer.
- **A fragment gets `$ROOT` and `$PLUGIN_DIR`, and they are not the same.** `$ROOT` is the repository
  being checked; `$PLUGIN_DIR` is where its plugin surface lives — `plugin/` here, the root in a repo
  laid out flat. Hardcoding one for the other made every dogfooding pair unreachable in a flat repo,
  which is exactly where the self-test fixture caught it.
- **`sh/` ships in the package's `files`**, so the fragments travel with an install and are resolved
  relative to the module — never from `PATH`, never by searching upward for a checkout.
- **`npm i -g @entelekheia/vibe-ops-cli` puts `vibe-ops` on PATH**, and `npm link -w
  @entelekheia/vibe-ops-cli` puts this working tree there instead. Only one of the two answers at a time,
  and `vibe-ops --version` cannot tell them apart while the tree and the registry carry the same number —
  `readlink -f "$(command -v vibe-ops)"` can. Either is needed to exercise the `hook` surface as a skill
  actually calls it; `cli/README.md` has both recipes.

## Releasing

These packages release through **changesets**; `plugin/` releases on its own line and by its own rules
([`plugin/AGENTS.md`](../plugin/AGENTS.md)). The two share a tree and nothing else — the root
`CHANGELOG.md` is the plugin's, `plugin/` is not an npm workspace, and `changeset version` never touches
either.

- **A PR that changes a published package carries a `.changeset/*.md`.** `check.yml`'s `changeset` job
  fails the PR otherwise. Changesets reads that file and never the commit message, so an undeclared
  change reaches the registry with an empty changelog entry and a version nobody chose.
- **`fixed` is empty on purpose, and the empty array is the decision.** A locked version group is the
  right default for a platform released as one number — and the wrong one here, because a repository
  activates the `governance-*` types it wants through `vibeops.config` and may bind a type to a package
  this repo does not ship (RFC-0003). Chaining those versions to the core would mean nobody but the core's
  owner can release one. Do not "fix" the empty array.
- **A changeset that is not staged is invisible to the gate.** `changeset status --since` reads git, so a
  written-but-untracked file reports as *"no changesets were found"* — the same message as having written
  none. `git add` it before trusting a local run; CI never sees this because everything there is committed.
- Publish order is not workspace order. `npm publish` validates no dependency, so nothing stops a
  dependent from going out first — and sitting on the registry un-installable until its dependency lands.

## Keeping this file current

Triggers: a package is added or renamed; the module contract gains or loses a field; the config cascade
changes; the build order changes; a fragment starts needing something `$ROOT`/`$PLUGIN_DIR` does not
give it. Adjust the one affected line and point at the source rather than restating it.
