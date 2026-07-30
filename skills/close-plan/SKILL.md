---
name: close-plan
description: Close a finished plan — write the retrospective against the original goals, route every Surprises & Discoveries entry to a durable surface, run the demotion check, then close the tracking issue while keeping the plan file. Use when the last track of a plan lands, when the user says a plan is done or shipped, or before marking a plan Complete.
argument-hint: "<plan number or slug>"
effort: high
---

# /close-plan — A plan ships; its file stays

`close-task` deletes a dossier. This does the opposite: **nothing is deleted.** A plan is the permanent
design record, so closing one is about moving what it learned somewhere durable and leaving the file
behind, accurate.

The failure this prevents is specific and has already happened once here: a plan can run all its tracks,
close its issue, and route nothing — because the routing step lived only in `close-task` and a plan that
never spawned a task dossier never reached it. **A plan that ships without a task is exactly the case with
no other exit.**

**Usage:** `/close-plan <number or slug>` — e.g. `/close-plan 002`.

**This is an event skill** ([why that matters](../../references/convergence-policy.md)). It closes one plan,
once. The promotion test it applies lives in
[`${CLAUDE_PLUGIN_ROOT}/references/knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md) — read
it there; do not restate it into the repository being closed.

---

## Step 1 — Find the plan and check it is actually finished

Locate the plan (`project/plans/<NNN>-*.md`, or wherever this repo keeps them — the `project/**` governance
rule is the authority). Read it in full, then verify against its own text:

- Every track in `Progress` is checked, or the unchecked ones are explicitly cut — **not silently dropped**.
- Every `Success criteria` item was run, not assumed. Run them now if the output is not recorded.

If work remains, stop and say what. A plan closed while a track is open makes the file lie, and the file is
the part that survives.

## Step 2 — Write the retrospective against the original goals

Fill `Outcomes & Retrospective` by reading the plan's own `Goals` and `Success criteria` and answering them
one by one. Not a summary of what was done — **a comparison between what was promised and what exists.**

Say what was cut and why. Say what is still open and who inherits it. If an acceptance criterion turned out
to be wrong, record that it was wrong and in which direction: a criterion is a prediction, and a plan that
tracks its bad predictions is worth more than one that quietly edits them.

## Step 3 — Route what the plan taught

For **each** entry under `Surprises & Discoveries`, apply the four questions from
[the promotion test](../../references/knowledge-lifecycle.md#the-promotion-test) in order — recurrence,
non-discoverability, not-already-enforced, blast radius — and send what survives to the surface the
[routing table](../../references/instruction-surfaces.md#where-each-fact-goes) names.

Three outcomes are all legitimate, and a run that produces only the first is not a routing pass:

| Outcome | When |
|---|---|
| **Promoted** | it survives all four questions — write it at the surface the table names |
| **Left in place** | it fails question 1 or 2, or is already written down somewhere — the plan file is its home |
| **Became a guard** | question 3 says a test, lint rule or hook could make it impossible — write the guard instead of the prose, and **prove it fails** on something broken |

**A promotion can be blocked.** If the right surface cannot receive it yet — the guard exists but is not
reachable from where the prose lives, the rule belongs to a repository you are not in — **record the
blockage and what unblocks it** in the retrospective, and carry it into the next plan as a track. Do not
half-apply it, and do not drop it because it is inconvenient.

## Step 4 — The demotion check

The reverse of question 3, and the only reason an instruction file ever shrinks: *did this plan add a test,
type, lint rule, hook or CI job that now makes an existing `AGENTS.md` line or always-on rule
unnecessary?* If so, **delete that line.**

Nothing detects this. Without it the file only grows, and growth is not free — the always-on block passes a
relevance gate as a whole, so a line that is now redundant is degrading the ones that still matter.

If a demotion is identified but blocked, Step 3's rule applies: record it, name what unblocks it.

## Step 5 — Propagate to living docs

Diff-driven, the same as `close-task`: look at what the plan actually changed and ask which document now
describes something that no longer exists. `README.md`, `docs/`, `AGENTS.md`, `CHANGELOG.md`. Skip whatever
the plan did not touch — this is not a documentation audit.

## Step 6 — Close the issue, keep the file

- Set the plan's `Status` to what this repo's governance calls its terminal state (`Shipped`, unless the
  `project/**` rule says otherwise). **Do not delete the file and do not archive it** — someone reads it in
  a year to find out why the thing is shaped this way.
- Write the executive summary into the **tracking issue**, if there is one, and close it. The issue owns
  status and the summary; the file owns the design and the working record. This is the one place where
  plan and task genuinely differ: closing the issue does not end the file's life.
- If the plan's last commits are not merged, say so rather than closing an issue that describes unmerged
  work.

## Checklist

- [ ] Every track checked or explicitly cut; every success criterion actually run
- [ ] `Outcomes & Retrospective` answers the plan's own `Goals`, including what was cut and what is open
- [ ] **Every** `Surprises & Discoveries` entry routed — promoted, guarded, or deliberately left, with none
      passed over in silence
- [ ] Any guard written was proven to fail on something broken on purpose
- [ ] Demotion check done: an instruction line this plan made redundant is deleted
- [ ] Blocked promotions and demotions recorded with what unblocks them, not dropped
- [ ] Living docs the plan made stale are updated, or confirmed none were
- [ ] `Status` set to the terminal state; **the plan file still exists**
- [ ] Tracking issue carries the summary and is closed
