---
name: close
description: 'Close a finished task dossier or plan. For a task: write back to the source doc with what actually happened, propagate to living docs, spawn an ADR if a decision emerged, route what the work taught, then distill and delete the dossier. For a plan: write the retrospective against its own goals, route every Surprises & Discoveries entry, run the demotion check, then close the tracking issue while keeping the plan file. Use when a task/issue is done, when the user says "wrap this up" or "close the task", when a plan''s last track lands, or when the user says a plan is done or shipped.'
argument-hint: "<task|plan> <slug or number>"
effort: high
---

# /close — Close the loop: a task's dossier is deleted, a plan's file stays

Two lifecycles share one closing ceremony. A **task** dossier is ephemeral — closing it means writing
back what happened, routing what it taught, then distilling and deleting. A **plan** is the permanent
design record — closing it means writing the retrospective, routing what it taught, and keeping the file.
Get the type wrong and the wrong thing happens: a plan is not supposed to disappear, and a task dossier is
not supposed to survive.

The failure each half prevents: a task finishes and the dossier gets deleted (or forgotten) while the doc
that *planned* the work is left describing intent that no longer matches reality — the fix is not a new
document type, it's writing back before distilling. A plan runs every track, closes its issue, and routes
nothing, because the routing step used to live only in task-closure and a plan that never spawned a task
dossier never reached it — **a plan that ships without a task is exactly the case with no other exit.**

**Usage:** `/close <task|plan> <id>` — e.g. `/close task 042` or `/close plan 002`. If the type is
omitted, this skill resolves it by checking `project/tasks/` and `project/plans/` for a matching id or
slug; if it matches in both trees, or in neither, ask rather than guess.

**This is an event skill** ([why that matters](../../references/convergence-policy.md)). It closes one
unit of work, once. Routing what the work *taught* is governed by
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md) — the
promotion test lives there, not in this file.

---

## Step 0 — Resolve which one, and find the record

If the type wasn't given, look for `<id>` under both governance directories — the same ones
`resolve-governance.sh task` / `resolve-governance.sh plan` report as `DIR=`. Exactly one match: proceed.
Zero or two: ask.

**Task:** locate `project/tasks/<NNN>-<slug>.md` (or `<slug>.md`). Read it in full — the `Context` section
names why the work exists; if it was spawned from an RFC, plan brief, or another doc, that's the **source
doc**. If the dossier itself *is* the source doc, it is still the target of Step 1 — the write-back and the
dossier are the same file until the closing step deletes it.

**Plan:** locate `project/plans/<NNN>-*.md`, or wherever this repo keeps them — the `project/**` governance
rule is the authority. Read it in full, then verify against its own text: every track in `Progress` is
checked, or the unchecked ones are explicitly cut, **not silently dropped**; every `Success criteria` item
was actually run — run it now if the output is not recorded. If work remains, stop and say what. A plan
closed while a track is open makes the file lie, and the file is the part that survives.

## Step 1 — Write back what actually happened

**Task:** open the source doc and update it to reflect reality, not the original plan — what shipped as
planned, what changed, what got cut, what appeared mid-work that wasn't anticipated. If the source doc is
an `Accepted` RFC or a brief meant to freeze after implementation, don't rewrite it in place — add a short
"Implementation note" pointing at what actually happened, or move it per this repo's RFC lifecycle. This
step is **not optional and not the same as** the executive summary in the closing step: the source doc is
read by someone who finds it later without the issue open in front of them.

**Plan:** fill `Outcomes & Retrospective` by reading the plan's own `Goals` and `Success criteria` and
answering them one by one. Not a summary of what was done — **a comparison between what was promised and
what exists.** Say what was cut and why, what is still open and who inherits it. If an acceptance criterion
turned out to be wrong, record that it was wrong and in which direction: a criterion is a prediction, and a
plan that tracks its bad predictions is worth more than one that quietly edits them.

## Step 2 — ADR, if a decision emerged (task only)

If the work settled something hard to reverse that wasn't already an ADR (a library choice, an API shape, a
rejected alternative worth recording), run `/vibe-ops:new adr` now, before closing the task. If there's rich
context an ADR is too terse to carry, write a paired `project/log/<slug>.md` linked to it.

A plan has no equivalent step here: a hard-to-reverse decision made while a plan is in progress already
belongs in the plan's own `Decision Log`, with an ADR written and linked at the time — see the plan
template's own comment. Closure does not re-open that question.

## Step 3 — Route what the work taught

This step captures a *learning* — the non-obvious fact discovered while doing the work, which has no home
in any other artifact and evaporates when the record closes.

**Input:** every entry under `Surprises & Discoveries` — for a task, in the source doc if it is a plan, and
in the dossier itself; for a plan, its own section. If there are no entries and the work genuinely
surprised no one, say so and move on; an empty routing step is a legitimate outcome, a skipped one is not.

**Per entry, apply the promotion test** in
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md#the-promotion-test).
Four questions, in order — the first three can eliminate the entry, the fourth routes what survives:

1. **Recurrence** — would it burn a fresh agent more than once?
2. **Non-discoverability** — would a competent agent reading the code find it in a few minutes?
3. **Not already enforced** — does a test, type, lint rule or hook already make the mistake impossible? If
   one *could*, **write the guard, not the prose.**
4. **Blast radius** — where it lands, by what the fact is
   ([the routing table](../../references/instruction-surfaces.md#where-each-fact-goes)).

Do not restate the questions' reasoning here or in the repo you are closing work in — read the reference.
An entry that fails 1 or 2 is not discarded: it stays in `project/log/`, or — for a plan — in the plan file
itself, which exists for the rich context of one unit of work whether or not a decision came out of it.

**A promotion can be blocked.** If the right surface cannot receive it yet — the guard exists but is not
reachable from where the prose lives, the rule belongs to a repository you are not in — **record the
blockage and what unblocks it**, and carry it into the next unit of work as a track or item. Do not
half-apply it, and do not drop it because it is inconvenient.

## Step 4 — The demotion check

The reverse of question 3, and the only reason an instruction file ever shrinks: *did this work add a
test, type, lint rule, hook or CI job that now makes an existing `AGENTS.md` line or always-on rule
unnecessary?* If so, **delete that line.** Nothing detects this automatically; without it the file only
grows, and growth is not free — the always-on block passes a relevance gate as a whole, so a redundant line
degrades the ones that still matter.

If a demotion is identified but blocked, Step 3's rule applies: record it, name what unblocks it.

## Step 5 — Propagate to living docs

Diff-driven: look at what actually changed and ask which doc now describes something that no longer
exists.

- Package/repo `README.md` — did the public surface change? (Usage/API/install steps.)
- `docs/` — did a how-to, reference, or explanation page describe the old behavior?
- Root `AGENTS.md` — did the layout, a package's status, or a "not obvious from the code" fact change?
- `CHANGELOG.md` — for a plan, if it shipped something user-visible.

Skip anything that didn't change — this is not a full documentation audit, only what this work touched.
Then check the edits did not break anything mechanically:

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/check-agents-md.sh" .
```

Links are the reason: propagating a change is where a doc gets moved or a section renamed, and a link that
stopped resolving is invisible in a diff. Skip this only if the work touched no markdown at all.

## Step 6 — Close it out

**Task — distill and delete:**

1. **Write the executive summary to a file** — what shipped, for someone who will never read the dossier:
   what shipped per track with PR links; **outcome against the prediction**; **what was routed** before the
   dossier was deleted, naming each promoted learning and its destination. Do not write the breadcrumb or
   the "removed by the lifecycle" note — those are appended mechanically below.
2. **Preview, and confirm.** This is the only irreversible action in the skill, and the skill can be
   invoked by the model rather than typed — so the person whose dossier it is may not have asked for it.

   ```bash
   sh "${CLAUDE_PLUGIN_ROOT}/skills/close/finalize.sh" --dry-run \
      --plan <source plan, if any> <dossier>...
   ```

   It prints every file that links to the dossiers, what it would rewrite, and both commits it would make.
   **Show that output and wait.** Pass every dossier being closed in one invocation — closures come in
   batches, and referrers have to be collected across the whole set before anything is removed.
3. **Run it for real**, dropping `--dry-run` and adding `--summary-file`:

   ```bash
   sh "${CLAUDE_PLUGIN_ROOT}/skills/close/finalize.sh" \
      --plan <source plan> --summary-file <summary> <dossier>...
   ```

   It ticks the `## Closure` box, commits (that commit is the breadcrumb, because it is the last one that
   still contains the dossier), deletes, rewrites every link to the dossier into plain text plus a runnable
   `git show`, appends the breadcrumbs to the plan if one was given, commits again, re-runs the link check
   **after** the deletion, and posts the summary with the breadcrumb appended. The ordering is the whole
   point: derive the sha yourself and you will name a commit that no longer contains the file.

**Plan — set terminal status, keep the file:**

- Set the plan's `Status` to what this repo's governance calls its terminal state (`Shipped`, unless the
  `project/**` rule says otherwise). **Do not delete the file and do not archive it** — someone reads it in
  a year to find out why the thing is shaped this way.
- Write the executive summary into the **tracking issue**, if there is one, and close it. The issue owns
  status and the summary; the file owns the design and the working record — closing the issue does not end
  the file's life.
- If the plan's last commits are not merged, say so rather than closing an issue that describes unmerged
  work.

## Checklist

- [ ] Type resolved unambiguously — given explicitly, or found in exactly one of `project/tasks/` /
      `project/plans/`
- [ ] `[task]` Source doc updated with what actually happened — not skipped because "the issue has it"
- [ ] `[plan]` Every track checked or explicitly cut; every success criterion actually run;
      `Outcomes & Retrospective` compares promise to reality, including what was cut and what is open
- [ ] `[task]` ADR written if a hard-to-reverse decision emerged; paired `project/log/` entry if there's
      context an ADR can't carry
- [ ] Every `Surprises & Discoveries` entry routed — promoted, guarded, left in place, or explicitly
      dropped; none silently deleted with the record. Any guard written was proven to fail on something
      broken
- [ ] Demotion check done: any `AGENTS.md` line or rule this work made redundant is deleted
- [ ] Blocked promotions and demotions recorded with what unblocks them, not dropped
- [ ] Docs the work made stale are updated, or confirmed none did, and `check-agents-md.sh` is green
      afterwards
- [ ] `[task]` `finalize.sh` previewed with `--dry-run`, output shown and confirmed before the real run;
      every dossier in the batch passed to one invocation; breadcrumb recorded in the issue; the link check
      **after** deletion is green
- [ ] `[plan]` `Status` set to the terminal state and **the plan file still exists**; tracking issue carries
      the summary and is closed
