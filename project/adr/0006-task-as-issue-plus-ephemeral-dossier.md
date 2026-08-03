<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0006: A task is a GitHub issue plus an ephemeral dossier

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Deciders | Danilo Borges |

---

## Context

A unit of decided work needs two things that no single medium provides well. It needs **status** — open or
closed, assigned to whom, visible without cloning anything, and linkable from a branch and a pull request.
And it needs a **working record** — the detailed reasoning, the work items, what was tried and abandoned —
which is long, is revised constantly, and is worth reviewing as a diff.

An issue tracker is good at the first and poor at the second: comment threads are append-only, unreviewable,
and searchable only through the tracker. A markdown file in the repository is good at the second and poor at
the first: it has no notion of open or closed, notifies nobody, and cannot be linked from a branch.

The plugin already used both without stating what each one owns, which left two questions unanswered: where
does a fact go when it could go in either, and what happens to the file when the work is done.

## Decision

**We will model a task as two artifacts with a stated ownership split, one of which is deleted at closure.**

- The **GitHub issue** owns status, assignment, and — written at closure — the executive summary, for
  someone who will never open the dossier.
- The **dossier** (`project/tasks/NNN-slug.md`, numbered after the issue) owns the detailed working record.
  It is committed live and revised as the work moves.
- The dossier is **ephemeral**. At closure `/vibe-ops:close-task` writes back to the source doc, propagates
  to living docs, spawns an ADR if a decision emerged, routes what the work taught, distills the summary
  into the issue with the breadcrumb `git show <sha>:project/tasks/NNN-slug.md`, and then deletes the file.
  Git history is the archive; the breadcrumb is the pointer into it.
- A **plan** pairs with an issue the same way and ends differently: the issue closes, the plan file stays.
  It is the permanent design record, and the difference is stated in `GOVERNANCE.md` rather than inferred.

## Options considered

- **Option A — markdown only, no issue.** Rejected: nothing carries status. Work in progress is invisible
  to anyone not reading the tree, branches and pull requests have nothing to reference, and "is this done?"
  is answered by grepping for a status field somebody had to remember to update.
- **Option B — issue only, no file.** Rejected: a working record long enough to be useful is unreadable as
  a comment thread. It cannot be reviewed as a diff, it is not versioned with the code it describes, and it
  is lost to anyone working offline or reading the repository later without the tracker.
- **Option C — both, with the file kept permanently.** Rejected: two permanent records of the same work
  drift, and the one nobody is required to update is the one that gets read. The artifact for work that
  genuinely deserves a permanent record already exists — it is a plan.
- **Option D (chosen) — both, with the file ephemeral and a breadcrumb into history at closure.**

## Consequences

Easier: each question has one place to be answered, so nothing is written twice. A dossier can be as long
as the work needs, because it is not competing for attention with a summary. `project/tasks/` stays small
enough to browse, since it holds only open work.

Harder: closure is now a procedure rather than a delete, and skipping it loses the write-back and the
learnings along with the file — which is why it is a skill and not a convention. The archive is only
reachable through the breadcrumb, so a summary written carelessly is effectively the whole record for
anyone who does not run the `git show`.

Accepted constraint: this **assumes GitHub**, or a tracker with stable issue numbers. A repository without
one keeps the dossier and loses the status half; nothing in the model degrades gracefully there, and the
skills say so rather than pretending otherwise.

## Related

- [`GOVERNANCE.md`](../../GOVERNANCE.md) — the issue-pairing table, including how a plan differs.
- [`.agents/rules/governance.md`](../../.agents/rules/governance.md) — the lifecycle mechanics.
- [`skills/new/SKILL.md`](../../skills/new/SKILL.md) with
  [`references/records/task.md`](../../references/records/task.md) ·
  [`skills/close-task/SKILL.md`](../../skills/close-task/SKILL.md) — the two ends of it. (Pointer
  repaired when `new-task` was folded into `/new`; the decision above is unchanged.)
- [ADR-0002](0002-knowledge-lifecycle.md) — what closure does with what the work taught.
