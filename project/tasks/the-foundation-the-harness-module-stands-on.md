---
vibe-ops-template: task@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: The foundation the harness module stands on

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/025-the-harness-module-and-the-norm-it-promulgates.md](../plans/025-the-harness-module-and-the-norm-it-promulgates.md) — Tracks 1, 2 and 3 |

---

## Context

Three tracks of Plan-025 are grouped into this one dossier because none of them is independently useful and
all three are small. Track 1 declares which files the norm owns; Track 2 narrows an ignore rule whose reach
is wider than the one file it was written for; Track 3 adds the clone-local configuration file and the
version map inside it. Every later track in that plan reads at least one of the three.

The ordering that matters is item 1 before everything else: nothing can decide what may be written until
the ownership boundary exists.

**Two surveys changed what item 2 is, and the second one shrank it.** It was first written as extracting a
machine-specific path out of the commit hook. That hook carries no such path — it resolves everything from
the repository root, in every repository checked and in the shipped template; the absolute path belongs to
a *different* hook in the same directory, the one dispatching to the workspace's knowledge pipeline. It was
then rewritten as lifting an exclusion that kept the commit hook out of version control. That was also
false: **the hook is tracked, and an ignore rule has no effect on a tracked file.** What remains is real and
much smaller — a directory-wide rule that will silently swallow the *next* untracked file promulgation adds
there. Housekeeping against a future failure, not a prerequisite for anything here.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | The ownership declaration, and the reference that explains it | M |
| 2 | P1 | Narrow an over-broad ignore rule before it catches an untracked file | S |
| 3 | P0 | Clone-local configuration joins the resolution cascade | S |
| 4 | P0 | The applied-version stamp | S |
| 5 | P1 | A session hook that is silent when the versions match | M |

### 1. The ownership declaration, and the reference that explains it — P0

**What:** a declaration, committed and versioned, partitioning every path this tooling can write into three
classes — owned by the norm and overwritable, owned by the repository and never touched, and seeded once
then owned by the repository forever.

**Why:** without it, "promulgate the norm into a repository" is a promise with no edge, and the first run
that overwrites a hand-edited instruction file ends adoption. It is also the prerequisite RFC-0002 names for
its own central rule, so leaving it implicit blocks a second document.

**Change:** the declaration lives with the distributable rather than with the checks, because it describes
what ships. It is read, never re-derived: a later track that decides for itself whether a path is writable
has reintroduced the problem. Pair it with a reference document stating the three classes and the test for
placing a new path into one of them.

### 2. Narrow an over-broad ignore rule before it catches a file that is not yet tracked — P1

**What:** replace the directory-wide entry in the clone-local ignore list with the single filename that
actually needs excluding.

**Why:** *not* to unblock the commit hook — that hook is already tracked, in all eight repositories
measured, and always was. **An ignore rule has no effect on a file the index already knows**, which is
what makes the original framing of this item wrong twice over. What the over-broad rule actually threatens
is the **next** file: anything promulgation adds to that directory later arrives untracked, is silently
swallowed by the directory-wide rule, and staging it exits successfully having staged nothing, reporting
the fact only as a hint. The rule is a trap laid for future work rather than a live defect.

That reduces this item from a prerequisite to housekeeping, and it is sequenced accordingly — it no longer
blocks promulgation, it removes a way promulgation could fail quietly later.

**Change:** one line in the clone-local ignore list, and no code. The sibling hook that dispatches to the
workspace's knowledge pipeline keeps its own entry and stays clone-local, which is correct rather than a
defect: it belongs to a pipeline this tooling's norm does not own, and promulgating it would put one
machine's directory layout into every clone.

### 3. Clone-local configuration joins the resolution cascade — P0

**What:** add a clone-local, version-control-ignored configuration file as the nearest entry of the existing
configuration cascade.

**Why:** item 4 needs somewhere to put a value that is true of this clone and of no other, and the cascade
already resolves repository-then-upward-then-home. Introducing a parallel mechanism for clone-local values
would be a second place to look for the same kind of answer.

**Change:** the pair is **layered, and the layering repeats at every level of the cascade**. Within one
directory the local file is consulted first and the general file second, with the local winning per key;
directories are then walked nearest to farthest as they already are. That way a general config ships fully
populated and a local file overrides only the few keys it cares about — and the same pair becomes available
in the home directory, which is what the committed config's own comment already asks for when it says
personal preferences belong outside the committed file.

The mechanical trap is that the candidate list is currently resolved first-match-per-directory, so simply
adding the local name to it makes the local file *replace* the general one rather than layer over it. The
resolver must return every match in a directory, ordered local first, and merge them through the existing
merge rule rather than a second one invented here.

Ships with the ignore entry and a committed sample declaring which keys exist. The sample is what makes the
file discoverable; an ignored file with no committed counterpart is invisible to anyone who did not create
it.

### 4. The applied-version map — P0

**What:** store, in the clone-local file, the version of each record type applied to this clone — a map
keyed by record type, not a set of switches and not one aggregate number.

**Why:** it is the whole state the rest of the plan derives from. A stored switch has to be cleared by
someone once the work it announces is done, and a signal that keeps firing after it is satisfied gets
ignored rather than corrected; comparing an applied version against an installed one is self-clearing.

The map is per type because that is the granularity everything else already uses: each template declares
its own version and each version jump has its own migration note, so an aggregate number would need a
translation layer to say anything actionable. And it is **not** duplication of the version each artifact
declares in its own frontmatter — those answer different questions. The map says what was promulgated
here; an artifact's frontmatter says what that artifact was written against. They diverge exactly when an
artifact has not been migrated yet, which is the case worth detecting.

**Change:** one key holding a partial map over the record types the resolver already names. Absence of the
whole map, and absence of one type within it, both mean never applied — a real and different state from
any version, and everything reading it must keep that distinct rather than defaulting to zero.

### 5. A session hook that is silent when the versions match — P1

**What:** a session-start entry in the plugin's hook registration, invoking the CLI by name like the five
entries that already do, comparing the applied version against the installed one.

**Why:** it is the delivery half. The information is useless if it only exists when someone thinks to ask
for it, and the repository that is behind is precisely the one nobody is thinking about.

**Change:** it must fail open — any error is silence, never a blocked session — and it must be cheap, since
it runs on every session in every repository. When it does speak it names the version that arrived, the
migration note that applies, and the command that resolves it; a rare message can afford to be long, and it
is frequency that costs. What it must **not** do in this item is perform any wiring itself: whether a hook
may write into a repository the operator merely opened is an open question of RFC-0002, and answering it
here by accident is the failure to avoid.

## Implementation order

- [x] P0 — Item 1: draft the three-class partition and get the classification of every currently-shipped
      path agreed before writing the declaration file. **Not delegable** — the classification is a judgement
      that has to agree with Plan-025's intent.
- [x] P0 — Item 1: write the declaration and its reference document.
- [x] P0 — Item 3: layer the clone-local file into the cascade, with the committed sample and the ignore
      entry. **Delegable**: may touch the configuration resolution module and its tests, must not change the
      merge rule itself or the directory walk's order, returns the diff and the passing test run.
- [x] P0 — Item 2: narrow the ignore entry from the directory to the single filename that needs it, and
      bring the commit hook under version control in this repository. Prove it with the command that names
      which rule caught a path — staging an ignored file exits successfully and says so only in a hint.
- [x] P0 — Item 4: add the applied-version map, with absence — of the map, and of a type within it —
      distinguished from any version.
- [x] P1 — Item 5: register the session-start hook and implement the comparison. **Not delegable** — what
      the hook is allowed to do is the boundary RFC-0002 is open on, and a subagent without that document
      will implement the helpful version.
- [x] P1 — Item 5: verify silence, by opening a session in a repository whose versions match and confirming
      nothing is injected at all.

## Surprises & Discoveries

- Observation: a linked working tree does not isolate git configuration — it shares the repository's
  internal directory, so the clone-local ignore list applies inside it exactly as it does in the original
  checkout.
  Evidence: the clone-local ignore list lives under the repository's internal directory, and a linked
  working tree holds a pointer back to that directory rather than a copy of it. This is what makes item 2 a
  prerequisite of promulgation rather than a tidy-up: staging an ignored path exits successfully having
  staged nothing, and reports it only as a hint.

- Observation: every repository surveyed keeps the commit hook out of version control for the same reason,
  so this is a systematic property of how the harness was installed, not an accident in one place.
  Evidence: eight of eight repositories checked on 2026-08-13 carry the hook directory in the clone-local
  ignore list.

- Observation: the commit hook was never the file with the machine-specific path, and the exclusion that
  hides it is collateral from excluding its neighbour. The work item written against the original diagnosis
  described a refactor that had nothing to refactor.
  Evidence: measured 2026-08-13 — the commit hook contains zero absolute paths in the eight repositories
  checked and in the shipped template, resolving everything from the repository root instead; the sibling
  hook that dispatches to the workspace's knowledge pipeline embeds an identical absolute path in every
  repository sampled. Six of the eight ignore lists name **both** that sibling file *and* the whole
  directory, so the per-file line records the actual intent and the directory line is the over-broad one.

- Observation: the ignore rule never affected the commit hook at all, in any repository. **An ignore rule
  has no effect on a file the index already knows**, and that hook has been tracked all along — so both the
  original framing of item 2 and its first correction rested on a blocker that does not exist.
  Evidence: measured 2026-08-13 — the hook is listed by the index in all eight repositories checked;
  narrowing the rule and re-staging it produced an empty staged diff, which is what exposed it. What the
  over-broad rule does threaten is the next *untracked* file added to that directory, which is a real but
  much smaller thing.

- Observation: the same work item was diagnosed wrong twice in one day, and both diagnoses were plausible
  mechanisms reasoned from rather than measurements taken. The second one was written immediately after
  correcting the first, which is the part worth noticing: correcting a diagnosis does not by itself change
  the habit that produced it.
  Evidence: item 2 went from "the hook embeds a machine path" (false — measured zero) to "the hook is
  excluded from version control" (false — it is tracked) to its actual content, which is housekeeping
  against a future file. Each step took one command that could have been run before writing anything. The
  definition that settles it — ignore rules apply only to untracked files — had already been stated
  correctly in the same session before being contradicted.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
