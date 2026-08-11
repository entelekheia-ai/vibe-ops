---
vibe-ops-template: log@2
name: scaffolding-a-repo-gate-after-the-scripts-split
description: The harness runner this repository ships still resolves a sibling vibe-ops checkout at
             ../vibe-ops/scripts/check-agents-md.sh, which moved to cli/packages/module-check/sh/ — so a
             repo scaffolded today gets a gate that refuses every commit, and the third fallback via
             CLAUDE_PLUGIN_ROOT can no longer reach the runner at all.
kind: debt
path:
  - "plugin/skills/setup/templates/harness/checks/_run.sh"
attempted: 2026-08-11
source: Plan-012 Track 3, found while committing RFC-0002 into a consuming repository
---

# The shipped harness runner points at a path that moved

## What was attempted

Committing a governance record into a repository whose gate was scaffolded from this plugin. The commit
was refused before any check ran:

```text
no governance runner found.
Expected a snapshot at <root>/scripts/check-agents-md.sh, a sibling checkout at
<root>/../vibe-ops/scripts/check-agents-md.sh, or CLAUDE_PLUGIN_ROOT pointing at the plugin.
```

## What happened

The runner moved. `scripts/check-agents-md.sh` became
`cli/packages/module-check/sh/check-agents-md.sh` when the CLI was split out, and `resolve_runner` in the
**shipped template** was not updated with it. The consuming repository is not stale — the mould is.

Two of the three resolution branches are affected, and the second one is worse than it looks:

- **The sibling branch** (`$root/../vibe-ops/scripts/check-agents-md.sh`) names a path that no longer
  exists. This is the branch the workspace standard actually relies on: repositories here are wired to a
  shared checkout rather than to a snapshot, so it is the only branch most of them have.
- **The `CLAUDE_PLUGIN_ROOT` branch cannot be repaired by editing a path.** The runner now lives under
  `cli/`, which is not inside the plugin — `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin's install cache,
  and no path under it reaches the CLI at all. That branch is dead by construction, not by drift.

The workspace root's own copy of `_run.sh` was corrected when the split happened; the template that
produces every other copy was not. So the fix landed exactly once, in the one place that did not need to
travel.

## Why it is not caught

`35-dogfooding-drift.sh` compares this repository's copy of a file against the copy it ships, and it
catches a one-sided edit precisely because both sides exist. This pair is not on its list — and it could
not be, in the same shape: the root's `_run.sh` resolves the runner as a **child** (`vibe-ops/cli/...`)
because the runner lives inside the workspace, while a consumer's resolves it as a **sibling**. The two
files are correct and different, so byte comparison is the wrong instrument here.

What would catch it is a check that the paths a shipped template *names* exist relative to something —
which is what `70-plugin-root-paths.sh` already does for `${CLAUDE_PLUGIN_ROOT}` references, and does not
do for a bare relative path inside a shipped script.

## Left open deliberately

Not fixed on 2026-08-11: it is not Plan-012's subject, and the maintainer chose `--no-verify` for the one
commit that hit it rather than widening that work. Recording it so the next person meets a note instead of
the error.
