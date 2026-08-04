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
[`project/plans/007-taxonomy-guards-one-close-and-filing-approved-plans.md`](../../project/plans/007-taxonomy-guards-one-close-and-filing-approved-plans.md),
migrated back into the repository a day after its four dossiers were closed and deleted.

## Before writing — the issue

Ask whether an issue already exists. If yes, record its number.

If not, offer to open one — `gh issue create --title "<topic>" --body "<one-line intent>"` — but **only if
the resolver reported a GitHub remote and `GH_AUTH=ok`**. Those two facts are in the Step 0 output; do not
re-derive them. If the repo is not on GitHub yet, proceed without an issue and add the number later.

Keep the issue lean: a one-line intent plus a link to the dossier. The dossier points *up* to the issue;
the issue points *down* to the dossier path. Neither carries the other's content.

## Naming — the one type that is not numbered by the resolver

- **With an issue:** name the dossier by the **issue number** — `<DIR>/<NNN>-<slug>.md`, zero-padded to the
  repo's width (`PAD` from Step 0). This is what makes dossier ↔ issue obvious at a glance, and it is why
  `NEXT` is only advisory here.
- **No issue yet:** `<DIR>/<slug>.md`, renamed once the issue exists.

## While the work happens

Commit the dossier as you go and update it freely — it is the living log, not a plan written once.
`Status` moves `Planned → In Progress → Done`.

## Closure is a ceremony, not a delete

When the work is done, run **`/vibe-ops:close task`**. It writes back to the doc that started the work,
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
- [ ] `gh issue create` was offered only when a remote and authentication were both reported
- [ ] The `## Closure` checkbox is present and unchecked
