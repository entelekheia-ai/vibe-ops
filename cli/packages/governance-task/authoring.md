---
vibe-ops-reference: records/task@2
---

# Task — what only a task needs

A task lives in **two artifacts that own different content** — never two copies of the same thing:

| Artifact | Owns | Never owns |
|---|---|---|
| **GitHub issue** | status, assignment, checklist, executive summary, final learnings | the long working log |
| **`<DIR>/<id>-<slug>.md`** (dossier) | the detailed working log, agent context, links to decisions/research | "is this done" — the issue is authority |

The dossier is **ephemeral**: committed live while the work happens, then deleted at closure after its
lessons are distilled upward. Git history is the archive; the working tree only ever shows in-flight work.
Status starts at `Planned`.

**If several dossiers share one design, that design needs a plan of its own — write it before the
dossiers.** The dossiers answer *what is being worked on*; nothing in them answers *why the work is shaped
this way*, and closure deletes them. A design that lives only across a set of dossiers is therefore
destroyed by the ceremony that closes them successfully, leaving deleted-file history as the sole record.
Splitting work into tasks is not the same decision as deciding where its reasoning lives, and answering
only the first is the failure — see
[`project/plans/007-taxonomy-guards-one-close-and-filing-approved-plans.md`](../../../project/plans/shipped/007-taxonomy-guards-one-close-and-filing-approved-plans.md),
migrated back into the repository a day after its four dossiers were closed and deleted.

## A work item states a cause, so the cause is measured before it is written

A work item is `What` / `Why` / `Change`, and the `Why` is a claim about the world: this file embeds that,
this rule blocks that, this directory is missing something. **Run the command that confirms it before
writing the item, not before starting the work.** A cause reasoned from a plausible mechanism reads
exactly like a cause that was checked, survives review, and is only caught when someone finally opens the
file — by which point it has been copied into the parent plan and any dossier written beside it.

Measured 2026-08-13: one item was diagnosed wrong twice in a single day — first as a path to extract from
a file that did not contain one, then as a rule to lift that had no effect on the file in question. Each
was refuted by one command taking seconds, and the second wrong diagnosis was written immediately after
correcting the first. Nothing had been built on either, so the cost was a rewrite; that is luck, not
process.

The cheap discipline: if the `Why` contains a verb like *embeds*, *excludes*, *blocks* or *is missing*,
that sentence is a claim with a command behind it. Run it. If the command is not obvious, the item is not
ready to be written.

## Before writing — the issue

Ask whether an issue already exists. If yes, record its number.

If not, offer to open one — `gh issue create --title "<topic>" --body "<one-line intent>"` — but **only if
the resolver reported a GitHub remote and `GH_AUTH=ok`**. Those two facts are in the Step 0 output; do not
re-derive them. If the repo is not on GitHub yet, proceed without an issue and add the number later.

Keep the issue lean: a one-line intent plus a link to the dossier. The dossier points *up* to the issue;
the issue points *down* to the dossier path. Neither carries the other's content.

## The exposure contract, and why the issue is the exposed half

[`${CLAUDE_PLUGIN_ROOT}/references/exposure-contract.md`](../../../plugin/references/exposure-contract.md) governs both artifacts,
but they are not equally exposed and the intuition runs backwards:

- **The dossier is the safer one.** It is committed, and it is deleted at closure — a mistake in it lives in
  git history, which is bad, and not on a page anyone browses.
- **The issue is permanent and, on a public repository, world-readable the instant it is posted.** It cannot
  be un-posted; editing a comment leaves the edit history. Everything written to it — the one-line intent
  here, and above all the executive summary `close` distills into it — carries the contract in full.

The failure this prevents is specific: a dossier says "blocked on the auth service in the other repo",
somebody moves that sentence up into the closing comment because it explains the delay, and a repository
name that never had to leave a deleted file is now in a permanent public thread. Write the constraint
instead — "blocked on an upstream dependency's release" — at the point the sentence is first written, not
when it is being copied.

## Naming — the one type that is not numbered by the resolver

- **With an issue:** name the dossier by the **issue number** — `<DIR>/<NNN>-<slug>.md`, zero-padded to the
  repo's width (`PAD` from Step 0). This is what makes dossier ↔ issue obvious at a glance, and it is why
  `NEXT` is only advisory here.
- **No issue yet:** `<DIR>/<slug>.md`, renamed once the issue exists.

## While the work happens

Commit the dossier as you go and update it freely — it is the living log, not a plan written once.
`Status` moves `Planned → In Progress → Done`.

## Closure is a ceremony, not a delete

When the work is done, run **`/vibe-ops:close-task`**. It writes back to the doc that started the work,
propagates to living docs, spawns an ADR if a decision emerged, routes each `Surprises & Discoveries`
entry through the promotion test, and only then distills the summary into the issue and removes the
dossier. Deleting the file directly loses everything the ceremony would have promoted — which is why a
guard refuses it while the dossier's `## Closure` box is still unchecked.

### The shape of the closure comment

Observed in practice, and worth matching rather than reinventing. The comment posted to the issue carries,
in this order: **what shipped** per track with PR links; **outcome against the prediction**, stating where
reality diverged from what the plan expected; and **what was routed before the dossier was deleted**,
naming each promoted learning and its destination. The breadcrumb and the note that the file was removed
by the lifecycle rather than lost are appended mechanically by `close`'s task branch — do not write them
by hand.

## Checklist additions

- [ ] Dossier named by issue number when an issue exists; by slug alone when it does not
- [ ] `Issue:` line links to the issue, or says `pending`
- [ ] The issue holds a one-line intent and a link to the dossier — not a second copy of the plan
- [ ] Exposure contract applied to **the issue text first**: nothing outside this repository named, no
      machine path, nothing about this repository's security posture
- [ ] `gh issue create` was offered only when a remote and authentication were both reported
- [ ] The `## Closure` checkbox is present and unchecked
