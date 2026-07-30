---
name: close-task
description: Close a finished task dossier — write back to the source doc with what actually happened, propagate the change to living docs, spawn an ADR if a decision emerged, route what the work taught to where the next agent will read it, then distill and delete the dossier. Use when a task/issue is done, when the user says "wrap this up" or "close the task", or before deleting a project/tasks/ dossier.
argument-hint: "<task slug or issue number>"
effort: high
---

# /close-task — Close the loop, don't just delete the dossier

The failure mode this skill exists to prevent: a task finishes, the dossier gets deleted (or forgotten), and
the md file that *planned* the work — a task brief, an RFC, a plan doc — is left describing intent that no
longer matches reality. The fix is not a new document type; it's a step that was missing: **before
distilling and deleting, go back and update the doc that started the work.**

**Usage:** `/close-task <slug or issue number>` — e.g. `/close-task 042` or `/close-task migrate-storage`.

**This is an event skill** ([why that matters](../../references/convergence-policy.md)). It closes one unit
of work, once. Routing what the work *taught* happens in Step 5 and is governed by
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md) — the
promotion test lives there, not in this file.

---

## Step 1 — Find the dossier and its source doc

Locate `project/tasks/<NNN>-<slug>.md` (or `<slug>.md`). Read it in full — the `Context` section names why
the work exists; if it was spawned from an RFC, plan brief, or another md, that's the **source doc**.

If the dossier itself *is* the source doc (task wasn't derived from anything else), it's still the target of
Step 2 — the write-back and the dossier are the same file until Step 5 deletes it.

## Step 2 — Write back what actually happened

Open the source doc and update it to reflect reality, not the original plan:

- What shipped as planned, what changed, what got cut, what appeared mid-work that wasn't anticipated.
- If the source doc is an `Accepted` RFC or a brief that's meant to freeze after implementation, don't rewrite
  it in place — add a short "Implementation note" pointing at what actually happened, or move it per this
  repo's RFC lifecycle (frozen → `implemented/`, see the `project/**`-scoped governance rule).
- This step is **not optional and not the same as Step 4** (the issue's executive summary). The source doc is
  read by someone who finds it later without the issue open in front of them — it needs to be accurate on
  its own.

## Step 3 — Propagate to living docs

Diff-driven: look at what the work actually changed and ask which doc now describes something that no longer
exists.

- Package/repo `README.md` — did the public surface change? (Usage/API/install steps.)
- `docs/` — did a how-to, reference, or explanation page describe the old behavior?
- Root `AGENTS.md` — did the layout, a package's status, or a "not obvious from the code" fact change?

Skip anything that didn't change. This is not a full documentation audit — only what this task touched.

Then check that the edits did not break anything mechanically:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/check-agents-md.sh" .
```

Links are the reason: propagating a change is where a doc gets moved or a section renamed, and a link that
stopped resolving is invisible in a diff. It reads the repository and writes nothing into it. Skip it only
if this task touched no markdown at all.

## Step 4 — ADR, if a decision emerged

If the work settled something hard to reverse that wasn't already an ADR (a library choice, an API shape,
a rejected alternative worth recording), run `/vibe-ops:new-adr` now, before closing the task. If there's
rich context an ADR is too terse to carry (dead ends, why an alternative was rejected in detail), write a
paired `project/log/<slug>.md` linked to the ADR.

## Step 5 — Route what the work taught

Step 4 captures a *decision*. This step captures a *learning* — the non-obvious fact discovered while
doing the work, which has no home in any of the artifacts above and evaporates when the dossier is deleted.

**Input:** every entry under `Surprises & Discoveries` — in the source doc if it is a plan, and in the
dossier itself. If neither has entries and the work genuinely surprised no one, say so and move on; an
empty routing step is a legitimate outcome, a skipped one is not.

**Per entry, apply the promotion test** in
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md#the-promotion-test).
Four questions, in order — the first three can eliminate the entry, the fourth routes what survives:

1. **Recurrence** — would it burn a fresh agent more than once?
2. **Non-discoverability** — would a competent agent reading the code find it in a few minutes?
3. **Not already enforced** — does a test, type, lint rule or hook already make the mistake impossible?
   If one *could*, **write the guard, not the prose.**
4. **Blast radius** — where it lands, by what the fact is
   ([the routing table](../../references/instruction-surfaces.md#where-each-fact-goes)).

Do not restate the questions' reasoning here or in the repo you are closing work in — read the reference.
An entry that fails 1 or 2 is not discarded: it stays in `project/log/`, which exists for the rich context
of one unit of work whether or not a decision came out of it.

**Then the demotion check**, which is question 3 applied backwards and is the only reason the file ever
shrinks: *did this work add a test, type, lint rule or hook that now makes an existing `AGENTS.md` line or
always-on rule unnecessary?* If so, **delete that line**. Nothing detects this automatically, and without
it the instruction file only grows — which is not free, because the always-on block passes a relevance gate
as a whole and a redundant line degrades the ones that still matter.

Report what was promoted, where, and what was demoted, before continuing.

## Step 6 — Distill and delete

1. **Distill upward** — write the executive summary into the **issue** (comment or body): what shipped, in a
   few lines, for someone who never reads the dossier.
2. **Drop the breadcrumb** — `<sha>` = `git rev-parse HEAD` (the commit that still contains the dossier).
   Record in the issue, verbatim:

   ```
   git show <sha>:project/tasks/NNN-slug.md
   ```
3. **Delete the dossier** — `git rm project/tasks/<NNN>-<slug>.md` and commit
   (`chore(tasks): close <slug>, archived in history`).

**Confirm before this last step.** It is the only irreversible action in the skill, and this skill can be
invoked by the model rather than typed by the user — so the person whose dossier it is may not have asked
for it. Everything above is additive and safe to have run; the deletion is not. State what will be deleted
and what the breadcrumb is, and wait.

## Checklist

- [ ] Source doc updated with what actually happened (Step 2) — not skipped because "the issue has it"
- [ ] Docs that the work made stale are updated (README / `docs/` / `AGENTS.md`), or confirmed none did,
      and `check-agents-md.sh` is green afterwards
- [ ] ADR written if a hard-to-reverse decision emerged; paired `project/log/` entry if there's context an
      ADR can't carry
- [ ] Every `Surprises & Discoveries` entry routed through the promotion test — promoted, guarded, left in
      `project/log/`, or explicitly dropped; none silently deleted with the dossier
- [ ] Demotion check done: any `AGENTS.md` line or rule this work made redundant is deleted
- [ ] Executive summary distilled into the issue
- [ ] Breadcrumb `git show <sha>:project/tasks/NNN-slug.md` recorded in the issue
- [ ] Dossier `git rm`'d and committed
