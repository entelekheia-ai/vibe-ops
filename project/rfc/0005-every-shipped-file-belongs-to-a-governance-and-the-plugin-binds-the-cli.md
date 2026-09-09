---
vibe-ops-template: rfc@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0005: Every shipped file belongs to a governance, and the plugin binds the CLI

| Field | Value |
|---|---|
| Status | Accepted |
| Created | 2026-09-06 |
| Accepted | 2026-09-08 — maintainer sign-off, every open question closed |
| Author | Danilo Borges |
| Depends on | [RFC-0003](0003-a-governance-type-as-a-pluggable-unit.md), [RFC-0004](implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md) |
| Related | [ADR-0013](../adr/0013-the-model-a-shipped-plugin-may-pin.md), [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md), [Plan-033](../plans/shipped/033-one-artifact-one-governance.md), [Plan-032](../plans/shipped/032-the-ownership-verb-and-the-configuration-it-writes.md) |

---

## Summary

Every file this tooling writes into a repository, and every policy a skill reads before writing one,
belongs to exactly one governance package: versioned, classified by an ownership fragment, migrated by a
recorded note, served by the CLI. Today that holds for the five record types and fails for the rest of
the plugin — ten policy references, thirty-two scaffold templates, four shell scripts, eight licence
files and one pinned agent live only in the plugin tree, reachable only through `${CLAUDE_PLUGIN_ROOT}`. This RFC moves them:
three governance types are added (`style`, a composed stack of writing styles scoped per artefact;
`instructions`, the
instruction surface; `knowledge`, one package shipping `log` and `learning` as two units), the remaining references join the packages whose
policy they are, the scaffold becomes a composition of what each activated governance ships, and the
scripts become `vibe-ops hook` surfaces or verbs. What stays in the plugin is what needs judgement or is
the binding to one agent host: the skills, two read-only agents, and `hooks.json`. A second binding —
another agent host — then installs the same CLI and reads the same policy, copying nothing.

## Motivation

Plan-033 made "one artifact, one governance package" true for records: a type ships its template, its
authoring rules, its migration notes and its ownership fragment, and a repository binds it with one
`types` entry. Everything else the plugin ships into a repository has none of that:

- **Ten policy references** (`plugin/references/*.md`, 84K) each carry a `vibe-ops-reference: <name>@N`
  stamp, but no package owns them: ten skills and one agent read them through `${CLAUDE_PLUGIN_ROOT}`,
  and seven CLI source files point at them by path. A binding for another agent host has no
  `${CLAUDE_PLUGIN_ROOT}` and would carry copies. One of them, `authoring-style`, is the one a repository
  would most plausibly want to replace — the way an operator picks an output style — and there is no
  way to.
- **Thirty-two scaffold templates** (`plugin/skills/setup/templates/`, 124K) are copied by a pinned
  Haiku agent with a placeholder table. Five are byte-copies of the governance packages' own templates,
  held in sync only by a drift check. `agents/rules/governance.md` is `norm` — promulgation overwrites
  it — and was measured divergent in three of three repositories before the boundary existed; it is a
  static file describing the lifecycles of whichever types happen to be activated. A template that no
  governance owns has no version, no migration note and no ownership entry of its own: it is the next
  legacy file.
- **Four shell scripts** (598 lines) ship in the plugin: two hook scripts (`plan-progress-nudge.sh`,
  `session-state-cleanup.sh`) — the two of nine registrations that still call `sh` — the helper the
  nudge calls (`scripts/session-touched-repos.sh`), and `license-setup/get-license.sh`, which fetches
  and verifies a licence text against the registry that already lives in `governance-license`.
- **Eight more files** under `license-setup/templates/` (NOTICE and AUTHORS templates, a header-check
  script, two CI workflows, two rules documents) are written into repositories by the `license-setup`
  skill and belong to no package.
- **One pinned agent**, `scaffolder`, exists only because the copy-and-substitute step had no
  deterministic surface; ADR-0013 records the policy under which a plugin may pin a model, and the
  scaffolder is its one instance.
- **The rule already has two exceptions inside the packages**: `governance-license` and
  `governance-classification` ship files into repositories (a licence text, the classification policy)
  and carry no `ownership.json` fragment.

The direction was set by the maintainer on 2026-09-06: the plugin depends on the CLI, the CLI is
self-sufficient wherever it can be, and the plugin is the binding of the CLI into one agent host. The
CLI receives everything that is operation.

## Specification

### 1. The rule

A file this tooling writes into a repository, or a policy a skill applies before writing one, is owned
by exactly one governance package. Ownership means the package ships it under a version, names it in its
`ownership.json` fragment, carries its migration notes, and serves it through the CLI (`vibe-ops records
norm --type <type> --facet <facet>`). A file with no owner is not shipped.

For a package that keeps no records — a licence, a policy, a style — ownership means the same four
things minus the record: it ships a fragment naming every file it writes into a repository, and no
fragment when it writes none. `governance-license` and `governance-classification` are the test case
and gain a fragment under this rule; `governance-license` also takes over what the `license-setup` skill
ships today — the NOTICE and AUTHORS templates, the header-check script and its two CI workflows, the
two rules documents — as its scaffold contribution, and `get-license.sh` becomes two verbs on the
`license` noun, `license get <id>` and `license verify <file>`, over the registry the package already
carries.

### 2. Three governance types

| Type | Owns | Replaces |
|---|---|---|
| `style` | the authoring style skills apply when they write into a repository (`authoring-style@2` today); **composed**: a repository binds `types.style` to an ordered stack of style packages, each optionally scoped to named artefacts, and the skills read what the stack resolves to for the artefact they are writing (§2.1) | `plugin/references/authoring-style.md` |
| `instructions` | the instruction surface — `AGENTS.md`, its `CLAUDE.md` import, the `.agents/` ↔ `.claude/` bridge, `repo-guardrails.md`; its policy (`instruction-surfaces@1`) and its scaffold files (`root/CLAUDE.md`, `agents/rules/repo-guardrails.md`, `agents/skills/.gitkeep`); the `agents-md` ops stays its sensor, composing gates from `vibe-ops-gates` as today | `plugin/references/instruction-surfaces.md`, three scaffold files |
| `knowledge` | what a piece of work taught, as two units in one package: `log` (`project/log/`, a trap addressed by path — the type, noun, template, migrations, fragment and `lint`/`index` verbs unchanged) and `learning` (`project/learnings/`, a fact that holds beyond one repository, opt-in); the promotion test (`knowledge-lifecycle@1`) as the package's policy | `governance-log` (the package; the `log` type survives), `plugin/references/knowledge-lifecycle.md` |

**The type manifest grows to admit these.** `parseTypeUnit` today refuses a manifest without
`template`, `authoring` and `migrations`, and reads absent `dirs` as `project/<type>`; `style` and
`instructions` keep no records. The manifest makes `template` and `dirs` optional and adds `facets`,
a map of named policy files the package serves; `records norm --facet template` on a type without one
refuses, naming the type as policy-only. A style package's manifest adds one field of its own, `targets`,
the documented list of artefacts it ships a fragment for — advisory, per §2.1. `schema` absent already derives no entry (the existing
precedent, `governance-license`).

**`knowledge` is one package shipping two units, not a renamed `log`.** A package exports one unit
today (`activateGovernance` matches `unit.type` and caches by package name; `#type` only renames the
local key), so "absorbing" needs a mechanism: the manifest may declare `units: [...]`, each a full type
unit, and activation is cached by `package#type`. `log` keeps its type name, its noun and MCP tool,
its settings keys and its fragment's globs — the stability ADR-0019 promised holds — bound by default as
`log: "@entelekheia/governance-knowledge#log"`; `learning` is the second unit, **not** in the default
bindings, because a learning is by policy a fact that holds beyond one repository and a repository that
stands alone has none (this one has none). `governance-log` retires as a package, not as a type. This
widens RFC-0003's and ADR-0019's "one artifact, one package" to "one artifact, one unit; a package may
ship several units", and the acceptance of this RFC carries a successor ADR saying so.

**`instructions` ships policy and scaffold files, never gates.** Gates are resolved from
`@entelekheia/vibe-ops-gates` alone (RFC-0001; `cli/AGENTS.md`), and the `agents-md` ops keeps
composing them — seven entries over five gates, three of which read the plugin's own surface and stay
where they are. The package owns what the ops reads about: the surface's policy and its scaffold.

#### 2.1 `style` composes in layers, scoped per artefact

`style` is the only type a repository is expected to replace, and replacement is rarely total: a
repository wants the default voice for most of what it writes and a different one for a plan, a task or a
private research note. So the binding is an **ordered stack**, each layer a package named for the voice it
carries and optionally scoped to the artefacts it applies to. Serving is per artefact — a skill about to
write a plan asks for the style of a plan.

```ts
// vibeops.config.ts — short form
export default {
  types: {
    style: [
      "@entelekheia/governance-style",       // unscoped: every artefact
      "@danilo/style-conciso/{plan,task}",   // only a plan or a task
      "@samuel/style-explicativo{^rfc}",     // every artefact except an RFC
    ],
  },
};
```

```ts
// full form — when a collision needs a decision
    style: {
      layers: [
        "@entelekheia/governance-style",
        { use: "@danilo/style-conciso", scope: "{plan,task}" },
        { use: "@samuel/style-explicativo", scope: "{^rfc}", on: "append" },
        { use: "@samuel/style-formal", rules: { voice: "append" } },
      ],
      onCollision: "warn",                   // "error" | "warn" (default) | "off"
    },
```

**A package is a directory of fragments, one file per target.** `general.md` holds what applies to every
artefact; `<target>.md` holds only that target's delta. Both are ordinary Markdown, and a package of one
`general.md` is valid — that is the single-file output-style shape this borrows from.

**The merge unit is the section, not the file.** Serving `--for plan` concatenates, in layer order, each
applicable layer's `general.md` followed by its `plan.md`; a section whose key repeats one already present
replaces it, and a new key is appended. A section's key is its heading slug by default, or an explicit key
when two authors name the same rule differently. A published package should carry explicit keys: a
repository's `rules` entries reference them, and a renamed heading stops matching in silence.

**Resolution is the composer's decision, never the author's.** Only the repository sees two layers at
once, so `on: "append"` (sum instead of replace) and the per-key `rules` map live in the binding. What the
package author owns is the key.

**A collision nobody declared is reported, never fatal.** `onCollision` defaults to `warn`; `error` is for
a repository that wants its stack proven disjoint, `off` for one that stacked deliberately. A collision
resolved by `on` or `rules` was chosen, and is silent. Two cases sit outside it: a `<target>.md` overriding
its own package's `general.md` is intentional by construction, and
`records norm --type style --facet policy --for <target> --explain` prints each section's origin package
and file, so a surprising style is traced without opening a package.

**The target vocabulary is soft.** A style package may declare `targets` as documentation, and every
activated type name is always valid; an undeclared target is served with a warning, never refused. `plan`
and `task` are types, while `readme`, `agents-md`, `research-private` and `research-public` are not, and
that set grows faster than any package can ratify. A caller passing no `--for` receives the unscoped
layers alone.

### 3. Where each remaining reference goes

| Reference | Destination | Facet it becomes |
|---|---|---|
| `convergence-policy@2` | `governance-base` | `policy/convergence` — every target-state skill applies it |
| `template-shape-change@1` | `governance-base` | `policy/migration` — migration mechanics shared by every type |
| `exposure-contract@1` | `governance-classification` | `policy/exposure` — the `exposure` ops already enforces it |
| `harness-model@1`, `harness-pair@1`, `ownership@3` | the `harness` package | served by `harness` as `model`, `pair`, `ownership`; they describe the harness itself, and `ownership.json` already lives there |
| `README` | none | the directory goes with its contents |

Each keeps its `vibe-ops-reference: <name>@N` stamp and its version history. `records norm` gains one
facet member, `policy`, and a `--name` flag selecting which of the package's `facets` to serve — not a
slash grammar; `NormFacet` stays a closed enum. A skill reads
`vibe-ops records norm --type base --facet policy --name convergence --print` where it read a plugin path.
The `references-completeness` fragment, which today skips when `plugin/references/` is absent, becomes a
gate over every activated package's `facets`: each still declares `vibe-ops-reference: <name>@N`.

### 4. The scaffold is a composition

`vibe-ops setup scaffold <shape> <target>` writes, for every activated governance, that package's
`scaffold/` contribution — files plus the placeholders it declares — and the harness's own files through
`vibe-ops harness install`. The five record templates come from the packages that own them (no copies);
`project/<type>/.gitkeep` comes from each type's `dirs`; `agents/rules/governance.md` is **rendered**
from the activated types, not copied — which needs a manifest field no `type.json` carries today:
`lifecycle` (the status chain, what is immutable and when, the living sections, the archival directory),
versioned like the rest, replacing the chain `governance-plan` holds in TypeScript. `GOVERNANCE.md` is
rendered the same way, and is **`shaped`** rather than `norm`: the tooling owns the rendered lifecycle
sections and rewrites them on promulgation, the repository owns every other section permanently. That is
the class that lets one file be both current with the activated types and a place to write. When both
render, `35-dogfooding-drift` has no pair
left — its seven pairs are the five record templates plus those two files — and is retired rather than
kept. The placeholder table is data in each package; the substitution is one function. The `scaffolder`
agent retires: there is nothing left for a model to copy. ADR-0013 stays as the policy under which a
plugin may pin a model, its one instance gone.

| Scaffold group | Owner |
|---|---|
| `harness/check.sh`, `harness/checks/_run.sh`, `harness/githooks/pre-commit`, `github/workflows/check.yml` | `harness` |
| `pkg/*.json`, `root/editorconfig`, `root/gitignore` | `governance-base` (`seed`) |
| `root/README.md` | `governance-base` (`seed`) |
| `root/GOVERNANCE.md` | `governance-base`, rendered from every activated type's `lifecycle` (`shaped`) |
| `docs/**/README.md` | `governance-base` (`seed`) |

### 5. The scripts become hook surfaces

`plan-progress-nudge.sh` becomes `vibe-ops hook plan-progress`; the handler is exported by
`governance-plan` (it is about plans) and dispatched by the CLI's `hook` namespace — which answers
Plan-033's open question of what a package exports for a hook: a handler, not a script.
`session-state-cleanup.sh` becomes `hook session-cleanup` and the touched-repositories helper a function
of the CLI. The host-specific inputs the nudge reads today — the session transcript path, the plugin
data directory — are passed by the binding on the payload, never resolved by the CLI. `hooks.json` then
names `vibe-ops` on nine of nine registrations, and the plugin ships no script. The behaviour test that
exists for the nudge keeps running against the CLI surface.

### 6. What the plugin keeps

The skills (judgement and orchestration; every deterministic step already calls a verb), the two
read-only agents (`governance-auditor`, `migration-rehearser`), `hooks.json`, and the manifest. A second
binding for another agent host ships the equivalent of those and nothing else.

### 7. Compatibility

- A repository keeps working with no change: the default bindings gain `style` and `instructions`,
  and `log` rebinds to `@entelekheia/governance-knowledge#log` — the same type name, served by the new
  package through the multi-unit mechanism above; `learning` is bound only where a repository declares it.
- `vibe-ops-reference` stamps survive in the facets, so a closure that recorded the policy version it
  applied still names a version that exists.
- `35-dogfooding-drift` retires with its last pair; `references-completeness` becomes the facet gate.

## Rationale

**Keeping the references in the plugin** was rejected: a second binding would copy prose that the first
binding reads live, and the copy is the one that drifts. **One base package for every reference** was
rejected: it makes `authoring-style` unreplaceable, and it puts the exposure contract beside the
convergence policy where a repository binding only `classification` would still receive both. **Keeping
the scaffold as a plain copy step, moved to the CLI** was rejected: it fixes the pinned agent and leaves
the ownership gap — a copied file still has no version and no migration note. **A `docs` governance for
the Diátaxis skeleton** was rejected: four `README.md` stubs have no status chain, no migration and no
record to govern, so they are `seed` in the base; the type is what to write later if a quadrant ever
becomes a record, and `style` already covers *how* each is written.

**One style package answering alone** was rejected once the replacement case was stated concretely. A
repository does not want a different style, it wants a different style *for some artefacts* — a concise
plan and an explanatory public research note, over one shared base. With a single package that costs a
copy of the base per variation, and the copy is what drifts. The layered stack pays for that with a merge
rule, and §2.1 keeps the rule to one sentence — the section is the unit, the last layer wins — with the
judgement (`on`, `rules`, `onCollision`) held by the composer, who is the only party that sees two layers
at once. **Failing on an undeclared collision** was rejected in the same breath: it turns assembling a
stack into a round of errors, and a stack that warns is one a repository can run today and tighten to
`error` when it wants the disjointness proven.

## Implementation Notes

*Cut into a plan after acceptance; the order below is the dependency order.*

1. `records norm` gains the `policy` facet; `governance-base` receives `convergence-policy` and
   `template-shape-change`; `governance-classification` receives `exposure-contract`; `harness` serves
   `model`, `pair`, `ownership`. Skills repoint. `plugin/references/` empties.
2. The manifest: `units`, optional `template`/`dirs`, `facets`, `lifecycle`; activation cached by
   `package#type`; the successor ADR to ADR-0019.
3. `governance-knowledge`: the package with units `log` (moved whole from `governance-log`) and
   `learning`, `knowledge-lifecycle` as policy; `governance-log` retired with a supersession pointer;
   `governance-license` and `governance-classification` gain fragments, `license` gains `get`/`verify`
   and the `license-setup` scaffold files.
4. `governance-style`: the type, the default package (`general.md` plus a fragment per target it
   documents), `types.style` in the default bindings, and the composition §2.1 specifies — the stack
   binding in both forms, the scope grammar (`/{a,b}` and `{^a}`), the section-keyed merge, `--for` and
   `--explain` on `records norm`, `on`/`rules`/`onCollision` on the binding. The four authoring skills
   read it through the CLI, each naming the target it is writing.
5. `governance-instructions`: the type, its scaffold files, `instruction-surfaces` as policy.
6. `setup scaffold` and `harness install`, `agents/rules/governance.md` and `GOVERNANCE.md` rendered
   from `lifecycle`; the `scaffolder` agent retired; `35-dogfooding-drift` retired with its last pair.
7. The hook surfaces; `hooks.json` names `vibe-ops` nine times; the plugin ships no script.

## Open Questions

None. The five this RFC carried in Draft were closed on 2026-09-08 and are recorded below.

One thing is deliberately deferred rather than open: a style layer is a package here, so the two-author
case (`danilo-styles` beside `samuel-styles`) needs each published. [RFC-0006](0006-the-repository-as-a-source-of-vibe-ops-units.md)
would let a layer be a local directory instead. Nothing in §2.1 depends on it — a layer is a specifier,
and RFC-0006 adds a source for specifiers — so the two land independently.

## Decisions Closed

- **`knowledge` absorbs `log`** — one type for what work teaches: the log is in-repository (a trap at a
  path), the learning is outside it (a fact that holds beyond one repository); both pass the same
  promotion test. Maintainer decision, 2026-09-06.
- **`style` is a swappable governance type**, not a facet of the base: an operator replaces it the way
  an output style is replaced. Maintainer direction, 2026-09-06.
- **The scaffold is composed from the activated governances**, never a template directory of its own:
  a template with no governance is the next legacy file. Maintainer direction, 2026-09-06.
- **Gates stay in one package.** `instructions` ships no gate; the `agents-md` ops composes from
  `vibe-ops-gates` as RFC-0001 says. Closed at the first adversarial review, 2026-09-06.
- **`knowledge` is a two-unit package, and `log` keeps its name.** A rename would break the stability
  ADR-0019 promised (noun, MCP tool, settings keys, fragment globs); the multi-unit manifest is the
  mechanism, with a successor ADR. Closed at the first adversarial review, 2026-09-06.
- **The `self` ops is `for-vibe-ops`** — the checks that only make sense in the norm's own repository;
  renamed 2026-09-06 so a consumer does not read it as "check yourself".
- **`style` is an ordered stack of scoped layers**, not one package: what a repository actually wants is a
  different voice per artefact over a shared base, and a single package would charge a copy of the base per
  variation. Maintainer decision, 2026-09-08.
- **A style package is fragments by target; the merge unit is the section.** `general.md` plus
  `<target>.md` is how an author organises, and the section (keyed by heading slug, or an explicit key) is
  how the CLI merges. The two are separate axes on purpose: files make a package readable, sections make a
  variation cost only its delta. Maintainer decision, 2026-09-08.
- **The composer resolves collisions, not the package author.** Only the repository sees two layers at
  once, so `on: "append"` and the per-key `rules` map live in the binding. Maintainer correction,
  2026-09-08.
- **An undeclared collision warns by default, and the severity is the repository's** — `error | warn |
  off`. Nothing about composing a style stack fails a run. Maintainer decision, 2026-09-08.
- **The target vocabulary is advisory.** A style package documents its `targets`, activated type names are
  always valid, and an undeclared target is served with a warning — because the artefacts that are not
  types (`readme`, `research-private`, `research-public`) outgrow any list a package can ratify.
  Maintainer decision, 2026-09-08.
- **`GOVERNANCE.md` renders from `lifecycle` and is `shaped`** — the tooling owns the rendered lifecycle
  sections, the repository owns the rest of the file permanently. This is what lets both governance
  documents render, which retires `35-dogfooding-drift` with its last pair. Maintainer decision,
  2026-09-08.
- **The Diátaxis `docs/` skeleton is `seed` in `governance-base`**, not a `docs` type: four stubs have no
  status chain and no record to govern. Maintainer decision, 2026-09-08.
- **The successor ADR to ADR-0019 is written with the plan's first track**, not at acceptance, so it
  records the mechanism that was built rather than the one intended. Maintainer decision, 2026-09-08.

## Related

- [RFC-0003](0003-a-governance-type-as-a-pluggable-unit.md) — a governance type as a pluggable unit.
- [RFC-0004](implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md) — the managed
  layer `setup scaffold` writes `types` into.
- [ADR-0013](../adr/0013-the-model-a-shipped-plugin-may-pin.md) — the pin this RFC retires.
- [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md) — activation is
  the config.
- [Plan-033](../plans/shipped/033-one-artifact-one-governance.md) — the rule this RFC extends past
  records.
- [RFC-0006](0006-the-repository-as-a-source-of-vibe-ops-units.md) — a local source for units, which is
  how a style layer exists without being published.
