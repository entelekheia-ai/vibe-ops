# Promulgate the norm into a repository

**Goal:** bring a repository to the version of the governance norm you have installed, without disturbing
anything anyone is working on there, and without anything landing on a shared branch until a human decides
it should.

`vibe-ops harness sync` produces **a branch and a tag, and stops.** It does not merge and it does not
push. That is not caution for its own sake: merging is a judgement about timing that belongs to whoever
works in that repository, and a branch is reviewable as an ordinary diff, which a direct write never is.

Before starting, know what the three ownership classes mean —
[what the norm owns](../explanation/what-the-norm-owns.md). Everything below assumes that vocabulary.

**Where the norm comes from.** Since Plan-033 the norm is carried by the activated governance packages
(`@entelekheia/governance-<type>`, resolved through your `vibeops.config` `types` bindings or the shipped
defaults) — so an npm-only install promulgates without any Claude plugin present. A repository that pins
an older tree (`harness.source`, `--source`) is served **that tree whole**: its templates under its
declaration, never blended with the packages, because one run promulgates one norm.

## 1. Look before you write

```bash
vibe-ops harness resolve ../some-repo    # which harness surfaces exist there
vibe-ops harness status  ../some-repo    # which record types are behind, if it has been promulgated before
vibe-ops harness sync    ../some-repo --dry-run
```

`--dry-run` reports what would be written, what would be seeded, and what would be refused. It creates no
branch and touches nothing.

Read the refusals now rather than after. There are three kinds and they mean different things:

| Line | Meaning | What to do |
|---|---|---|
| `REFUSED … (seed → norm)` | the boundary widened and this clone has not agreed | §4 |
| a path the declaration does not classify | the declaration has not been extended to cover it | extend `ownership.json`; absence is not permission |
| `SWALLOWED …` | a path was written and the clone's ignore list ate it | §3 |

## 2. Run it

```bash
vibe-ops harness sync ../some-repo
```

It confirms first — the verb is `destructive`, so a terminal prompts and an MCP caller must send
`confirm: true`. Then:

1. it creates a **linked working tree of its own**, on a new branch cut from the target's current branch
   (`--base <branch>` to cut from another);
2. writes only paths classed `norm`, plus `seed` paths that are absent;
3. verifies what actually reached the index;
4. commits, tags `vibe-ops/norm@<n>`, and removes its working tree.

Your target's checkout is untouched throughout — uncommitted work, current branch, everything. There is
nothing to stash and no interrupted run that leaves your edits somewhere you did not put them.

Then review it like any other change:

```bash
git -C ../some-repo diff main vibe-ops/norm-1
git -C ../some-repo merge vibe-ops/norm-1     # when you decide, not before
```

## 3. When it says a path was swallowed

```
SWALLOWED project/templates/plan.md — .git/info/exclude:1:project/templates/	project/templates/plan.md
```

This is the failure the verb is built around, and it is worth understanding rather than working around.

A linked working tree **shares the repository's internal git directory**, so that clone's ignore list
applies inside it — including `.git/info/exclude`, which is not in the repository and which nobody
remembers. Nothing already tracked is at risk, because an ignore rule cannot reach a file the index knows.
Every *new* file is: `git add` on an ignored path succeeds, stages nothing, and mentions it only as a
hint. **The default failure here is a branch that looks complete.**

So the run exits non-zero and names the rule — file, line and pattern — because "it was ignored" would
leave you grepping four possible ignore files, one of which is not in the repository at all.

Fix the rule, then re-run. Narrow it to the file it was written for rather than deleting it: an entry that
names a whole directory in order to hide one file inside it is exactly how this happens.

## 4. When it says the boundary widened

```
REFUSED .agents/rules/repo-guardrails.md (seed → norm) — it now declares its own version
```

A file this repository owned has become one the tooling overwrites. Nothing has been written. Read the
paths named, decide whether you accept losing your local version of each, and then:

```bash
vibe-ops harness sync ../some-repo --accept-boundary 2
```

That records the agreement in that clone, so later runs are silent. Do not reach for it reflexively — the
whole reason the run stopped is that this is the one direction that takes something away from you.

## 5. Record what you applied

`sync` writes `vibeops.config.local.json` in the target: the machine's own config layer, holding which
version of the norm was promulgated there. It is gitignored, and it is what makes
`vibe-ops harness status` and the session-start signal able to answer "is this repository current?"
without reading every file.

Do not hand-edit it. Do not commit it.

## Common questions

**Can I promulgate into several repositories at once?** Not in one invocation — the module is handed
exactly one repository. Loop over them; each produces its own branch and tag.

**What if the target has no norm files yet?** Then everything is a `seed` write and the branch is the
scaffold. There is no separate "first time" mode.

**Does it need a remote?** No. Nothing is pushed.

**Can I undo it?** Delete the branch and the tag. Nothing else was touched.

## Related

- [What the norm owns](../explanation/what-the-norm-owns.md) — the four classes and the boundary.
- [How to bring a repository up to a newer norm](upgrade-a-repository.md) — when records already exist and
  need migrating first.
- [`harness`](../../cli/packages/harness/README.md) — every verb and flag.
