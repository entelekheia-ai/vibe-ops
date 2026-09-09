---
name: close-task
description: Close a finished task dossier. Write back to the source doc with what actually happened, propagate to living docs, spawn an ADR if a decision emerged, route every Surprises & Discoveries entry through the promotion test, then distill the summary into the issue and delete the dossier, leaving a git breadcrumb. Use when a task or issue is done, or when the user says "wrap this up", "close the task", or asks to delete a task dossier.
argument-hint: "<slug or number>"
effort: high
paths:
  - "project/tasks/*.md"
  - "**/project/tasks/*.md"
---

# /close-task — the dossier is distilled, then deleted

A task dossier is **ephemeral**: closing it means writing back what happened, routing what it taught, and
then distilling and deleting. Its sibling is [`/close-plan`](../close-plan/SKILL.md), and the two are
separate skills because they end differently — a plan is never deleted, and getting that wrong destroys
the record someone reads in a year.

The failure this half prevents: a task finishes and the dossier gets deleted (or forgotten) while the doc
that *planned* the work is left describing intent that no longer matches reality. The fix is not a new
document type — it is writing back before distilling.

**Usage:** `/close-task <id>` — e.g. `/close-task 042`. Locate `project/tasks/<NNN>-<slug>.md`; if `<id>`
matches nothing there, say so rather than guessing at a plan.

**This is an event skill** (why that matters: `vibe-ops records norm --type base --facet policy --name convergence --print`). It closes one
unit of work, once. Routing what the work *taught* is governed by
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md) — the
promotion test lives there, not in this file.


> **Prefer the MCP tool over the terminal.** This plugin ships its own `vibe-ops` MCP server
> (`.claude-plugin/plugin.json`), so the verbs below are tools, and a tool returns its report as
> structured data instead of terminal text to read back. The tool's full name depends on how the server
> was registered — `mcp__vibe-ops__<noun>` from a project `.mcp.json`, `mcp__plugin_vibe-ops_vibe-ops__<noun>`
> when it comes from the plugin. **If neither is listed, the CLI is correct**: the shell forms shown below
> are the same command, and the server may simply not be running in this session.

**The dossier cannot be deleted by hand while its `## Closure` box is unchecked** — `vibe-ops hook
task-guard` refuses it, in every session, whether or not this skill is loaded. Step 6 is what ticks that
box, so the ceremony passes through and only a shortcut is stopped.

---

## Step 0 — Find the record

The `task` tool with `{ command: "resolve" }` — `vibe-ops task resolve` from a terminal — reports where
dossiers live in this repository. Locate
`project/tasks/<NNN>-<slug>.md` (or `<slug>.md`) and **read it in full** — the `Context` section names why
the work exists; if it was spawned from an RFC, plan brief, or another doc, that is the **source doc**. If
the dossier itself *is* the source doc, it is still the target of Step 1: the write-back and the dossier
are the same file until the closing step deletes it.

## Step 1 — Write back what actually happened

Open the source doc and update it to reflect reality, not the original plan — what shipped as planned,
what changed, what got cut, what appeared mid-work that was not anticipated. If the source doc is an
`Accepted` RFC or a brief meant to freeze after implementation, do not rewrite it in place — add a short
"Implementation note" pointing at what actually happened, or move it per this repo's RFC lifecycle.

This step is **not optional and not the same as** the executive summary in Step 6: the source doc is read
by someone who finds it later without the issue open in front of them.

## Step 2 — ADR, if a decision emerged

If the work settled something hard to reverse that was not already an ADR (a library choice, an API shape,
a rejected alternative worth recording), run `/vibe-ops:new adr` now, before closing the task. If there is
rich context an ADR is too terse to carry, write a paired `project/log/<slug>.md` linked to it.

## Step 3 — Route what the work taught

This step captures a *learning* — the non-obvious fact discovered while doing the work, which has no home
in any other artifact and evaporates when the record closes.

**Input:** every entry under `Surprises & Discoveries` **in the dossier**. That is the only place they
live — a plan carries no such section, because a permanent file cannot discharge what is written into it.
Closing a **plan** therefore routes nothing: its `Decision Log` is design and stays with the plan. If
there are no entries and the work genuinely surprised no one, say so and move on; an empty routing step
is a legitimate outcome, a skipped one is not.

**This describes the current templates. For a record written against an older one, read that version's
own description instead:**

```sh
vibe-ops records handling <dossier>...
```

It names the version each record declares and, when that is not the current one, the documents describing
that shape. Those documents govern; nothing on this page does.

Routing runs in two passes: **filter, then place.** They answer different questions and neither replaces
the other.

**Pass 1 — the filter.** Questions 1–3 of the promotion test in
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md#the-promotion-test).
Any one of them can eliminate the entry:

1. **Recurrence** — would it burn a fresh agent more than once?
2. **Non-discoverability** — would a competent agent reading the code find it in a few minutes?
3. **Not already enforced** — does a test, type, lint rule or hook already make the mistake impossible? If
   one *could*, **write the guard, not the prose.**

Do not restate the questions' reasoning here or in the repo you are closing work in — read the reference.

**An entry that fails the filter is dropped, deliberately and out loud.** It does not fall through to
`project/log/`: that tier is a destination reached on its own merits, never the overflow bucket for
rejected candidates. Filing rejects one tier down is exactly what carried `project/learnings/` past its
budget, and it is why the tier below is the one that rots.

**Pass 2 — place what survived**, by what the fact *is* (the routing table in
`vibe-ops records norm --type instructions --facet policy --name surfaces --print`, "Where each fact
goes"):

1. **Does it hold beyond this repository?** → `project/learnings/`.
2. **Can you name the file, folder or package where someone meets it again?** → `project/log/`, and that
   answer **is** the entry's `path:` / `relatedTo:`. If you cannot name one, it does not go here.
3. **Is it a prescription for how an existing skill should behave?** → make the edit to that `SKILL.md`,
   then record the entry as discharged with a pointer to it. A prescription filed as prose becomes a
   second copy of an instruction, and the copy that runs is the one in the skill.
4. **None of these?** → dropped. A finding too large to have a path is usually a decision (an ADR) rather
   than a trap.

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
vibe-ops check .
```

Links are the reason: propagating a change is where a doc gets moved or a section renamed, and a link that
stopped resolving is invisible in a diff. Skip this only if the work touched no markdown at all.

## Step 6 — Distill, then delete

1. **Write the executive summary to a file** — what shipped, for someone who will never read the dossier:
   what shipped per track with PR links; **outcome against the prediction**; **what was routed** before the
   dossier was deleted, naming each promoted learning and its destination. Do not write the breadcrumb or
   the "removed by the lifecycle" note — those are appended mechanically below.

   **This summary is the most exposed text this skill produces**, and it is produced by copying upward out
   of a document that was never as exposed. The dossier is about to be deleted; the comment is permanent
   and, on a public repository, world-readable the instant it is posted — editing it later leaves an edit
   history. Apply
   `vibe-ops records norm --type classification --facet policy --name exposure --print` to
   every line as you lift it: a repository name that explained a delay inside the dossier becomes the
   constraint it imposed; a path pasted from a terminal becomes a repository-relative one; a routed
   learning is named by *what* it was and where it landed, never by the private note it came from.
2. **Preview, and confirm.** This is the only irreversible action in the skill, and the skill can be
   invoked by the model rather than typed — so the person whose dossier it is may not have asked for it.

   The `task` tool, `{ command: "close", "dry-run": true, confirm: true, plan: "<source plan, if any>",
   args: ["<dossier>", ...] }` — or from a terminal:

   ```bash
   vibe-ops task close --dry-run --plan <source plan, if any> <dossier>...
   ```

   **Over MCP the preview needs `confirm: true` too, and that is deliberate** — the gate is on the verb,
   not the invocation, so there is one answer to "may this tool call delete files" rather than one per
   flag combination. `dry-run` alone returns exit 2 and a refusal reading *re-send with `confirm: true`
   to run it*; taken literally that says to drop the flag that made the call safe, and here dropping it
   deletes the dossier and writes two commits having shown nobody anything. Keep both, then drop
   `dry-run`.

   It prints every file that links to the dossiers, what it would rewrite, and both commits it would make.
   **Show that output and wait.** Pass every dossier being closed in one invocation — closures come in
   batches, and referrers have to be collected across the whole set before anything is removed.
3. **Run it for real**, dropping `--dry-run` and adding `--summary-file`:

   The `task` tool, `{ command: "close", confirm: true, plan: "<source plan>",
   "summary-file": "<summary>", args: ["<dossier>", ...] }` — or from a terminal:

   ```bash
   vibe-ops task close --plan <source plan> --summary-file <summary> <dossier>...
   ```

   **`confirm: true` is the mechanism, never the consent.** A tool call has no prompt, so the tool refuses
   a destructive verb without it — and the thing that makes the run legitimate is step 2 above, the
   preview shown to a person who then said go. Setting the flag without having done that is the same act
   as deleting the dossier by hand, with an extra step.

   It ticks the `## Closure` box, commits (that commit is the breadcrumb, because it is the last one that
   still contains the dossier), deletes, rewrites every link to the dossier into plain text plus a runnable
   `git show`, appends the breadcrumbs to the plan if one was given, commits again, checks **after** the
   deletion that nothing still links to a deleted dossier, and posts the summary with the breadcrumb
   appended. The ordering is the whole point: derive the sha yourself and you will name a commit that no
   longer contains the file.

   **It exits non-zero if any tracked file still links to a deleted dossier.** That is the one outcome
   worth stopping for — fix those references before moving on, rather than treating the closure as done.

## Checklist

- [ ] Source doc updated with what actually happened — not skipped because "the issue has it"
- [ ] ADR written if a hard-to-reverse decision emerged; paired `project/log/` entry if there is context
      an ADR cannot carry
- [ ] Every `Surprises & Discoveries` entry routed — promoted, guarded, left in place, or explicitly
      dropped; none silently deleted with the record. Any guard written was proven to fail on something
      broken
- [ ] Demotion check done: any `AGENTS.md` line or rule this work made redundant is deleted
- [ ] Blocked promotions and demotions recorded with what unblocks them, not dropped
- [ ] Docs the work made stale are updated, or confirmed none did, and `vibe-ops check .` is green
- [ ] `vibe-ops task close` previewed with `--dry-run`, output shown and confirmed before the real run;
      every dossier in the batch passed to one invocation; breadcrumb recorded in the issue; the check
      **after** deletion is green
- [ ] Every line written to an **issue** passed the exposure contract at the moment it was lifted out of
      the record, not afterwards

## ⟳ After every use: review this skill

Step 3's filter is the one that decays quietly. An entry promoted that should have been dropped costs a
line in a file everyone reads; an entry dropped that should have been promoted costs the next session the
same hours. If a rejection felt wrong, the edit belongs in
[`knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md), not here — this skill points at the
test rather than restating it, deliberately.

If a closure produced no edits to this skill, say so — a ceremony that ran cleanly is signal too.
