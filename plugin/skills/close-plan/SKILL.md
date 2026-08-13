---
name: close-plan
description: Close a shipped plan. Verify every track landed and every success criterion actually ran, write the retrospective against the plan's own goals, run the demotion check, propagate to living docs, then set the terminal status and move the file into shipped/ — the plan is never deleted, because it is the permanent design record. Use when a plan's last track lands, or when the user says a plan is done or shipped.
argument-hint: "<slug or number>"
effort: high
paths:
  - "project/plans/*.md"
  - "**/project/plans/*.md"
hooks:
  PostToolUse:
    - matcher: "Write|Edit|MultiEdit"
      hooks:
        - type: command
          command: vibe-ops
          args: ["hook", "plan-status"]
          timeout: 10
---

# /close-plan — the retrospective is written, and the file is kept

A plan is the **permanent design record**: closing it means writing the retrospective, running the
demotion check, closing the tracking issue, and moving the file into `shipped/` with its number intact.
Its sibling is [`/close-task`](../close-task/SKILL.md), and the two are separate skills because they end
differently — **a plan is never deleted.**

The failure this half prevents: a plan runs every track, closes its issue, and routes nothing, because
the routing step used to live only in task closure and a plan that never spawned a task dossier never
reached it. **A plan that ships without a task is exactly the case with no other exit.**

**Usage:** `/close-plan <id>` — e.g. `/close-plan 002`. The `plan` tool with `{ command: "resolve" }`
reports where plans live in this repository; if `<id>` matches nothing there, say so rather than guessing at a task.

**This is an event skill** ([why that matters](../../references/convergence-policy.md)). It closes one
unit of work, once. Routing what the work *taught* is governed by
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md) — the
promotion test lives there, not in this file.


> **Prefer the MCP tool over the terminal.** This plugin ships its own `vibe-ops` MCP server
> (`.claude-plugin/plugin.json`), so the verbs below are tools, and a tool returns its report as
> structured data instead of terminal text to read back. The tool's full name depends on how the server
> was registered — `mcp__vibe-ops__<noun>` from a project `.mcp.json`, `mcp__plugin_vibe-ops_vibe-ops__<noun>`
> when it comes from the plugin. **If neither is listed, the CLI is correct**: the shell forms shown below
> are the same command, and the server may simply not be running in this session.

**This skill installs its own hook while it runs.** Every write to a plan is checked by
`vibe-ops hook plan-status`, which says so if that plan's `Status` and its own track boxes disagree — the
exact mistake Step 0 exists to catch, reported at the moment it is made rather than at the end.

---

## Step 0 — Verify the plan against its own text

Read the plan in full, then check it against what it promised:

The `plan` tool with `{ command: "status" }` — or `vibe-ops plan status` from a terminal.

- **Every track is checked, or the unchecked ones are explicitly cut — not silently dropped.**
- **Every `Success criteria` item was actually run.** Run it now if the output is not recorded. A
  criterion nobody executed is a prediction, not a result.

If work remains, stop and say what. A plan closed while a track is open makes the file lie, and the file
is the part that survives.

**Read the plan's `Status` first, and stop if it is already terminal.** Nothing else in this skill
detects a plan that was closed months ago: `plan status` reports it clean *because* it is closed, every
track is checked, and the ceremony runs to the end before `plan close` says `already in shipped/`. The
useful run on a closed plan is not this one — it is Step 4's demotion check against whatever the
retrospective recorded as *blocked*, since the thing that blocked it may since have shipped.

## Step 1 — Write the retrospective

Fill `Outcomes & Retrospective` by reading the plan's own `Goals` and `Success criteria` and answering
them one by one. Not a summary of what was done — **a comparison between what was promised and what
exists.** Say what was cut and why, what is still open and who inherits it.

If an acceptance criterion turned out to be wrong, record that it was wrong and in which direction: a
criterion is a prediction, and a plan that tracks its bad predictions is worth more than one that quietly
edits them.

## Step 2 — No ADR step here, deliberately

A hard-to-reverse decision made while a plan is in progress already belongs in the plan's own
`Decision Log`, with an ADR written and linked **at the time** — see the plan template's own comment.
Closure does not re-open that question, and a decision first written down at closure was reconstructed
from memory, which is what the living-sections rule exists to prevent.

## Step 3 — Route what the plan taught

What a plan carries is a `Decision Log`, and that is **design** — it stays with the plan and is not
routed anywhere. A permanent file cannot discharge what is written into it, so the working record of doing
lives in the task dossiers the tracks spawned and was routed as each of those closed. There is nothing
here to empty.

So this step is usually empty, and saying so is the point. Where it is not empty is the case the plan
above named: **a plan that never spawned a task dossier**, whose learnings therefore never passed through
task closure.

**This describes the current template. For a plan written against an older one, read that version's own
description instead:**

```sh
vibe-ops records handling <plan>
```

It names the version the plan declares and, when that is not the current one, the documents describing
that shape. Those documents govern; nothing on this page does.

For whatever this step turns out to hold, apply the promotion test in
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md#the-promotion-test)
— filter first, then place:

1. **Does it hold beyond this repository?** → `project/learnings/`.
2. **Can you name the file, folder or package where someone meets it again?** → `project/log/`, via
   `/vibe-ops:new-log`, and that answer **is** the entry's `path:` / `relatedTo:`.
3. **Is it a prescription for how an existing skill should behave?** → make the edit to that `SKILL.md`.
4. **None of these?** → dropped, deliberately and out loud.

**An entry that fails the filter is dropped, never filed one tier down.** `project/log/` is a destination
reached on its own merits, never the overflow bucket for rejected candidates — filing rejects downward is
exactly what carried `project/learnings/` past its budget.

**A promotion can be blocked.** If the right surface cannot receive it yet, **record the blockage and what
unblocks it**, and carry it into the next unit of work. Do not half-apply it, and do not drop it because
it is inconvenient.

## Step 4 — The demotion check

The only reason an instruction file ever shrinks: *did this work add a test, type, lint rule, hook or CI
job that now makes an existing `AGENTS.md` line or always-on rule unnecessary?* If so, **delete that
line.** Nothing detects this automatically; without it the file only grows, and growth is not free — the
always-on block passes a relevance gate as a whole, so a redundant line degrades the ones that still
matter.

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

## Step 6 — Close it out, and keep the file

1. **Write the executive summary into the tracking issue**, if there is one, and close it. The issue owns
   status and the summary; the file owns the design and the working record — closing the issue does not
   end the file's life. Apply
   [`${CLAUDE_PLUGIN_ROOT}/references/exposure-contract.md`](../../references/exposure-contract.md) to
   every line as you lift it out of the plan.

   If the plan's last commits are not merged, say so rather than closing an issue that describes unmerged
   work.
2. **Set the terminal status and file it:**

   The `plan` tool: `{ command: "close", "dry-run": true, confirm: true, args: ["project/plans/<NNN>-<slug>.md"] }`
   to preview, then the same call with `dry-run` dropped. From a terminal:

   ```bash
   vibe-ops plan close --dry-run project/plans/<NNN>-<slug>.md   # preview
   vibe-ops plan close project/plans/<NNN>-<slug>.md
   ```

   **Show the preview and wait before the second call.** `confirm: true` exists because a tool call has no
   prompt to run; it is the mechanism, not the consent.

   **Over MCP the preview needs `confirm: true` too, and that is deliberate** — the gate is on the verb,
   not the invocation, so there is one answer to "may this tool call delete files" rather than one per
   flag combination. `dry-run` alone returns exit 2 and a refusal reading *re-send with `confirm: true`
   to run it*, which is the trap: taken literally it says to drop the flag that made the call safe. The
   consent is still yours to obtain, from the preview — not from the word `confirm`.

   It sets `Status` to whatever this repository's own governance calls terminal — read from the plan
   template's `Status lifecycle` marker, never assumed to be `Shipped` — then `git mv`s the file into
   `shipped/`, **keeping its number**, and repoints links in both directions: every link into the plan,
   and every relative link the plan itself carries, which now sits one level deeper.

   **The file is moved, never deleted and never archived away.** Someone reads it in a year to find out
   why the thing is shaped this way, and the resolver still counts its number so the next plan cannot
   collide with it.

## Checklist

- [ ] Every track checked or explicitly cut; every success criterion actually run
- [ ] `vibe-ops plan status` reports nothing for this plan
- [ ] `Outcomes & Retrospective` compares promise to reality, including what was cut and what is open,
      and records any acceptance criterion that turned out to be wrong
- [ ] Routing done or explicitly empty — and if this plan never spawned a task dossier, its learnings
      were passed through the promotion test here, because nothing else will
- [ ] Demotion check done: any `AGENTS.md` line or rule this work made redundant is deleted
- [ ] Blocked promotions and demotions recorded with what unblocks them, not dropped
- [ ] Docs the work made stale are updated, or confirmed none did, and `vibe-ops check .` is green
- [ ] Tracking issue carries the summary and is closed; unmerged work said out loud rather than papered
      over
- [ ] `vibe-ops plan close` run; **the plan file still exists**, under `shipped/`, with its number
- [ ] Every line written to an **issue** passed the exposure contract at the moment it was lifted out of
      the record, not afterwards

## ⟳ After every use: review this skill

Step 0 is the one this skill cannot fix afterwards. A plan closed with an open track produces a file that
reads as finished forever, and the only sensor for it is the one this skill installs while it runs. If
that hook stayed silent on a plan that was in fact incoherent, the defect is in `plan status`, not here.

Step 3 is the step most likely to be skipped, because it is usually empty — and "usually empty" is
exactly how a step stops being read. If a plan that never spawned a dossier reached the end with its
learnings unrouted, that is the edit worth making here.

If a closure produced no edits to this skill, say so — a ceremony that ran cleanly is signal too.
