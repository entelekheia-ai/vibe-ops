---
vibe-ops-template: log@2
name: adding-a-second-foundation-package-to-the-cli-workspace
description: A workspace package that other packages import but that sorts after them alphabetically is
             built against its stale dist/ by `npm run build --workspaces`, which typechecks and reports
             success; the fix is a line in build:foundation, and nothing detects the next one.
kind: trap
path:
  - "package.json"
  - "cli/packages/*/package.json"
attempted: 2026-08-10
source: project/plans/011-the-governance-lifecycle-becomes-three-cli-nouns.md (Track 3)
---

# Adding a package that other packages import, whose name sorts after theirs

> **Not current truth.** This records what was attempted on 2026-08-10 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Add `cli/packages/records/`, a package `module-plan`, `module-task`, `module-log`, `module-records` and
`gates` all import, and build the workspace with `npm run build`.

## What happened

The build failed in `module-task` with a type error naming an export `records` had just gained. Building a
second time made it pass. Both are the same defect: `npm run build --workspaces` runs in **directory
order**, `records` sorts after every `module-*`, and each of them typechecked against whatever
`records/dist/` held from the previous build.

The failure mode that matters is not the error. It is the run before it, where `records` had not changed
enough to break a signature and every dependent compiled **against a stale `dist/` and reported success**.

## The mechanism

Established. `npm run build --workspaces` documents no dependency ordering and iterates the workspace
list, which npm derives from directory order. `cli/AGENTS.md` already recorded this for `core` — its
`build:foundation` line exists for exactly this reason, and the note says the false green it prevented
cost three passes in another repository. What was not anticipated is that the fix is **per package, not
once**: `build:foundation` names `core` explicitly, so a second foundation package is a second line, and
a third would be a third.

## What to do instead

Add the package to `build:foundation` in the repository-root `package.json` the moment anything imports
it:

```json
"build:foundation": "npm run build -w @entelekheia/vibe-ops-core && npm run build -w @entelekheia/vibe-ops-records"
```

**Nothing detects the next one.** There is no guard that compares the import graph against
`build:foundation`, so the symptom is a green build that compiled against yesterday's types. Wiping every
`dist/` and building once from scratch is the cheap way to prove the order is right.
