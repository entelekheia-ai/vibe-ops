---
vibe-ops-template: log@2
name: the-gate-on-path-is-not-the-gate-in-this-tree
description: A branch that retires a check still fails its own pre-commit, because the hook runs the
             `vibe-ops` on PATH and that install composes its own bundled ops, not this checkout's.
kind: trap
path:
  - ".githooks/pre-commit"
  - "cli/packages/harness/scaffold/checks-run.sh"
  - "cli/packages/ops-*/ops.json"
attempted: 2026-09-09
source: Plan-040, closing Track 6
---

# The gate your commit runs is the CLI on PATH, not the one in the branch you are editing

> **Not current truth.** This records what was attempted on 2026-09-09 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Committing a branch that had retired an ops entry — `dogfooding-drift`, deleted along with the template
pair it compared — and trusting the pre-commit hook's verdict on whether the tree was clean.

## What happened

The hook reported `49 checks, 1 failed` with seven findings, all from the retired entry, each saying
`… is named but not there — the comparison could not be made`. Running the gate from the checkout
reported `49 checks, 0 failed` on the identical tree.

Both numbers are correct. The entry exists in one composition and not the other:

```
grep -c dogfooding cli/packages/ops-mirror/ops.json                          → 0
grep -c dogfooding <global>/vibe-ops-cli/node_modules/.../ops-mirror/ops.json → present
```

`.githooks/pre-commit` sources `scripts/checks/_run.sh`, which runs `vibe-ops check` — resolved from
`PATH`, by design and with no fallback. So the composition comes from whatever is installed, while the
population comes from `$ROOT`, the branch being edited. Every finding above is literally true about this
repository and describes a check this repository no longer has.

## The mechanism

Established. The ops collection is data inside the installed package (`ops.json`), not something read
from the repository under test. An install predating a branch that changes what is composed will compose
the old set against the new tree. The same shape as the already-recorded trap that the global install is
patched by hand — but a different cause, and this one needs no hand-patching to appear: an ordinary
`npm i -g` from an older commit is enough.

## What to do instead

Run `node cli/packages/cli/src/bin.ts check .` from the checkout whenever the branch changes what is
composed — an ops entry, a gate, a fragment. That is the authoritative reading for that tree.

Commit with `--no-verify` while such a branch is open, and say in the commit message that you did and
why. Do not "fix" the findings: they are about a check that is gone.

After merging, reinstall from the checkout — `npm link -w @entelekheia/vibe-ops-cli` — so the hook and
the tree agree again. Until then the disagreement is expected, and its size is the diff of the ops
collections, nothing more.
