---
"@entelekheia/vibe-ops-core": minor
"@entelekheia/governance-base": minor
"@entelekheia/governance-style": minor
"@entelekheia/vibe-ops-module-records": minor
"@entelekheia/vibe-ops-cli": minor
---

`style` is the one type whose `types.<name>` binding is a stack, not a single package — RFC-0005 §2.1,
Plan-040 Track 4. `@entelekheia/governance-style` ships the default layer: `general.md` (moved
byte-identical from `plugin/references/authoring-style.md`, keeping its `authoring-style@2` stamp) plus a
`readme.md` and an `agents-md.md` fragment for the two targets it documents.

`types.style` takes either spelling from the RFC: a short-form array of layers (`"@pkg"`, `"@pkg/{a,b}"`
an include scope, `"@pkg{^a,b}"` an exclude scope) or the long form `{ layers: [...], onCollision }` for a
layer that also needs `on: "append"` or a per-key `rules` map. `core`'s `TypesConfig` widens to admit a
`StyleBinding` under this one key; `effectiveGovernanceBindings` skips it explicitly rather than trying to
parse it as a package name, and the new `activateGovernancePackage` primitive lets a stack layer activate
a package directly, by name, with no `types.<name>` binding to look up.

`@entelekheia/governance-base`'s new `composeStylePolicy` is the whole of the composition: it merges by
SECTION (keyed by heading slug, or an explicit `<!-- key: … -->` marker), a repeated key replaces and a new
key appends, `on`/`rules` are read from the binding and never the package, and a `<target>.md` overriding
its own package's `general.md` is never a collision. `onCollision` (`"error" | "warn" | "off"`, default
`"warn"`) never aborts the composer itself — only the CLI turns `"error"` into a non-zero exit.

`records norm --type style --facet policy [--for <target>] [--explain]` serves it:
`--for` names the artefact (absent serves the unscoped layers alone), `--explain` prints each section's
origin package and file. `--name` is refused on `style` — its binding is a stack, not one named facet.

The four authoring skills (`authoring-agents-md`, `authoring-readme`, `new`, `new-migration`) now read the
style stack through this verb instead of a path under the plugin's own `references/` directory, each
naming the target it writes; every other reader of that path (`new-signal`, `governance-plan`'s own
authoring rules, ADR-0004) repoints the same way.
