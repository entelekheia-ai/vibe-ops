---
"@entelekheia/governance-base": minor
"@entelekheia/governance-classification": minor
"@entelekheia/vibe-ops-harness": minor
"@entelekheia/vibe-ops-core": minor
"@entelekheia/vibe-ops-module-records": minor
"@entelekheia/vibe-ops-module-check": patch
"@entelekheia/vibe-ops-gates": minor
"@entelekheia/vibe-ops-governance": minor
---

`records norm` gains a `policy` facet and a `--name` flag selecting which of a type's `facets` to serve (project/plans/040-*.md Track 1). `NormFacet` stays a closed union.

Five files that used to live under `plugin/references/` move into the governance package whose policy they are, each keeping its `vibe-ops-reference: <name>@N` stamp: `convergence-policy` and `template-shape-change` into `@entelekheia/governance-base` (served as `vibe-ops records norm --type base --facet policy --name convergence|migration`), `exposure-contract` into `@entelekheia/governance-classification` (`--type classification --facet policy --name exposure`), and `harness-model`/`harness-pair`/`ownership` into `@entelekheia/vibe-ops-harness`, served by a new verb on the `harness` noun rather than through the facet grammar — `vibe-ops harness policy --name model|pair|ownership` — because `harness` is CLI-internal and has no `type.json` of its own.

The type-unit manifest (`type.json`) gains an optional `facets` field, a map of policy name to a relative path; a unit that declares `facets` and no record of its own is POLICY-ONLY, and its `template`/`authoring`/`migrations` become optional (every existing manifest keeps the original unconditional requirement — this is a guard, not a relaxation of what a record type already declares). `governance-base` itself is now activatable as the type `base`, bound by default alongside `adr`/`rfc`/`plan`/`task`/`log`, purely for its policy facets — it ships no record.

`records norm` refuses `--facet policy` without `--name`, `--name` on any facet other than `policy`, `--facet policy --name <x>` where the type declares no such facet (naming what it does declare), and `--facet template` on a policy-only type (naming it as such).

`references-completeness` (`cli/packages/module-check/sh/unported/checks/55-references-completeness.sh`, now `@5`) keeps the population it always had — the four record types' authoring rules and `plugin/references/`. The facets are read by a new gate instead, `facet-completeness`, composed into the `governance` ops: it resolves what the repository ACTIVATES rather than walking a path, so a consumer whose facets live inside installed packages is covered where a fragment reading `cli/packages/` would have examined zero files and passed. Zero examined reports SKIP, never a pass.

The manifest relaxation is keyed on a unit carrying NO record field at all, not on it declaring `facets`: a manifest with both — `governance-classification` is one — keeps every field required.
