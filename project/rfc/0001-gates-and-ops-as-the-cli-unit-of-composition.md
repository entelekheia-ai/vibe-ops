<!-- vibe-ops-template rfc@0.1 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# RFC-0001: Gates and ops as the CLI's unit of composition

| Field | Value |
|---|---|
| Status | Draft |
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

*Direction, not settled — the open questions below are load-bearing.*

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
| `--fix` | apply only what is mechanically fixable | yes |
| `--list` | which gates composed, over which paths | no |
| `--explain <rule-id>` | what the rule means and how to satisfy it | no |

**`--fix` must state its own coverage.** For `agents-md` it can repair `pairing` (write `CLAUDE.md`
containing `@AGENTS.md`) and `bridge` (recreate a symlink whose target exists). It cannot repair `budget`
(relocation is judgement, and the rule is explicit that it is *not* compression) or `check-frontmatter`
(writing a `description:` requires content). A `--fix` that announces repair and covers two of five is a
false green unless it says so in its output.

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

## Implementation Notes

Order, and each step is verifiable on its own:

1. `packages/core` gains `defineGate` and `defineOps` beside `defineModule`. An ops is a module — same
   dispatch, same MCP exposure — so nothing in the CLI learns a second concept.
2. `packages/ops-agents-md`: `budget`, `pairing` (new), `bridge`, `check-frontmatter`, plus `memory-slug`
   scoped to the instruction surface. Ported out of shell; the other twelve fragments stay.
3. `vibe-ops check` composes the ops plus the still-shell fragments, so the gate stays green throughout.
4. `authoring-agents-md` gains the `hooks:` block and its `pairing.sh`.

**`check-frontmatter` replaces two fragments with one parameterised gate.** `40-frontmatter` (rules) and
`45-skill-frontmatter` (skills) are the same detector against different schemas: *this markdown declares
the frontmatter its type requires*. One gate, a `schema` argument, and a third type costs a schema rather
than a fragment.

**`skill-frontmatter` leaves the `agents-md` domain.** In this repository `skills/` is the plugin's
product; in a consumer repository `.agents/skills/` is agent config. The same check belongs to different
ops depending on the repo, which is precisely what ops are for.

Two corrections this RFC also owes:

- `plugin/AGENTS.md` lists the `SKILL.md` frontmatter fields and **omits `hooks`**. The list presents
  itself as complete, so it is wrong. Fix it with step 4.
- `packages/module-check` declares `emits: ["checks-run", "checks-failed"]`. Remove it; see *Rationale*.

## Open Questions

1. **Who declares paths — the gate, the ops, or both?** The proposal above is *gate declares a default,
   ops overrides*, so a gate works with no configuration and can still be recombined. The alternative
   (ops always declares) is more explicit and more verbose, and makes every ops restate globs that are
   obvious. Not settled.
2. **Overlapping ops double-count.** Two ops running the same gate over intersecting paths produce the
   same finding in two populations, and the `eita` numbers inflate with no way to notice. Options: forbid
   overlap, deduplicate by `(rule, file, line)` before emission, or accept it and make the population an
   explicit part of the signal identity. Undecided, and it is the question most likely to be discovered
   late and expensively.
3. **Does an ops declare the glob that a rule then reuses?** If an ops owns the scope, the always-on rule
   governing that scope could point at the same declaration instead of restating it — guide and sensor
   sharing one scope rather than two copies of it. Attractive and unproven; it needs a mechanism for a
   markdown rule to reference a TypeScript declaration without importing it.
4. **How many ops, and named after what?** `agents-md`, `exposure`, `plugin`, `license` fall out of the
   current seventeen, but that is a classification of the checks that exist rather than of the failures
   that matter. Deriving the second from the first is how a taxonomy ends up shaped like its tooling.

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

## Related

- [`plugin/references/harness-pair.md`](../../plugin/references/harness-pair.md) — the guide/sensor/reading
  contract this RFC gives a structure to; the vocabulary boundary and the reading rules are stated there
  and are not repeated here.
- [`cli/AGENTS.md`](../../cli/AGENTS.md) — the module contract gates and ops extend.
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) — the `hooks:` frontmatter field
  and its lifecycle scoping.
