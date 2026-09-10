---
"@entelekheia/governance-base": minor
"@entelekheia/governance-style": minor
"@entelekheia/vibe-ops-module-records": minor
"@entelekheia/vibe-ops-cli": minor
---

A style package's fragments are read from `<package>/style/`, not from the package root

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
