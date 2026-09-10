# @entelekheia/governance-style

## 0.3.0

### Minor Changes

- b542c32: A style package's fragments are read from `<package>/style/`, not from the package root

  `general.md` and `<target>.md` now resolve as `style/general.md` and `style/<target>.md`, through a
  case-exact directory read rather than `existsSync`. At the root, `readme.md` occupied `README.md` on any
  case-insensitive filesystem (APFS, NTFS), so a package targeting `readme` could not document itself — and
  the existence test answered true for either spelling, serving a package's own README as its `readme`
  fragment. See ADR-0022.

  **Breaking for style packages.** A package still shipping fragments at its root contributes nothing;
  there is no fallback, because the layout it would fall back to is the one that cannot be trusted. Move
  `general.md` and each `<target>.md` into `style/`, and add `"style"` to the package's `files`.

  `@entelekheia/governance-style` is migrated and now ships a README of its own.

  `vibe-ops-cli` and `module-records` take the same bump rather than the patch a dependency rewrite would
  give them: the CLI is the globally installed surface, and a user reading a patch bump would take it and
  silently lose an externally authored style layer.

  A layer with no readable `style/` is now reported as a warning, so an unmigrated package says so instead
  of composing nothing. The warning arrives with the new CLI, so a package migrated before that CLI is
  installed loses its layer in the meantime, quietly — migrate the reader first.

### Patch Changes

- Updated dependencies [b542c32]
  - @entelekheia/governance-base@0.3.0

## 0.2.0

### Minor Changes

- cd42823: `style` is the one type whose `types.<name>` binding is a stack, not a single package — RFC-0005 §2.1,
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

### Patch Changes

- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [c3741f0]
  - @entelekheia/governance-base@0.2.0
  - @entelekheia/vibe-ops-core@0.2.0
