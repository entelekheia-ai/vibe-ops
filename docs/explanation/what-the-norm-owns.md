# What the norm owns, and what your repository owns

Bringing a repository "up to date" is only a safe thing to offer if *up to date* has an edge. Without one
it is a promise that may overwrite an instruction file someone spent a month shaping — and the first time
it does, nobody runs it again. This page is that edge, in the words a person needs; the machine-readable
declaration is [`plugin/ownership.json`](../../cli/packages/harness/ownership.json) and the rule the agent follows when
extending it is [`plugin/references/ownership.md`](../../plugin/references/ownership.md).

## The vocabulary

Two words get used constantly and mean specific things.

**The norm** is the set of files this tooling is the author of: the governance templates, the record
lifecycle rule, the wiring that composes the commit gate. It is *versioned* — each template declares its
own `vibe-ops-template: <type>@<n>`, and the declaration of who-owns-what declares
`"version"` of its own. "Which version of the norm is this repository on?" is therefore a real question
with a real answer, which is the whole point.

**Promulgation** is the act of writing a version of the norm into a repository — `vibe-ops harness sync`.
Not *installing*, because nothing is downloaded, and not *updating*, because it may write into a
repository that has never seen this tooling at all.

## Three classes, and why there are three

Every path is one of three things. The classification lives in one file so that there is exactly one
answer, and no second opinion gets formed at the moment something is about to be written.

| Class | Promulgation does | Your repository may |
|---|---|---|
| **`norm`** | overwrites it, every time | not keep a local edit — an edit here is drift to reconcile, not a preference |
| **`seed`** | writes it once, only when absent | own it completely from the moment it exists |
| **`repo`** | never touches it, and **stops** if it would have | own it entirely; this tooling has no opinion |

**`seed` is the largest class, and that is the point.** Most of what a scaffold produces is a starting
shape whose entire value is that someone then changes it — a README, a build manifest, a guardrails file
that ships containing a placeholder telling you to fill it in. Promulgation being *safe* turns out to be
mostly a statement about how little it overwrites.

A worked example of each, from the shipped declaration:

- `project/templates/plan.md` is **`norm`**. It declares its own version and every version jump has a
  migration note. Versioning a file is the act of claiming it.
- `AGENTS.md` is **`seed`**. It is authored once against the repository it describes and maintained by
  whoever works there; overwriting it would discard the map it exists to be.
- `project/plans/**` is **`repo`**. The templates are the norm's; what someone wrote from them is not.

## Two rules that are not about classification

**A path with no matching entry is not permission.** Absence means the declaration has not been extended
to cover it, so promulgation reports and stops rather than guessing. This is why the `repo` class names
source and test directories explicitly even though nothing would ever try to write them: the entry exists
so that a *missing* entry always means the same thing.

**A deliberate exception is a class, not a gap.** A path that is intentionally left alone and a path
nobody has classified look identical from outside. The entry, with its recorded reason, is what separates
them.

## When the boundary itself changes

The declaration carries a version like everything else, and this is where it gets subtle.

Suppose a file that was `seed` becomes `norm` — say it starts declaring a version, which under the
classification test makes it the norm's. That is not a formatting change: it converts something your
repository owned into something this tooling overwrites. A promulgation that read the *new* boundary to
decide what it may overwrite in a repository that agreed to the *old* one would be assuming a consent
that was never given.

So `sync` compares the boundary version your clone agreed to against the installed one, and:

- **refuses only the paths whose class widened**, naming each one, both classes, and the declaration's own
  justification for the change;
- **promulgates everything else normally**, because a version bump that only added an entry or reworded a
  reason should not block anything;
- **exits non-zero**, so a partially-refused run cannot be mistaken for a clean one.

You clear it by reading the diff and re-running with `--accept-boundary <n>`, which records the agreement
in that clone so later runs are silent.

**Only widening needs consent.** `norm → seed`, `norm → repo`, `seed → repo` all *reduce* what this
tooling may do, and are applied without asking — refusing those too would block a repository on a change
that made it safer, which is how a gate gets switched off in its first week.

## Why this is a boundary and not a setting

The three classes are not configurable per repository, and that is deliberate. A boundary each repository
can redraw is not a boundary; it is a negotiation that happens at the worst possible moment, when someone
is mid-promulgation and wants the run to finish. What *is* per repository is the version of the boundary
you have agreed to — which is a record of a decision, not a dial.

## Related

- [How to promulgate the norm into a repository](../how-to/promulgate-the-norm.md) — the recipe.
- [How to bring a repository up to a newer norm](../how-to/upgrade-a-repository.md) — when it is already
  on an older one.
- [`plugin/ownership.json`](../../cli/packages/harness/ownership.json) — the declaration itself, with a recorded reason
  on every entry.
