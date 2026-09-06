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
| Status | Draft |
| Created | 2026-09-06 |
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
three governance types are added (`style`, swappable like an output style; `instructions`, the
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
| `style` | the authoring style skills apply when they write into a repository (`authoring-style@2` today); **swappable**: a repository binds `types.style` to another package, and the skills read whichever is bound | `plugin/references/authoring-style.md` |
| `instructions` | the instruction surface — `AGENTS.md`, its `CLAUDE.md` import, the `.agents/` ↔ `.claude/` bridge, `repo-guardrails.md`; its policy (`instruction-surfaces@1`) and its scaffold files (`root/CLAUDE.md`, `agents/rules/repo-guardrails.md`, `agents/skills/.gitkeep`); the `agents-md` ops stays its sensor, composing gates from `vibe-ops-gates` as today | `plugin/references/instruction-surfaces.md`, three scaffold files |
| `knowledge` | what a piece of work taught, as two units in one package: `log` (`project/log/`, a trap addressed by path — the type, noun, template, migrations, fragment and `lint`/`index` verbs unchanged) and `learning` (`project/learnings/`, a fact that holds beyond one repository, opt-in); the promotion test (`knowledge-lifecycle@1`) as the package's policy | `governance-log` (the package; the `log` type survives), `plugin/references/knowledge-lifecycle.md` |

**The type manifest grows to admit these.** `parseTypeUnit` today refuses a manifest without
`template`, `authoring` and `migrations`, and reads absent `dirs` as `project/<type>`; `style` and
`instructions` keep no records. The manifest makes `template` and `dirs` optional and adds `facets`,
a map of named policy files the package serves; `records norm --facet template` on a type without one
refuses, naming the type as policy-only. `schema` absent already derives no entry (the existing
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

`style` is the only type a repository is expected to replace. Its composition is one package, not a
layered overlay: a repository that wants a different style binds a different package, which may itself
import the default's facets. A layered model is an open question below.

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
rendered the same way (recommended; open question). When both render, `35-dogfooding-drift` has no pair
left — its seven pairs are the five record templates plus those two files — and is retired rather than
kept. The placeholder table is data in each package; the substitution is one function. The `scaffolder`
agent retires: there is nothing left for a model to copy. ADR-0013 stays as the policy under which a
plugin may pin a model, its one instance gone.

| Scaffold group | Owner |
|---|---|
| `harness/check.sh`, `harness/checks/_run.sh`, `harness/githooks/pre-commit`, `github/workflows/check.yml` | `harness` |
| `pkg/*.json`, `root/editorconfig`, `root/gitignore` | `governance-base` (`seed`) |
| `root/README.md`, `root/GOVERNANCE.md` | `governance-base` (`seed`; `GOVERNANCE.md` rendered if the open question closes that way) |
| `docs/**/README.md` | open question: a `docs` type, or `governance-base` as `seed` |

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
the Diátaxis skeleton** is undecided rather than rejected: four `README.md` stubs may be too little for a
type, and too much for `seed` in the base.

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
4. `governance-style`: the type, the default package, `types.style` in the default bindings; the four
   authoring skills read it through the CLI.
5. `governance-instructions`: the type, its scaffold files, `instruction-surfaces` as policy.
6. `setup scaffold` and `harness install`, `agents/rules/governance.md` and `GOVERNANCE.md` rendered
   from `lifecycle`; the `scaffolder` agent retired; `35-dogfooding-drift` retired with its last pair.
7. The hook surfaces; `hooks.json` names `vibe-ops` nine times; the plugin ships no script.

## Open Questions

- Whether `style` composes in layers (a repository's package over the default's) or is one package that
  may import the default's facets.
- Whether `GOVERNANCE.md` is rendered from the activated types like `agents/rules/governance.md`, or
  stays a `seed` the repository writes.
- Whether the Diátaxis `docs/` skeleton is a `docs` governance or `seed` in the base.
- Whether `GOVERNANCE.md` and `agents/rules/governance.md` both render from `lifecycle` (recommended
  above), which retires `35-dogfooding-drift`; or only the rule renders and the check keeps one pair.
- The successor ADR to ADR-0019 for "a package may ship several units": written at acceptance, or with
  the plan's first track.

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

## Related

- [RFC-0003](0003-a-governance-type-as-a-pluggable-unit.md) — a governance type as a pluggable unit.
- [RFC-0004](implemented/0004-the-managed-layer-the-configuration-a-tool-writes.md) — the managed
  layer `setup scaffold` writes `types` into.
- [ADR-0013](../adr/0013-the-model-a-shipped-plugin-may-pin.md) — the pin this RFC retires.
- [ADR-0019](../adr/0019-one-artifact-one-governance-package-activated-by-config.md) — activation is
  the config.
- [Plan-033](../plans/shipped/033-one-artifact-one-governance.md) — the rule this RFC extends past
  records.
