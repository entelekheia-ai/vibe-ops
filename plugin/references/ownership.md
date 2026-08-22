---
vibe-ops-reference: ownership@1
---

# Ownership — what promulgation may write, and what it must refuse

Promulgating a version of the norm into a repository is only safe if "the norm" has an edge. Without one,
"bring this repository up to date" is a promise that may overwrite an instruction file someone spent a
month shaping, and the first time it does, adoption ends. This file defines the edge.

The declaration is **composed** since Plan-033: the base half (everything no single artifact owns) is
[`cli/packages/harness/ownership.json`](../../cli/packages/harness/ownership.json), and each
activated governance package ships an `ownership.json` fragment for its own artifact. **Read them. Never decide a path's class
at the call site** — a second opinion formed at the moment of writing is how a boundary erodes, and the
whole value of the declaration is that there is exactly one answer.

## The three classes

| Class | Promulgation | The repository |
|---|---|---|
| `norm` | overwrites it | may not keep a local edit; an edit here is drift to reconcile |
| `seed` | writes it once, when absent | owns it from the moment it exists |
| `repo` | never touches it, and stops if it would | owns it entirely |

`seed` is the largest class and that is the point. Most of what a scaffold produces is a starting shape
whose value is that someone then changes it — a README, a build manifest, a guardrails file that ships
containing a placeholder telling the operator to fill it in. Promulgation being *safe* is mostly a
statement about how little it overwrites.

## The test for placing a new path

Ask these in order, and stop at the first that answers.

1. **Does the file declare a version, or does a migration note exist for changing it?** Then it is `norm`.
   Versioning a file is the act of claiming it; nothing else needs to be argued.
2. **Does the shipped copy contain a placeholder, a TODO, or an instruction to the person receiving it?**
   Then it is `seed`. A file whose shipped content asks to be replaced cannot also be a file this tooling
   overwrites.
3. **Is it something a person wrote, or code that runs?** Then it is `repo`. Records, gate fragments a
   repository added itself, source, tests.
4. **Is it pure mechanism with no content of its own** — a symlink, an import line, wiring that resolves
   everything from the repository root? Then it is `norm`. There is nothing in it for a repository to have
   an opinion about, and a local edit means the mechanism is broken rather than customised.
5. **Still undecided?** It is `seed`. The class that writes once and never again is the one whose wrong
   answer costs least.

### What the test deliberately does not use

**Whether copies are currently identical across repositories.** Sameness is a measurement of the past, and
the class is a statement of authority. Two of these were measured on 2026-08-13 and land on opposite sides
of that distinction: the record-lifecycle rule is `norm` and had diverged in three of three repositories
checked — that divergence is the unreconciled drift this whole plan exists to make visible. Formatting and
exclusion preferences are `seed` and were byte-identical everywhere — which is not authority to overwrite
the first repository that diverges on purpose.

Reading sameness as authority would have inverted both.

## The two rules that are not about classification

**A path with no matching entry is not permission.** Absence means the declaration has not been extended,
and promulgation must report rather than assume. This is why the `repo` class names source and test
directories explicitly even though nothing would ever try to write them: the entry exists so the absence
of one always means the same thing.

**A declared exception is a class, not a gap.** One hook stays out of version control because it dispatches
to a pipeline this tooling does not own and embeds an absolute path for that reason. It is `repo`, with the
reason recorded on the entry. A path that is deliberately untouched and a path nobody has classified look
identical from the outside, and the entry is what separates them.

## When the declaration itself changes

It carries its own version, and the version travels the same way every other version here does. A change
that moves a path from `seed` to `norm` is not a formatting change — it converts something a repository
owned into something this tooling overwrites — and promulgation that reads a newer boundary to decide what
it may overwrite in a repository that agreed to an older one is assuming consent it does not have. That
case is an open question of the plan this file was written for, and it is not answered here.
