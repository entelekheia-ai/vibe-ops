# @entelekheia/vibe-ops-harness

**Which repositories are on which version of your governance norm — and one command to move them.**
`vibe-ops harness` reads what a repository's guide-and-sensor apparatus actually is, and promulgates a
version of the norm into it without disturbing anything anyone is working on there.

```console
$ vibe-ops harness status ../some-repo
A newer version of the governance templates is installed than was promulgated into this repository:
  - plan: this repository is on plan@2, installed is plan@3
Run /vibe-ops:migrate to bring existing records up to the current template, one recorded jump at a time.
Nothing has been changed — this is a reading, not a repair.

$ vibe-ops harness sync ../some-repo
  norm     project/templates/adr.md
  norm     project/templates/rfc.md
  norm     project/templates/plan.md
  norm     project/templates/task.md
  norm     project/templates/log.md
branch: vibe-ops/norm-1  tag: vibe-ops/norm@1
5 written, 0 seeded on vibe-ops/norm-1 (vibe-ops/norm@1) — not merged, not pushed
```

Every verb takes the repository as its first argument and acts on **that** one, not on the one you are
standing in. Five of the six read and write nothing; `sync` is the only one that writes, and even then it
never touches the target's working tree.

## Install

Part of the `vibe-ops` CLI — see [`cli/README.md`](../../README.md). Nothing to install separately.

```bash
vibe-ops harness resolve ../some-repo   # where its harness surfaces are, and which are absent
vibe-ops harness shape   ../some-repo   # remote, hooks path, CI workflows, churn by top-level directory
vibe-ops harness status  ../some-repo   # which record types are behind the norm you have installed
vibe-ops harness catalog ../some-repo   # gates and fragments this install ships that nothing composes
vibe-ops harness audit   ../some-repo   # guides with their cost, sensors with their lifecycle position
vibe-ops harness sync    ../some-repo   # promulgate: a branch and a tag, never merged, never pushed
```

`--json` returns the structured object instead of lines. Over MCP the structured object is all there is.

## It reads from two places

This is the only module that needs **two** roots: the repository it acts on, and the *norm* — where the
version of the templates and wiring you have installed actually lives. The CLI resolves the second,
most-intentional first:

| Tier | Source |
|---|---|
| 1 | `harness.source` in a `vibeops.config.*` on the cascade |
| 2 | `--source <path>` on this invocation |
| 3 | `CLAUDE_PLUGIN_ROOT`, which the plugin's hook wiring already sets |

**None of the three resolving is not an error.** `status` reports that there is nothing to compare
against — a different answer from "you are up to date" — and `sync` refuses.

## The verbs

**`resolve`** prints `KEY=value` lines for the rules directory, the `.claude/rules` bridge, the commit
hook, the manual entrypoint, the runner, both config files, the machine's state file and the artifact
path. `(none)` for anything absent. The bridge line counts **symlinks, not files**: a repository that
copied a rule instead of linking it has a bridge that no longer tracks its source, which a directory
listing cannot show you.

**`shape`** answers the four facts every recommendation about a repository rests on — whether it has a
remote, where git looks for hooks, which CI workflows exist, and commit churn by top-level directory. No
remote means CI is not available to that repository at all. Churn is the least obvious and most useful: a
repository whose commits are 90% documentation is a governance repository, not an under-tested service.

**`status`** compares what was promulgated into that clone against what your installed norm ships. A
record type absent from the map is **not** reported — never promulgated to and behind are different
states, and only one of them is actionable.

**`catalog`** lists every gate and check fragment your install ships that nothing composes. It is the
complement of "what runs here", and it is what tells you a check you were about to build already exists
and is merely unwired.

**`audit`** reports the measured inventory: guides with an exact line count and an always-on/scoped split,
sensors with the lifecycle position each fires at, and per-type record counts. It reports numbers and
never judges them — `/vibe-ops:setup harness audit` is what applies the model to them.

## `sync` — promulgation

```bash
vibe-ops harness sync ../some-repo --dry-run             # what it would write and refuse
vibe-ops harness sync ../some-repo                       # confirms, then does it
vibe-ops harness sync ../some-repo --base main           # cut from a branch other than the current one
vibe-ops harness sync ../some-repo --accept-boundary 2   # agree to a changed ownership boundary
```

It builds a **linked working tree of its own**, writes only what the ownership declaration marks as the
norm's, commits, tags `vibe-ops/norm@<n>`, and removes that tree. Your target's checkout — branch,
uncommitted work, everything — is untouched. It stops at the branch and the tag: no merge, no push.

On success the promulgation commit itself carries `vibeops.config.json` — the managed layer, holding
which version of each type it applied, the boundary it applied under, and the receipt of the classes the
repository consented to — so `status` answers from the tree once that branch merges. A leftover
`vibeops.config.local.json` from before RFC-0004 seeds that map on the first run and is then deleted.

### Three ways it will refuse, all exiting non-zero

| It reports | What happened | What to do |
|---|---|---|
| `SWALLOWED <path> — <rule>` | the path was written and the clone's ignore list kept it out of the index | narrow the named rule, re-run |
| `REFUSED <path> (seed → norm)` | the ownership boundary widened and this clone has not agreed | read the paths, then `--accept-boundary <n>` |
| a path the declaration does not classify | absence of an entry is never read as permission | extend `ownership.json` |

**The first is the one to know about.** A linked working tree shares the repository's internal git
directory, so that clone's ignore list applies inside it — including `.git/info/exclude`, which is not in
the repository and which nobody remembers. `git add` on an ignored path succeeds and stages nothing, so
what was staged is verified rather than the exit code trusted, and the rule that caught it is named with
its file, line and pattern.

## Requirements

Node ≥ 22.18, and a `git` on `PATH` — `sync` uses linked working trees and annotated tags.

## Learn more

- [Promulgate the norm into a repository](../../../docs/how-to/promulgate-the-norm.md)
- [Bring a repository up to a newer norm](../../../docs/how-to/upgrade-a-repository.md)
- [What the norm owns, and what your repository owns](../../../docs/explanation/what-the-norm-owns.md)

Apache-2.0 — see [`LICENSE`](../../../LICENSE).
