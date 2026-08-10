<!-- vibe-ops-template rfc@0.1 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# RFC-0001: Gates and ops as the CLI's unit of composition

| Field | Value |
|---|---|
| Status | Accepted |
| Created | 2026-08-10 |
| Author | Danilo Borges |
| Related | [`plugin/references/harness-pair.md`](../../plugin/references/harness-pair.md) · [`cli/AGENTS.md`](../../cli/AGENTS.md) · `eita` RFC-0001 (observations from systems eita does not run) |

---

## Summary

A check fragment today fuses three separable things: **what it detects**, **where it looks**, and
**whether it records an observation**. This RFC proposes splitting them the way `eita` splits `trait`
from `profile` — a **gate** is a detector that knows nothing about scope, and an **ops** is a named
composition of gates over declared paths, deciding which of them emit. `vibe-ops agents-md` becomes the
first ops; `vibe-ops check` becomes an aggregator over the configured ones.

## Motivation

### The scope is soldered into the detector

`60-memory-slugs.sh` looks for personal-memory links across all tracked markdown. That is one detector
applied to one population, and the population is a decision the fragment makes for itself. It cannot
distinguish `AGENTS.md` from `docs/`, and the difference is real:

- In `AGENTS.md` and `README.md` a memory slug is **contextual and recurrent** — a model reintroduces it,
  because those files are where an agent writes about what it knows.
- In `docs/` it is **specific and rare** — a human wrote a wrong link once.

The same finding is worth measuring in the first population and is noise in the second, and nothing in
the current shape can express that. The consequence lands in `eita`: a rate over "all tracked markdown"
is a denominator nobody chose.

### The harness contract already asks for this and cannot deliver it

[`harness-pair.md`](../../plugin/references/harness-pair.md) states that the signal id names **the failure
mode, never the check** — `machine-path`, not `52-machine-paths` — and that *"several checks catching the
same failure in different places are **one** signal with a larger population"*. Both are asserted as
naming discipline, because there is no structure that could hold them. A gate is the failure mode; an ops
is the population. What was a convention people have to remember becomes the shape of the thing.

### Domain modules alone do not fix it

The alternative already half-built is one module per domain, each owning its checks outright. That moves
the problem rather than solving it: `memory-slug` would have to be duplicated into every domain that
cares, and the two copies would drift exactly the way two copies of anything drift here.

## Specification

**Implemented** — `packages/core` (`defineGate`, `defineOps`), `packages/gates` (four ported detectors
plus `pairing` and `claude-md-content`, new) and `packages/ops-agents-md` (the first ops), running beside
the shell fragments they port. `--file`, selective `--fix`, and the skill-scoped hook that calls both
shipped in Plan-009. Sections below diverge from the shape first drafted here; each says how and why.

### gate

A pure detector. Receives a file list and returns findings. **It does not know which repository it is in,
which paths it was given, or whether anything downstream records what it found.**

```ts
export default defineGate({
  id: "memory-slug",          // names the failure mode, per harness-pair.md
  summary: "A committed file links to a personal-memory slug",
  defaultPaths: ["**/*.md"],  // a default, not a constraint — see Open Question 1
  fixable: false,
  async run({ files }) {
    return [{ rule: "memory-slug", file, line, evidence }];
  },
});
```

**Implemented as: a gate lives outside the ops that composes it**, in `packages/gates/`, one folder per
gate — the same relationship `eita` has between a `trait` and a `profile`. An ops that owned its gates
outright would force `memory-slug` to be copied into every ops that also needs it, and the copies would
drift the way two copies of anything drift here (*Motivation*, "Domain modules alone do not fix it"). A
gate does **not** have to be a standalone npm package the way an `eita` trait is — promoting one to a
package later costs a line in the resolver, not a rewrite — but it must be resolvable independently of
any one ops, which ruling it inside `packages/ops-agents-md/` would not have allowed.

### ops

A named composition: which gates, over which paths, and which of them emit. This is the unit a user
invokes and the unit `eita` receives a population from.

```ts
export default defineOps({
  id: "agents-md",
  summary: "The instruction surface: AGENTS.md, CLAUDE.md, and the .agents/ ↔ .claude/ bridge",
  gates: [
    { gate: "budget",           paths: ["AGENTS.md"] },
    { gate: "pairing",          paths: ["**/AGENTS.md"] },
    { gate: "bridge" },                                    // gate's own default
    { gate: "check-frontmatter", paths: [".agents/rules/*.md"], schema: "rule" },
    { gate: "memory-slug",      paths: ["AGENTS.md", "**/CLAUDE.md", "README.md"], emits: true },
  ],
});
```

**Emission is decided by the ops, never by the gate**, because the two things only the producing side can
know both belong to the composition: the **population** (`--examined`) and the **moment**. A gate handed a
file list cannot know how many files the ops decided were in scope, and
[`harness-pair.md`](../../plugin/references/harness-pair.md) is explicit that *zero examined is not a
reading* — a rule the ops can enforce and the gate cannot.

**Implemented as: the emitter is built by the ops, not injected by the dispatch layer.** A plain module
gets `context.emit` from `packages/cli/src/run.ts`, which reads that module's own `emits`. An ops does
not use that path at all — `defineOps` calls `createEmitter` itself, from `context.config.artifactDir`
and the ids its entries declare. Emission stays doubly opt-in (an entry declares `emits: true`, the
config names `artifactDir`), but *which* entries opt in is a composition decision, not a dispatch one.
One consequence to flag: `run.ts` still injects `context.emit` for ordinary modules, and with
`module-check` dropping `emits` in this same change (see *Rationale*, below), that injection point has
no consumer left in this tree. Left as-is rather than removed — the contract is public, and a
third-party module may still use it.

### Discovery

Same convention as modules, for the same stated reason: **there is no registry file**, because a registry
is a second place to forget and a missing entry looks like a broken tool rather than an absent one. A bare
`agents-md` resolves to `@entelekheia/vibe-ops-agents-md`; a scoped name or a path is taken verbatim.

### `vibe-ops check`

Stays, as an aggregator over the ops named in `vibeops.config.ts`. The eight repositories whose
`pre-commit` calls one command keep calling one command.

### Verbs

| Verb | Does | Writes |
|---|---|---|
| `--check` (default) | run the ops; exit ≠ 0 on failure | no |
| `--audit` | same report, always exit 0 | no |
| `--fix [<gates>]` | apply only what is mechanically fixable — bare for every fixable gate, named for one or several | yes |
| `--file <path>` | scope to one file, tracked or not | no |
| `--list` | which gates composed, over which paths | no |
| `--explain <rule-id>` | what the rule means and how to satisfy it — still open | no |

**`--fix` must state its own coverage.** For `agents-md` it can repair `pairing`'s missing-sibling finding
(write `CLAUDE.md` containing `@AGENTS.md`). It cannot repair `budget` (relocation is judgement, and the
rule is explicit that it is *not* compression), `check-frontmatter` (writing a `description:` requires
content), or `pairing`'s *other* finding — a `CLAUDE.md` that exists but does not import back, which
would mean editing content someone else wrote. A `--fix` that announces repair and covers less than it
implies is a false green unless it says so in its output.

**Implemented as: coverage is stated structurally, not by convention.** A gate declares `fixable: true`
together with a `fix()` third argument to `defineGate`, enforced together at define time — `pairing` is
the only one so far; `bridge` was drafted here as a second candidate but shipped without one, since
recreating a symlink turned out to need no more mechanism than `pairing` already has, and adding it
unexercised would be exactly the "freshly-written, never caught anything" trap `packages/module-check`
already avoids for the shell fragments themselves. `--fix` also had to become selective
(`--fix pairing`, not only bare `--fix`) once a caller *reacting to one edit* existed — a hook fixing an
unrelated gate that merely happened to be fixable was never something the original bare form could
refuse.

### The skill-scoped hook

`hooks:` is a `SKILL.md` frontmatter field: hooks *"scoped to the component's lifecycle"* that *"only run
when that component is active"* and are cleaned up when it finishes. Combined with `paths:`, this gives a
chain with no standing cost:

**`paths:` loads the skill → the skill installs the hook → the hook acts → both leave when the skill does.**

For `authoring-agents-md`, a `PostToolUse` hook on `Write|Edit`:

- wrote an `AGENTS.md` with no sibling `CLAUDE.md` → **create it**, and return `additionalContext` saying
  so. Mechanical, one line, no judgement.
- edited a `CLAUDE.md` carrying content beyond `@AGENTS.md` → **ask** whether it belongs in `AGENTS.md`.
  Never block: blocking a legitimate edit is hostile, and Claude-specific guidance is a real case.

**The guarantee comes from `paths:`, not from the hook.** If the skill does not load, the hook does not
exist — the hook is the acting arm, the path-scope is the coverage.

**Measured 2026-08-10, this is a coverage bound, not a trigger.** `paths:` matching makes the skill
*eligible* to load; it does not make Claude Code load it on every matching write. A real session's first
attempt — writing an `AGENTS.md` with the skill not already active — installed no hook at all. Only after
the skill was explicitly invoked did the next matching write fire it (Plan-009, Decision Log). So "the
hook acts whenever the path matches" is not the guarantee this section can make; "the hook cannot act
unless the path matches, and cannot act at all unless the skill is active" is. A full `vibe-ops agents-md`
sweep remains the only unconditional check.

**Implemented as: the hook is the `vibe-ops` command itself — no script ships with the skill.** A script
would exist only to pull `tool_input.file_path` off stdin and wrap the result back into the hook's
response envelope, and the CLI's `hook` verb (`packages/cli/src/hook.ts`) does both — deleting three
hazards the six hand-written hooks in `plugin/hooks/` each carry a copy of: a `jq`-or-nothing dependency,
hand-rolled JSON escaping, and a second parse of the payload shape. The registration names `vibe-ops`
directly as `command`, with no `sh -c` guard in front of it — see *Rationale*, "Why the hook fails loud,
not silent." "Ask" shipped as **warn**, not an interactive prompt: the hook reports via
`additionalContext` (`claude-md-content`, a new gate, and `pairing`'s second finding, an existing
`CLAUDE.md` with no import), and it is the model reading that context — not the hook — that decides
whether to ask the user anything. `additionalContext` carries no framing either way, so the model
remains free to correctly decline (`plan-progress-nudge.sh` measured that `decision:block` arrives framed
as a denial, which is wrong for exactly this kind of observation).

## Rationale

**Why `eita`'s shape rather than something new.** `trait`/`profile` solves the identical problem one layer
up: a versioned unit of observation, and a validated composition that decides which units run against
what. Borrowing it keeps one vocabulary across two products that already exchange artifacts, and the
translator on the `eita` side already expects a population it did not choose.

**Why the ops owns emission.** The alternative — a gate declaring `emits` — was in the half-built module
and is wrong for a reason that is not stylistic: it produced `emits: ["checks-run", "checks-failed"]`,
which counts *checks*, exactly the taxonomy `harness-pair.md` forbids because it grows with the tooling
instead of with the phenomena.

**Why `agents-md` does not emit at all.** Its gates are **structural properties** of a repository —
a file has a sibling or it does not, a symlink resolves or it does not. Once fixed they stay fixed, and
not because anyone learned. The reading `harness-pair.md` wants to enable — *"violations falling to zero,
then staying → the guide worked → consider deleting the guide"* — is only meaningful where a guide is
trying to correct a **behaviour**. `memory-slug` scoped to the instruction surface is the exception in
this ops, and is why emission is per-entry rather than per-ops.

**Why the hook fails loud, not silent.** An early draft wrapped the registration in
`sh -c "command -v vibe-ops && exec … || exit 0"`, so a machine without the CLI would see nothing. That
is the wrong silence: it makes an unusable installation — the plugin and the CLI are co-dependent,
per Plan-009 — look identical to a working one that simply found nothing to fix. ADR-0009 obligation 3
forbids failing *open while appearing to work*, not failing loudly; naming `vibe-ops` directly as
`command` means a missing install surfaces as a hook failure, attributable and fixed by one `npm link`.

## Implementation Notes

Order, and each step was verifiable on its own:

1. **Done.** `packages/core` gains `defineGate` and `defineOps` beside `defineModule`. An ops is a
   module — same dispatch, same MCP exposure — so nothing in the CLI learns a second concept.
2. **Done.** `packages/gates`: `budget`, `bridge`, `check-frontmatter`, `memory-slug` — ported out of
   shell — plus `pairing` and `claude-md-content`, new, with no shell precedent. One folder per gate.
   `packages/ops-agents-md` composes all six over the instruction surface; the other twelve fragments
   stay shell (Q4).
3. **Not done.** `vibe-ops check` still runs only the seventeen shell fragments; `agents-md` is invoked
   separately and the two are compared by hand, not merged into one aggregator yet. Deliberate — the
   comparison is the point before either runner is trusted to replace the other.
4. **Done (Plan-009).** `authoring-agents-md`'s `hooks:` block, calling `vibe-ops hook agents-md --fix
   pairing` directly rather than a shipped script (see "The skill-scoped hook," above). The consequence
   this item used to flag — `25-hooks-registration.sh` only scanning `$PLUGIN_DIR/hooks/*.sh`, blind to a
   skill's own block — is closed the same way: with no script under `skills/*/hooks/` to scan (there is
   none — the command *is* the hook), the check instead validates the shape of every skill's `hooks:`
   block itself: a known event, a `command`, and any `${CLAUDE_SKILL_DIR}/`-relative path it names
   existing. Two further things Plan-009 found while closing this out, neither anticipated here: `--file`
   and selective `--fix` had to exist first, so the hook could act on one file without touching every
   other `AGENTS.md` in the repository; and `${CLAUDE_PLUGIN_ROOT}/../cli/...`, written at ten call sites
   before any of them had a command to call instead, needed its own guard
   (`70-plugin-root-paths.sh`) to stop resolving silently in this working tree while resolving nowhere
   an installed plugin can reach.

**`check-frontmatter` replaces two fragments with one parameterised gate.** `40-frontmatter` (rules) and
`45-skill-frontmatter` (skills) are the same detector against different schemas: *this markdown declares
the frontmatter its type requires*. One gate, an `options.schema` argument, and a third type costs a
schema rather than a fragment. The two schemas still report under their original rule ids
(`frontmatter`, `skill-frontmatter`) rather than a shared one — they are genuinely distinct failure
modes (an unsurfaced rule vs. a silently-dropped skill), and keeping the ids apart is what lets the
comparison against the shell fragments in step 3 be exact.

**`skill-frontmatter` leaves the `agents-md` domain, eventually.** In this repository `skills/` is the
plugin's product; in a consumer repository `.agents/skills/` is agent config. `ops-agents-md` composes
both paths for now (`<plugin>/skills/*/SKILL.md` and `.agents/skills/*/SKILL.md`) rather than waiting for
a domain split that Q4 hasn't resolved yet.

Two corrections this RFC owed, both done in this change:

- `plugin/AGENTS.md` listed the `SKILL.md` frontmatter fields and omitted `hooks`. Fixed.
- `packages/module-check` declared `emits: ["checks-run", "checks-failed"]`. Removed; see *Rationale*.

## Open Questions

Q1 and Q2 are resolved by implementation, below. Q3 and Q4 remain open.

3. **Does an ops declare the glob that a rule then reuses?** If an ops owns the scope, the always-on rule
   governing that scope could point at the same declaration instead of restating it — guide and sensor
   sharing one scope rather than two copies of it. Attractive and unproven; it needs a mechanism for a
   markdown rule to reference a TypeScript declaration without importing it.
4. **How many ops, and named after what?** `agents-md`, `exposure`, `plugin`, `license` fall out of the
   current seventeen, but that is a classification of the checks that exist rather than of the failures
   that matter. Deriving the second from the first is how a taxonomy ends up shaped like its tooling.
   `agents-md` answers this for one slice; the other twelve fragments still wait on it.

## Decisions Closed

- **Gates and ops replace domain modules as the unit of composition.** Rationale: a domain module owning
  its checks outright would duplicate any detector two domains both need, and the copies drift.
  2026-08-10.
- **The ops decides emission, not the gate.** Rationale: population and moment are knowable only to the
  composition, and `harness-pair.md`'s "zero examined is not a reading" is a rule only the ops can
  enforce. 2026-08-10.
- **`agents-md` does not emit, except `memory-slug`.** Rationale: structural properties produce a series
  of zeros that says nothing about whether a guide worked; recurrent behaviour is what is worth counting.
  2026-08-10.
- **`vibe-ops check` survives as an aggregator.** Rationale: eight repositories call one command from
  their `pre-commit`; removing it would make an internal refactor a migration for all of them.
  2026-08-10.
- **The pairing fix is delivered by a skill-scoped hook, not a session-wide one.** Rationale: `hooks:` in
  frontmatter is scoped to the component's lifecycle, so `paths:` → skill → hook costs nothing in a
  session that is not touching those files. 2026-08-10.
- **Package naming: `packages/ops-<id>` → `@entelekheia/vibe-ops-<id>`.** Rationale: with this RFC `ops-`
  stops being decoration and becomes the artifact type, the way `trait-` is in `eita`. 2026-08-10.
- **Q1 closed: the gate declares a default, the ops overrides.** `GateDefinition.defaultPaths` is
  optional; `OpsGateEntry.paths` wins when present. A gate that declares no default at all falls back to
  `["**/*"]`, which is correct for a gate like `bridge` that re-derives its own population from
  `.claude/` regardless of what an ops hands it. 2026-08-10.
- **Q2 closed: duplication across overlapping ops is accepted, not deduplicated.** The `ops:<id>` tag on
  every emitted observation carries the population as part of the signal's identity, so two readings of
  the same finding under two ops are two distinct signals, not one recorded twice. Nothing in `core`
  deduplicates across ops, and nothing should — a consumer that wants to merge them can do so from the
  tag, but a producer collapsing them first would throw away which composition actually saw it.
  2026-08-10.
- **`<plugin>/` in a declared path expands to the target's plugin surface.** `resolvePluginDir` and
  `expandPluginToken` (`packages/core/src/files.ts`) replicate the shell runner's `$PLUGIN_DIR` rule —
  `plugin/` when `plugin/.claude-plugin/plugin.json` exists, the repository root otherwise — so an ops
  entry can name `<plugin>/skills/*/SKILL.md` and be correct in both layouts. Rationale: hardcoding one
  layout for the other makes a dogfooded pair unreachable in the other, which is exactly the failure the
  shell runner's own `$ROOT`/`$PLUGIN_DIR` split exists to prevent (`cli/AGENTS.md`). 2026-08-10.
- **A gate lives in its own package (`packages/gates/`), never inside the ops that composes it.**
  Rationale: `memory-slug` is one detector two different ops will eventually need; owning it inside
  `ops-agents-md` would force a second copy the moment a second ops wants it. 2026-08-10.
- **`--fix` ships, reversing its earlier deferral, and takes an optional list of gate labels.**
  Rationale: the original objection — a `--fix` covering two of five gates announcing a repair it did not
  make — is answered structurally (`fixable`/`fix()` declared together, findings re-run to confirm,
  `repaired` reported apart from what still fails) rather than by leaving the verb unbuilt. It had to be
  selective the moment a caller reacting to one edit existed: a bare `--fix` would let a hook rewrite
  files the edit never touched. 2026-08-10 (Plan-009).
- **`pairing` splits its two findings by failure mode, not by root-vs-nested depth.** Rationale: a nested
  `AGENTS.md` with no sibling used to warn on the theory that a path-scoped rule was an available
  alternative — a choice made *before* the file existed. Once it exists it either loads or it does not,
  at every depth, and the repair is the same one line either way. 2026-08-10 (Plan-009).
- **The hook is the `vibe-ops` command itself; no skill ships a script.** Rationale: see "The
  skill-scoped hook," Implemented as, above. 2026-08-10 (Plan-009).

## Related

- [`plugin/references/harness-pair.md`](../../plugin/references/harness-pair.md) — the guide/sensor/reading
  contract this RFC gives a structure to; the vocabulary boundary and the reading rules are stated there
  and are not repeated here.
- [`cli/AGENTS.md`](../../cli/AGENTS.md) — the module contract gates and ops extend, plus `--file`,
  selective `--fix`, and the `hook` surface.
- [`cli/packages/gates/README.md`](../../cli/packages/gates/README.md) — the six gates as implemented.
- [`cli/packages/ops-agents-md/README.md`](../../cli/packages/ops-agents-md/README.md) — the first ops
  as implemented, and its comparison table against the shell fragments it ports.
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) — the `hooks:` frontmatter field
  and its lifecycle scoping.
- [Plan-009](../plans/009-the-first-skill-scoped-hook-and-the-cli-it-calls.md) — executed this RFC's
  postponed step 4 and "The skill-scoped hook"; its own Decision Log carries choices scoped to that
  implementation rather than to this RFC (the symlink fix in `toRepoRelative`, the `project/` exclusion
  from `plugin-root-paths`, the known gap where a CLAUDE.md-only edit does not re-trigger `pairing`).
