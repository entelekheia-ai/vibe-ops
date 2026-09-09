---
vibe-ops-reference: records/knowledge@1
---

# Log and learning — what only these two need

This package ships two types with one set of rules, because the rule that matters is the one that
separates them. Both record what the work taught; they differ in **what the fact is true of**.

- A **log entry** (`project/log/`) is true of a *path in this repository*. Someone meets it again by
  opening that file or working in that folder.
- A **learning** (`project/learnings/`) is true of a *language, a tool, a library, or how the maintainer
  prefers to work*. It travels to any repository.

The template's own comments specify each section; this file covers only what they cannot.

## Before writing

Ask one thing, and do not proceed without it: **where does someone meet this again?**

A path or glob inside this repository → a log entry, and that answer is its `path:`. Something with no
path of its own — a package, a CLI, a habit — → a learning, and that answer is its `scope:`.

**Neither answer means neither record.** The field IS the admission test, so a `path:` invented to make
an entry filable is the failure this type is shaped to prevent. What is left is a decision (an ADR), or
nothing at all. Most surprises are nothing at all, and a small `project/log/` is this tier working.

## `kind:` on a log entry

`trap` or `debt`, never invented. A trap says *do not do this again*. Debt says *we know, and we chose
to live with it*. They fire on the same path and say opposite things, so the choice is the user's, not
an inference from the tone of the story.

## Neither type is numbered

The filename is a slug describing what was attempted, and `name:` repeats it so a rename is visible.
`NEXT=` from the resolver is meaningless here — do not derive an id, and do not pad one.

## The section that carries the value

**The mechanism**, on a log entry. *"Not established"* is a legitimate and preferred answer: a mechanism
inferred from the fix working is evidence about the fix, not about the cause, and a confident wrong
mechanism sends the next reader hunting something that was never there.

The equivalent on a learning is **The evidence** — the measurement, the failing command, the source
read. A fact with no evidence is an opinion, and the next reader cannot tell the difference.

## What must not be written

**A reverted attempt that worked is not a failure**, and the difference is the whole warning. Say it
worked and say why it was reverted, or the next reader avoids something that would have served them.

**There is no `status:` field on either type, deliberately.** An entry that retires is deleted and its
row appended to `project/log/RETIRED.md` with a git breadcrumb. A file that exists is current by
definition, so never add a status to carry.

## After writing

Nothing. `source:` points at the task or commit this came from, and **the link is one-way by
construction**: that dossier is deleted at closure, so nothing can point back. Do not add a backlink to
a file that will not exist.

## Checklist additions

- [ ] The type was chosen by where someone meets the fact again, not by the topic
- [ ] `path:` (log) or `scope:` (learning) is populated with a real answer, never one invented to file it
- [ ] `kind:` is `trap` or `debt`, chosen by the user
- [ ] No id derived, no zero padding — neither type is numbered
- [ ] `The mechanism` says "not established" rather than guessing
- [ ] An attempt that worked and was reverted says so
- [ ] No `status:` field added
