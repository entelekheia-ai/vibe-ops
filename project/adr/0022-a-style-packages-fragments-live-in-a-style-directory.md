---
vibe-ops-template: adr@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0022: A style package's fragments live in a `style/` directory

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-10 |
| Deciders | Danilo Borges |

---

## Context

RFC-0005 §2.1 specified a style package as "a directory of fragments, one file per target", and the first
implementation read that directory as the **package root**: `general.md` beside `<target>.md` beside
`package.json`. The convention therefore lets a target's name claim any filename at the root, and one
target's name is already taken.

On a case-insensitive filesystem — APFS and NTFS, which is most development machines — `readme.md` and
`README.md` are the same file. A style package declaring `readme` among its targets could not hold a
README of its own; the shipped `governance-style`, which targets `readme` and `agents-md`, had none. The
collision is structural: it follows from the naming convention, so every style package targeting `readme`
inherits it.

Two costs were measured, both of them silent:

- **A presence check passed on the fragment.** `existsSync(".../README.md")` answers true when only
  `readme.md` exists, while the `**/README.md` glob that gives structural rules their population is
  case-sensitive. The package satisfied presence and disappeared from every structural rule at once — a
  false negative, which by definition reports nothing. It went uncovered through an entire census.
- **Writing the README corrupted the fragment.** A plain write to `README.md` overwrote `readme.md`. The
  index-level workaround that produces two blobs leaves the repository worse off still: `git status`
  reports the path permanently modified, because the index entry is read against a path that resolves to
  the fragment.

The `existsSync` used to resolve fragments is itself part of the fault. It answers on the filesystem's
case-folding, not on what the package actually shipped, so it cannot distinguish the two names even once
they are meant to differ.

## Decision

We will read a style package's fragments from **`<package>/style/`** — `style/general.md` and
`style/<target>.md` — and never from the package root. Resolution is a **case-exact directory read**
(`readdirSync(dir).includes(name)`) rather than an existence test, so `README.md` and `readme.md` stay
distinct even inside that directory and on a volume that folds their case.

The change is a clean break with no compatibility path: a package still shipping fragments at its root
contributes nothing. Serving the old layout would mean serving a `readme.md` that may in fact be a README,
which is the defect being removed.

## Options considered

- **Option A — prefix the fragment** (`style-readme.md`, keeping `general.md`) — one resolution change and
  every filename unambiguous, but the package root keeps mixing shipped content with package metadata, and
  the prefix has to be spelled correctly by every author for the rest of the convention's life. Rejected.
- **Option B — keep the convention, accept that a style package targeting `readme` has no README** — costs
  nothing to implement, and is the weakest: the package is published, so its registry page is the one that
  stays blank, and the `existsSync` false negative survives untouched. Rejected.
- **Option C — move the fragments into `style/`, with a root fallback and a warning** — nothing breaks
  silently, but the fallback re-admits the exact defect for any package that does not migrate, since the
  root it falls back to is where a real `README.md` lives. Rejected.
- **Option D (chosen) — move the fragments into `style/`, clean break, case-exact read** — fixes the one
  target that could not coexist, separates shipped content from package metadata for every other target,
  and removes the resolution call that could not tell the two names apart. Costs a migration for every
  existing style package, which the composer reports as a warning rather than leaving silent.

## Consequences

**Easier.** A style package can document itself; `governance-style` now ships a README, which is what its
registry page renders. A package root holds only metadata, so a target may be named after any file a
repository writes — `agents-md`, `readme`, and whatever a future type adds — without asking whether that
name is already spoken for at the root. The case-exact read makes the resolution independent of the
filesystem the package happens to be installed on, which is the property the old call lacked.

**Harder.** Every existing style package must move its fragments, and an unmigrated one contributes
nothing — the cost of the clean break, accepted because the alternative serves content from a layout that
cannot be trusted. It contributes nothing *loudly*: a layer with no readable `style/` is reported as a
warning, since a silent one is indistinguishable from a layer that had nothing to say for this target. A
warning is a diagnostic, not a fallback, and does not soften the break. Externally authored packages are
the exposed population; the layout is now stated in this package's README and in the authoring guidance
that produces such packages.

**A published reader lags a migrated package.** The composer ships in the CLI, so a package migrated
before the new CLI is installed loses its layer until the two meet. The warning above is what makes that
window visible — but only once the new reader is the one running, which is the window's own limit.

Reading a listing rather than testing each path also removes a path traversal that the old resolution
carried: `--for` is a user-supplied flag, and joining that target onto the package root resolved outside
it for a target containing `..`. A `readdirSync` entry is always a direct child's basename, so a
name carrying a separator now matches nothing.

**Follow-up.** `existsSync` remains the wrong call for testing a filename anywhere this codebase compares
one, and this ADR does not audit the other sites that use it.

## Related

- RFC-0005 §2.1, whose "a directory of fragments" this makes literal rather than a description of the
  package root.
- ADR-0020 — one artifact, one unit, and a package may ship several: the multi-unit packages that make an
  externally authored style layer likely.
