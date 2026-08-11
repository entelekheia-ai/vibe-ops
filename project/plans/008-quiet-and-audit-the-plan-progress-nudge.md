<!-- vibe-ops-template plan@0.1 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Plan-008: Quiet the Plan-Progress Nudge, and Make Its Firings Auditable

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-06 |
| Author | Danilo Borges |
| Related | [Plan-006](./shipped/006-plan-progress-nudge-and-state-cleanup.md) (this corrects it and reverses its Goal 1) · [ADR-0009](../adr/0009-hooks-as-a-delivery-surface.md) |

---

## Summary

`hooks/plan-progress-nudge.sh` fires at the end of every turn that wrote files into a repository holding
an active plan, and asks the model whether the turn taught something that belongs in that plan's living
sections. Measured over one workspace's full session history, it fired 42 times, caused 263 model turns
and 256,625 output tokens, and **40% of those firings ended in a visible paragraph explaining to the user
why nothing was owed** — a paragraph the user never asked for. It also asked about the same plan up to
fourteen times, because the memory that was supposed to prevent a second ask drops exactly the plans the
model complied on. This plan fixes the memory, narrows each firing to one plan, replaces the spoken
refusal with silence plus a durable on-disk record, and leaves behind two sensors so that neither the
noise nor its absence has to be taken on faith again.

## Goals

1. A firing that the model correctly declines produces **no output to the user at all**, and the decline
   is still recoverable afterwards from a file on disk.
2. Complying with the nudge never re-arms it: a plan written after being named is never named again in
   the same session.
3. A firing names **at most one plan**, so the model answers a yes/no question rather than triaging a
   list.
4. The rate this plan is trying to improve can be re-measured by running a command, not by writing a new
   analysis program each time.
5. The hook's behaviour is asserted by a check that runs without a release, so a later edit cannot
   quietly restore the old behaviour.

## Scope

### In scope

The file `hooks/plan-progress-nudge.sh`; a new firing log written under the directory named by the
`CLAUDE_PLUGIN_DATA` environment variable; a new check fragment under `scripts/checks/`; a preserved
measurement script for the one quantity the log cannot observe; and the record of the Goal-1 reversal.

### Out of scope

**The other five hooks this plugin ships** (`plan-mode-context.sh`, `plan-approved-copy.sh`,
`new-command-context.sh`, `task-dossier-guard.sh`, `session-state-cleanup.sh`). Only the plan-progress
nudge was measured. The general question — what a firing costs, for every hook on every delivery surface
this plugin uses — belongs to a harness audit of the whole plugin, not to this plan.

**Reopening [Plan-006](./shipped/006-plan-progress-nudge-and-state-cleanup.md).** That plan is `Shipped` and the
lifecycle in [`.agents/rules/governance.md`](../../.agents/rules/governance.md) makes a plan permanent
rather than editable. Its Goal 1 stays on the page as written; the reversal is recorded here and in the
ADR this plan spawns at closure.

**Changing the delivery surface.** The hook keeps returning `hookSpecificOutput.additionalContext` on
`Stop`. Plan-006 already measured the alternative and rejected it; nothing found here reopens that.

## Design

### What the hook does today, and where each defect lives

The hook reads the session transcript to find which repositories this turn wrote to, resolves each one's
own plan taxonomy through `scripts/resolve-governance.sh`, finds every plan file whose status row matches
that repository's active-status word, and asks the model about the ones the turn did not itself write. It
keeps per-session state in a file named `vibe-ops-progress-<session_id>`, holding a byte offset into the
transcript and a space-separated set of plan paths it has already asked about, under the key `NUDGED=`.

Three defects sit in the loop that builds that set.

**The memo is emptied by compliance.** A plan the turn wrote is skipped with a bare `continue`, which
happens *before* the plan is recorded into the set being written back to disk. The plan therefore leaves
the memo, and the next turn treats it as never asked about. The effect is a loop in which obeying the hook
is precisely what makes it ask again: the two plans the model actually wrote entries into are the two it
was asked about most, fourteen and nine times. The proof does not require re-running anything — a
`vibe-ops-progress-*` state file left behind by a session that had written one of its repository's plans
lists every other active plan and omits exactly that one.

**The memo is emptied by working elsewhere.** The set is rebuilt from empty on every firing, and only
repositories this turn wrote to are visited. A turn that writes in one repository therefore erases the
memo for every other, and everything already asked about there becomes askable again.

**Every active plan is named at once.** The loop appends a block per matching plan with no limit. In a
repository with five plans at `In Progress` the model receives five candidates and triages them. Firings
that named two or more plans declined loudly 47% of the time; firings that named one declined loudly 29%
of the time. Narrowing helps and does not cure.

### Why the refusal is the expensive part, and why forbidding investigation is not the fix

The obvious reading of "40% of firings produced nothing" is that the model wastes effort investigating
before declining. The measurement says the opposite. Firings that ended in a refusal averaged **0.6 tool
calls**; firings that ended in a written entry averaged **4.5**. The investigation is concentrated in the
firings that succeed, and it is what makes those entries correct. An instruction telling the model not to
read the plan before deciding would save six-tenths of a tool call on the refusals and damage the
twenty-two firings that work.

What the refusals cost is not tools but **output**: 3,138 tokens each, delivered to the user as prose
about a check the user did not request. The fix is therefore in the output contract alone.

### The new output contract, and the record that replaces the spoken refusal

Plan-006's Goal 1 asked that a turn end "with that plan's living sections reflecting the turn — or with an
explicit statement that there was nothing worth recording". The explicit statement is what produces the
noise, and it buys less than it appears to. It is prose addressed to no one, verifiable by nobody, and
indistinguishable from a model that would have declined anyway.

The new contract: the declining branch produces nothing at all, and the hook itself appends one line to a
log under the directory named by `CLAUDE_PLUGIN_DATA`, so what was asked stays recoverable. The log is
partitioned by date — `vibe-ops-nudge-log-YYYY-MM-DD.tsv` — and that is load-bearing rather than
cosmetic. The hook already sweeps its own state directory with `find … -name 'vibe-ops-*' -mtime +7`, so
date-partitioned files age out through machinery that already exists, whereas a single file rewritten on
every firing would carry a fresh modification time forever and never be swept. Each line records the
timestamp, the session id, the plan path, and the plan file's modification time at the instant of the
firing. Whether the plan was subsequently written is then derivable by comparing that recorded time
against the file's current one.

The log write must fail silently and must never abort the hook, per obligation 3 of
[ADR-0009](../adr/0009-hooks-as-a-delivery-surface.md): a hook fails closed or fails silent, never open
while appearing to work.

### The limit of the log, and why a second instrument is still needed

The log records what the *hook* did. It cannot record what the *model* did, because the hook has no access
to the model's output. From the log it is possible to derive how many times the hook fired, how many plans
each firing named, whether any plan was named twice in a session, and whether a named plan was written
afterwards. It is **not** possible to distinguish a refusal delivered in silence from a refusal delivered
as a paragraph — which is the single quantity this plan most wants to drive to zero.

That quantity is only visible in the session transcripts. The measurement that produced this plan's
baseline read them, and it must be preserved as a script rather than rewritten from scratch next time, so
that the before and after are produced by the same command. It is a development instrument, not shipped
behaviour, so it may depend on `jq` unconditionally — unlike the hooks, which must degrade when `jq` is
absent.

### What the baseline was, and how it was nearly wrong

Every number in this plan comes from reading every session transcript in the directory Claude Code
keeps per project, deduplicating firings by the timestamp of the injected `hook_additional_context`
record, and attributing to each firing every assistant turn that followed it up to the next real user
prompt.

| Quantity | Value |
|---|---|
| Firings | 42 |
| Plans named per firing | mean 1.9, maximum 5 |
| Assistant turns caused | 263 |
| Tool calls caused | 108 |
| Output tokens caused | 256,625 |
| Firings with visible text and no entry written | 17 (40%) |
| Output tokens spent on those | 53,340 |
| Firings that were fully silent | 3 (7%) |
| Firings that wrote an entry | 22 (52%) |

The first version of this measurement reported 22 firings rather than 42, because it scanned only the ten
most recently modified transcripts and those files were being written while it ran. The undercount was the
less alarming of the two numbers, which is the direction this class of error usually takes.

**Two rows above are known wrong and are kept as written.** The preserved instrument built in Track 4
reproduces this table except for the plans-per-firing mean (2.1, not 1.9) and the assistant-turn count
(262, not 263) — and separately corrects a figure in Success criteria from 14 to 24. The table records
what was measured on the day the design was settled; the corrections are in Surprises, where the reason
they were wrong is also recorded. Editing the numbers here would erase the evidence that a pinned input
set was not, by itself, enough.

## Tracks

**Track 1 — Make the memo survive both compliance and working elsewhere.** Two changes in the plan loop of
`hooks/plan-progress-nudge.sh`: the set being written back starts from the previous `NUDGED=` value rather
than from empty, and a plan the turn wrote is recorded into it rather than skipped past it. What exists at
the end that did not before: a session in which a plan named once is never named again, whether the model
wrote to it, ignored it, or moved to another repository in between. Acceptance is observable on fixtures —
name a plan, write to it, fire again, and see a different plan named or nothing at all.

**Track 2 — Name one plan per firing.** The matching plans are ordered by modification time, newest first,
and the loop stops after the first one it names. Because Track 1 makes the memo stable, the plans not
named are not lost; the next firing surfaces the next one. There is a trap to avoid in the implementation:
`ls -t` invoked with an empty argument list lists the current working directory, so the result of the
`grep` that finds matching plans must be tested for emptiness before it is sorted, or the loop will be
handed arbitrary filenames and treat them as plans. What exists at the end: a firing that asks a yes/no
question.

**Track 3 — Replace the spoken refusal with silence and a log line.** The message the hook emits states
that the declining branch must produce no output whatsoever, and says so as an instruction rather than as
permission. It deliberately does **not** tell the model to avoid investigating, for the reason recorded in
the Design section. Alongside it, the hook appends one tab-separated line per firing to
`vibe-ops-nudge-log-<date>.tsv` in its state directory, failing silently if it cannot. What exists at the
end: a firing that costs the user nothing when declined, and a file that says it happened.

**Track 4 — Two sensors, answering different questions.** The first is a fragment under `scripts/checks/`,
in the style of the fifteen already there, which runs the hook against fixture repositories and asserts
that a firing names at most one plan and that a plan written after being named is not named again. Plan-006
verified this hook with ten payload cases run by hand and never automated them, which is why a regression
here would currently be invisible. The second is the preserved measurement script for the noise rate,
which the log cannot observe. What exists at the end: `bash scripts/check-agents-md.sh .` fails if the
hook's behaviour regresses, and one command reproduces the noise measurement.

## Success criteria

The three quantities the firing log can answer, read from
`$CLAUDE_PLUGIN_DATA/vibe-ops-nudge-log-*.tsv` after the change has been in use for a working day:

| Quantity | Baseline | Target |
|---|---|---|
| Plans named in a single firing | maximum 5 | maximum 1 |
| Times the worst-affected plan was named | 24 | at most one per session it is active in |
| A plan named after it was already written in that session | observed | 0 |

The second row read `14` until the preserved instrument was run against the same window and answered
`24`. That figure was the one number never recomputed after the baseline's input set was pinned — see
Surprises. Within-session repeats are what Track 1 addresses and what the firing log can group on; the
count above spans the whole window, and a plan that stays active across days is legitimately asked about
once in each of those sessions.

The two quantities only the transcript measurement can answer, from the script preserved in Track 4, over
sessions recorded after the release that ships this:

| Quantity | Baseline | Target |
|---|---|---|
| Firings producing visible text and no written entry | 17 of 42 (40%) | 0 |
| Output tokens spent on those firings | 53,340 | 0 |

Both reproduce exactly from `scripts/measure-nudge-noise.sh --until <the release date>`, which is the
command the "after" must be taken with. Scored strictly — an entry only counts if it went into a plan
the firing itself named — the same window gives 19 and 110,599; that stricter pair is reported by the
same run and is the one to watch if the routing gap ever becomes the dominant cost.

And mechanically, in this repository: `bash scripts/check-agents-md.sh .` passes, including the new
fragment from Track 4. Note that this command currently reports one failure — `manifest-sync`, because
`CHANGELOG.md`'s top heading is `Unreleased` while `.claude-plugin/plugin.json` carries `0.8.0`. That
failure predates this work and is not caused by it.

Finally, per obligation 4 of [ADR-0009](../adr/0009-hooks-as-a-delivery-surface.md), the changed hook must
be exercised with `claude --plugin-dir .` before the release that ships it, because a hook only reaches an
installed copy once a version is cut.

---

<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->

## Progress

- [x] 2026-08-06 — Baseline taken before any edit: 42 firings, 263 model turns, 256,625 output tokens,
      17 firings (40%) noise, across the full transcript history.
- [x] 2026-08-06 — Design settled through `/scope-the-work`; a throwaway implementation was written to
      test feasibility, refuted in part by measurement, and reverted so this plan starts from a clean
      tree.
- [x] 2026-08-06 — Combed for exposure before committing, on the same contract this project applies to
      research: five items removed, including a session identifier, another repository's plan number, and
      a quotation of the person who asked for the work. Every one had already passed the annotation
      rubric, which asks whether an entry earns its space and never who may read it.
- [x] 2026-08-06 — Committed to the branch `docs/plan-008-quiet-the-nudge`, cut from `origin/main`.
      **Not pushed and no pull request is open**, so nothing here has been reviewed.
- [x] 2026-08-06 — Track 1: `STILL_NUDGED` is seeded from the previous `NUDGED=`, and a plan the turn
      wrote is recorded into it instead of skipped past. The loop deliberately keeps scanning after it
      has picked its one plan, so a written plan in a *later* repository is still recorded.
- [x] 2026-08-06 — Track 2: matches ordered by modification time, newest first, one named per firing,
      with the emptiness guard before `ls -t`.
- [x] 2026-08-06 — Track 3: the declining branch is instructed to produce nothing, and every firing
      appends one tab-separated line to `vibe-ops-nudge-log-<date>.tsv` before the model is asked.
- [x] 2026-08-06 — Track 4a: `scripts/checks/27-nudge-behaviour.sh`, five assertions over fixture
      repositories. Run against the 0.8.0 hook first: all five fail there, each on a different defect.
      `bash scripts/check-agents-md.sh .` is 16 checks, 0 failed.
- [x] 2026-08-06 — Track 4b: `scripts/measure-nudge-noise.sh`, which reproduces ten of the thirteen
      baseline figures exactly, including the 53,340 noise tokens and the 0.6-against-4.5 tool-call
      split. The three it does not reproduce are recorded below.
- [x] 2026-08-06 — Exercised in a live session rather than a probe (ADR-0009 obligation 4), because a
      headless one cannot reach this hook at all. See Surprises.
- [ ] Cut the release that carries it. Until then no copy installed *from git* has any of this — a copy
      installed from a directory has had all of it since it was saved, which is how it came to be
      exercised at all.
- [ ] Re-measure with `scripts/measure-nudge-noise.sh --since <the release date>` once enough firings
      have accumulated, and record the result in Outcomes. Nothing to compare yet: one firing.
- [ ] Run `/vibe-ops:close plan` — retrospective, route every Surprises & Discoveries entry, demotion
      check, close the tracking issue. The plan file itself is kept. Stays unchecked until the plan is
      actually closed; a Progress list that is otherwise complete but has this box open is not finished.

## Surprises & Discoveries

- Observation: skill-scoped hooks exist, and they are **not** an alternative for this one — which draws
  the line this plan should have been able to state and could not.
  Evidence: `hooks:` is a `SKILL.md` frontmatter field (2026-08-10, Claude Code hooks reference): hooks
  "scoped to the component's lifecycle", running "only when that component is active" and cleaned up when
  it finishes. That makes a whole class of hook free — it costs nothing in a session that never activates
  the skill, so it never needs to be made quiet. `authoring-agents-md` takes exactly that shape in
  [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md): `paths:` loads the skill, the
  skill installs the hook, both leave together.
  Why it does not apply here: a scoped hook fires alongside a **deliberate action**, and this nudge exists
  for the case where there is no deliberate action — nobody invokes a skill for the plan they forgot to
  update. The trigger is an absence, so there is nothing to scope it to. **Scoping is the cheaper answer
  wherever a hook accompanies an intent; quieting is what remains for a hook whose whole job is to notice
  an omission.** Worth recording because "why not just scope it to a skill?" is the first question anyone
  arriving at this plan now asks, and answering it from scratch costs the same reading twice.

- Observation: obeying the hook is what makes it ask again.
  Evidence: a plan the turn wrote is skipped with `continue` before it is recorded into the set written
  back to disk, so compliance removes it from the memo. The two plans the model wrote entries into were
  asked about fourteen and nine times; a `vibe-ops-progress-*` state file left behind by a session that had
  written one of its repository's plans holds every other active plan path and is missing precisely that
  one.

- Observation: the intuitive fix — telling the model not to investigate before deciding — is backwards,
  and was written before it was measured.
  Evidence: refusals averaged 0.6 tool calls, written entries averaged 4.5. The investigation lives in the
  firings that succeed. The instruction would have saved almost nothing and degraded the 22 firings that
  produce real entries. It was drafted, measured, and deleted.

- Observation: the first measurement was wrong in the reassuring direction.
  Evidence: scanning the ten most recently modified transcripts reported 22 firings; scanning every transcript in the directory
  reported 42. The transcripts were being written while the scan ran, so the ten-file window moved between
  runs and the same command returned different answers minutes apart. Pinning the file set fixed it.

- Observation: [ADR-0009](../adr/0009-hooks-as-a-delivery-surface.md) admits hooks under four obligations,
  none of which prices a firing.
  Evidence: the obligations govern when a hook may exist, what it may duplicate, how it must fail, and how
  it must be tested — but a hook returning `additionalContext` re-enters the model, and 42 firings bought
  263 model turns. That cost is invisible in the hook's design and in the ADR that admitted the surface.

- Observation: a hook that speaks when it has nothing to say makes everything the agent says unprompted
  look like the hook — and that cost appears in none of the numbers above.
  Evidence: the first message put forward as an example of this hook misbehaving turned out, on checking
  the transcript, to be an ordinary correct answer to a direct question, which the hook had never touched.
  Once a surface is known to interject unasked, attribution stops being reliable in either direction:
  genuine output gets blamed on the hook, and real hook output would be dismissed as more of the same.
  Tokens are measurable; a voice that has stopped being trusted is not, and it is the larger loss.

- Observation: both memo defects reproduced live during the session that documented them, and the delta
  between two firings is the whole proof — no code reading required.
  Evidence: 2026-08-06, one session, two firings against the same repository. The first named five active
  plans. The second named four of those same five *again*, dropped the one the intervening turn had
  written into, and added one more. Reading the session's own state file straight afterwards shows it
  holding exactly the five just named and omitting the written one — which is defect (a) caught in the
  act, and guarantees that plan is named again on the next firing. The four that came back had been named
  earlier in the same session; every turn between the two firings wrote only into sibling repositories, so
  the loop that rebuilds the set never visited this one and its entries were simply dropped — defect (b).
  The fifth plan is not a defect: another agent had moved it from the backlog status to the active one in
  the interval, so it became genuinely eligible. That distinction is worth keeping, because a status
  change is the *only* legitimate way the set should ever grow, and after Track 1 it should be the only
  way it does.

- Observation: the evidence for this plan arrived attached to plans that have nothing to do with it, which
  is the second sighting of a limit already recorded against the hook's original design.
  Evidence: every plan the two firings named belongs to one repository; this plan lives in another. The
  hook correctly attributed the turn and correctly listed that repository's active plans, and the thing
  worth recording belonged to none of them. Plan-006's Open questions already state this — *"the nudge
  names the written repo's plan, but the lesson may belong to another repo's"* — and left it as accepted,
  on the grounds that routing is judgement and handing it to the model is the design. Nothing here
  contradicts that; it is a second observation of the same limit, which is what turns an anticipated
  trade-off into a measured one. Track 3's log will record where the hook *asked*, never where the entry
  ended up, so the gap stays invisible to the sensor as well.

- Observation: the instrument written to preserve the baseline disagreed with the baseline, and the
  disagreement was worth more than the agreement.
  Evidence: over the same window it reproduced ten of thirteen figures to the digit — 42 firings, 108
  tool calls, 256,625 output tokens, 22 firings that wrote an entry, 3 silent, 17 noisy, 53,340 tokens
  spent on those, 0.6 tool calls against 4.5, and a maximum of 5 plans in one firing. It disagreed on
  three, and the first count written here said "eleven of thirteen" — an over-claim caught only by
  recounting the two outputs side by side, which is worth recording because the direction of the slip
  was flattering to the instrument being defended.

  Two of the three disagreements are the same fault seen twice: **the throwaway program counted fewer
  plan mentions than exist.** The worst-affected plan was named 24 times, not 14, and the mean per
  firing is 2.1, not 1.9. Both are counts of the same thing, both are low, and the plausible cause is
  that neither was recomputed after the input set was pinned — they are the last surviving outputs of
  the moving-window run this plan already records as wrong. The third is one assistant turn, 262
  against 263, which is an attribution boundary and is not worth chasing.

  The fourth apparent disagreement turned out to be real and was the useful one. Reaching the original noise count required
  counting an entry written into *any* plan as a success, not only into a plan the firing had named;
  scored strictly, two expensive firings move from useful to noisy. Both counts are now reported, because
  the gap between them is the routing limit recorded two entries above, and folding them together would
  make a success criterion that can never legitimately reach zero.

- Observation: the first run of the noise instrument reported zero firings, which is the exact failure
  its own header warns about, committed while writing the warning.
  Evidence: `jq` was invoked without `-s`, so a program expecting an array of records got one record at
  a time and matched nothing; the invocation also carried `2>/dev/null`, which discarded the error that
  said so. The output was a clean table of zeroes — indistinguishable from a hook that had been fixed,
  and in the direction of the answer being hoped for. The suppression is gone and the emptiness is
  checked, but the lesson is that "a command that fails silently returns the answer you wanted" is not
  a mistake you stop making by having written it down.

- Observation: a `Stop` hook cannot be exercised headlessly, so ADR-0009 obligation 4 cannot be
  discharged the way this repository's own `AGENTS.md` says it can.
  Evidence: `claude --plugin-dir <tree> -p …` was run twice against a scratch repository holding one
  active plan. The transcript shows no `Stop` attachment from this hook at all — `--plugin-dir` did not
  register it — and, separately, each `-p` invocation ends its session, so `SessionEnd` deletes the
  per-session memo and every resumed turn arrives as a *first* `Stop`, which this hook answers by
  seeding its offset and saying nothing. Both failures are silent and each alone is enough. Obligation
  4 was discharged instead against a live session, which is stronger evidence and not a substitute
  anyone can schedule: it required waiting for the hook to fire on its own.

- Observation: the fix was in production before it was committed, let alone released.
  Evidence: this plugin is installed on this machine from a *directory* source, so `installLocation` is
  the working tree and `${CLAUDE_PLUGIN_ROOT}` resolves into it. Every edit made here was live in every
  session on the machine from the moment it was saved. That is what produced the live evidence above,
  and it inverts the standing rule that nothing reaches an install before a release is cut — the rule
  holds for whoever installs from git and is false for the person developing it, who is also the person
  least likely to notice a half-finished hook shipping into their own working day.

## Decision Log

- Decision: the plan template dropped `Progress` and `Surprises & Discoveries` (now `plan@0.2`), and this
  hook was **deliberately left broken** rather than updated in the same pass.
  Rationale: the maintainer's call was to fix the source first and let the downstream break, on the
  argument that an organised source repairs the rest more cheaply than keeping every consumer in step
  during the change. So the injected text still names four living sections where the template now has two
  (`Decision Log`, `Outcomes & Retrospective`), and repairing it belongs to this plan.
  The substantive half, which is this plan's subject rather than a side effect: **the hook offers exactly
  one destination, and that is half of a routing decision.** `rg -i task` over the whole hook returns only
  two comments — the task dossier is never named. Measured across the workspace root on the same day:
  46 entries in one plan's `Surprises` against **five across fourteen task dossiers**, eleven of which hold
  zero. The hook is not misbehaving; it is doing what it says, and what it says sends the doing-notes to
  the permanent file. Whatever this plan does about volume, the destination list is the part that changes
  where the writing lands.
  Date / Author: 2026-08-07 / Danilo Borges

- Decision: reverse [Plan-006](./shipped/006-plan-progress-nudge-and-state-cleanup.md)'s Goal 1 — a declined firing
  produces no output to the user.
  Rationale: Goal 1 required "an explicit statement that there was nothing worth recording". That
  statement is what produced 17 noisy firings and 53,340 output tokens, and it is unverifiable prose
  addressed to nobody: a model that declines correctly and a model that would have ignored the note both
  satisfy it. The observable cost exceeds an unobservable benefit. Plan-006 is `Shipped` and permanent, so
  it is not edited; this entry and the ADR below are where the reversal lives.
  Date / Author: 2026-08-06 / Danilo Borges

- Decision: the silence is paired with an on-disk firing log rather than standing alone.
  Rationale: silence alone loses the same auditability Goal 1 was protecting and returns nothing for it.
  A log returns something: it makes the firing recoverable, and it turns the re-measurement of this plan's
  own success criteria from a bespoke transcript analysis into reading a file. The distinction between a
  considered refusal and an ignored note is lost either way — that loss is accepted here, not avoided.
  Date / Author: 2026-08-06 / Danilo Borges

- Decision: do not instruct the model to skip investigation before deciding.
  Rationale: refuted by measurement — 0.6 tool calls on refusals against 4.5 on written entries. The
  instruction was written into a draft implementation and removed after the numbers came in.
  Date / Author: 2026-08-06 / Danilo Borges

- Decision: this plan spawns an ADR at closure, not now.
  Rationale: the rule — a hook's nudge is silent to the user and auditable on disk — generalises past this
  hook to every hook returning `additionalContext`, and it contradicts a goal printed in a permanent plan,
  so a reader of Plan-006 needs somewhere to find out it was reversed. `/vibe-ops:close plan` is where an
  ADR is spawned from a Decision Log entry, and writing it before the design has survived contact with an
  implementation would make an immutable record of an untested claim.
  Date / Author: 2026-08-06 / Danilo Borges

- Decision: the noise instrument counts "answered in a plan the firing named" and "wrote some plan
  entry" as two separate quantities, and scores noise against the looser one.
  Rationale: the two differ by exactly the case this plan observed twice — the hook names the plans of
  the repository that was written, and the lesson belongs to a plan somewhere else. Scoring against the
  strict count would classify that as a failed firing, so the success criterion could never reach zero
  no matter how well the hook behaved. Reporting only the loose count would hide the routing gap
  entirely. Both are printed; the criterion uses the loose one.
  Date / Author: 2026-08-06 / Danilo Borges

- Decision: ADR-0009 obligation 4 is discharged by a live firing, not by a headless probe.
  Rationale: the probe was built and run, and it cannot reach this hook — twice over, for two
  independent reasons recorded in Surprises. Insisting on the letter of the obligation would have meant
  either shipping unexercised or fabricating a probe result. The live firing gives strictly more: the
  real plugin loader, the real transcript, the real model. What it costs is schedulability — it happened
  when it happened. Any future hook whose trigger is a session boundary inherits this problem, and the
  honest form of the obligation is "exercised before release", not "exercised headlessly before release".
  Date / Author: 2026-08-06 / Danilo Borges

- Decision: options rejected, each with the observation that would reopen it.
  Rationale: deleting the hook and relying on `/vibe-ops:close` — reopen if the useful-firing rate falls
  below 25% (it is 52% today), which would mean the hook is not catching real material. Returning
  `decision: block` instead of `additionalContext` — reopen if silence proves unachievable, which the
  firing log will show. Filtering by plan freshness — reopen if a plan idle more than roughly thirty days
  is nudged, though every active plan in the repository measured had been touched within two days, so
  the filter would have removed no firing. A time-decaying memo instead of a session-sticky one — reopen
  if the log shows a session longer than four hours in which a plan gained new material after its single
  firing and nothing was recorded; rejected for now because it introduces a threshold with no measurement
  behind it, which is the criticism Plan-006 already records against its own seven-day sweep.
  Date / Author: 2026-08-06 / Danilo Borges

## Outcomes & Retrospective

All four tracks landed on 2026-08-06. Against the five goals:

**Goal 2 (complying never re-arms) and Goal 3 (one plan per firing) are done and asserted.** Both are
now properties a check fails on rather than claims: `27-nudge-behaviour.sh` was run against the 0.8.0
hook before being written down, and all five of its assertions fail there, each on a different defect.
That is the part of this work that cannot silently rot.

**Goal 5 (asserted without a release) is done, and is the reason the rest is trustworthy.** Plan-006
verified this hook with ten payload cases run by hand; every defect this plan fixed shipped past that
verification and survived months. The fixture harness is the difference between checking a hook once
and checking it every time.

**Goal 4 (re-measurable by command) is done, and the command immediately corrected the record it was
built to preserve** — two baseline figures were stale, and one was measuring something subtly different
from what it claimed. An instrument that only ever confirms the number it was built to reproduce has
not been tested. Nor has the person reading it: the first summary of how well it agreed was itself one
figure too generous, and nothing but recounting caught that.

**Goal 1 (a declined firing is silent and still recoverable) is half-answered.** The mechanism is in
place and the log works — the first live firing under the new code wrote its line, named exactly one
plan where the two firings twenty minutes earlier had named five and four, and the model answered it by
editing that plan with no visible narration at all. But *silence on decline* is the branch that has not
yet occurred, so the quantity this plan most wants at zero is not yet measured. That is expected: it is
the plan's own first open question, and the two instruments exist precisely so the answer arrives as
data rather than as an impression.

**What this cost, and what it bought.** The hook grew by roughly eighty lines, most of them explaining
why rather than what. Against that: the same workspace, measured over its whole history, spent 256,625
output tokens on 42 firings, 53,340 of them on firings that achieved nothing. The change is not
expected to make the useful firings cheaper — it makes the useless ones free.

**The one thing that would have changed the approach if known earlier**: that the plugin is installed
here from a directory source, so every edit was live in every session on the machine while this was
being written. The live evidence that discharged ADR-0009 obligation 4 is a direct consequence, and so
is the fact that a half-finished hook was briefly the real one. Neither was planned.

<!-- ===== END LIVING SECTIONS ===== -->

---

## Open questions

- **Whether the model actually obeys "produce no output".** It is not testable without running, and it is
  the first thing the firing log plus the preserved transcript measurement will answer. If it does not,
  the rejected `decision: block` option reopens. Note that this is not really a question about this hook:
  compliance with an explicit output-suppression instruction is a property of the model behind the
  session, and it will differ between model tiers. One data point exists and it is not the one needed:
  the first live firing under the new code was *answered*, and the model reached the edit with no
  visible text at all before it — so it did not narrate on the way to complying. The declining branch,
  which is the one the instruction addresses, has not fired yet. Characterising it properly belongs in whatever
  instrument this project uses to observe model behaviour, phrased so that it can be required — *how often
  a model complied when told to stay silent*, never *how often it narrated anyway*, since a measurement
  whose higher values are worse cannot be turned into a threshold. This plan only needs the local answer:
  did it stay silent here, in this repository, at the model the user happened to be running.
- **Whether this problem exists at all in a repository with one active plan.** Every number here comes
  from one workspace holding five, and the noise rate is markedly worse when more than one plan is named.
  A repository with a single active plan may be at the 29% figure or below it from the start.
- **How the two instruments will disagree.** The firing log counts what the hook did; the transcript
  measurement counts what the model did. They measure overlapping but different populations, and the first
  time they disagree the reason will be more interesting than either number.
- **Whether the seven-day sweep is the right home for the log.** The threshold is inherited from Plan-006,
  which records that it has no measurement behind it. A log is a different kind of artifact from a state
  file, and a week may be the wrong retention for something whose whole purpose is comparison over time.

## Related

- [Plan-006](./shipped/006-plan-progress-nudge-and-state-cleanup.md) — designed and shipped this hook. Its Goal 1 is
  reversed here; its Open questions already name the over-triggering half of this problem from a different
  angle.
- [ADR-0009](../adr/0009-hooks-as-a-delivery-surface.md) — admits hooks as a delivery surface under four
  obligations. Obligations 3 and 4 constrain Track 3 and the release step; the firing cost this plan
  measures is not among them.
- [ADR-0004](../adr/0004-budgeted-artifacts-and-guards.md) — the guard-versus-line rule that makes Track 4's
  check fragment the right home for an assertion rather than a sentence in a document.
