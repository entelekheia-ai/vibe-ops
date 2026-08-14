---
vibe-ops-template: task@3
---

# Task: `plan status` cannot distinguish a healthy plan from a stalled one

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-08-14 |
| Author | Danilo Borges |
| Issue | pending |

---

## Context

`vibe-ops plan status` is the coherence read: it reports every plan whose `Status` disagrees with its own
track checkboxes. That is the only automatic signal a plan has, and `/vibe-ops:close-plan` Step 0 leans on
it — the skill installs `hook plan-status` while it runs precisely so the mistake it detects is reported
at the moment it is made.

The check is correct and it is narrow. A plan marked `In Progress` with unchecked tracks is *coherent* by
its definition, whether the work stopped two hours ago or two months ago. So the one state the reader most
needs to be warned about — a plan that has quietly stopped moving — is the state the verb is guaranteed to
stay silent about, and its silence reads as health.

Measured 2026-08-14, closing a plan in a repository consuming this plugin: the plan had been `In Progress`
for two weeks with two of its three tracks never started, and `plan status` reported `no incoherent plan
found` throughout. The stall was found by a human reading the file, which is the thing the verb exists to
make unnecessary. Both tracks were then cut at closure, because in the interval the artifacts they were
going to act on had been retired — which is the second-order cost: a stalled plan does not merely wait,
it accumulates scope that has already been overtaken.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Decide what a stall reads from, given that elapsed time alone is wrong | S |
| 2 | P1 | Implement the reading and report it beside coherence, not as a second status | M |

### 1. Decide what a stall reads from — P0

**What:** Settle the signal before writing it. The obvious one — a plan `In Progress` for longer than N
days — is wrong on its own: a plan is deliberately long-lived, and a threshold tuned to catch a stall
would fire on every healthy plan that spans a quarter. The candidate signals worth weighing are the age of
the last change to the plan's own track checkboxes (movement, not existence), whether any track has a
dossier that is itself open, and a track's prose declaring itself unstarted while the plan claims to be in
progress.

**Why:** A stalled plan silently expires: the world moves under its tracks and the scope it still declares
stops being the scope anyone would choose, so closure becomes a series of cuts rather than a set of
completions. Nothing currently reports this, and the one verb that could is answering a different
question truthfully.

**Change:** No code yet — the decision, recorded here, then in an ADR if it turns out to be hard to
reverse. Whatever is chosen must be readable from the repository itself, since `plan status` takes no
external state.

### 2. Implement it beside coherence — P1

**What:** Report the stall as its own finding from the same verb, with its own rule name, rather than
widening what "incoherent" means.

**Why:** Coherence is a claim about the file contradicting itself and is always a defect. A stall is a
claim about the work and may be a deliberate pause. Collapsing the two makes the first unactionable —
`plan status` is currently a verb whose empty output is trustworthy, and that is worth keeping.

**Change:** `cli/packages/module-plan/src/index.ts` and the status reader in `cli/packages/records/`.
The finding needs a level a repository can override, since a repo pausing a plan on purpose must be able
to say so without turning the verb off.

## Implementation order

- [ ] P0 — Decide the signal, and write down which candidates were rejected and why
- [ ] P1 — Implement, with a fixture holding a stalled plan and a healthy long-lived one, so the
      distinction is asserted rather than assumed
- [ ] P1 — Confirm `/vibe-ops:close-plan` Step 0 says what to do when the new finding fires, since a
      stall is not by itself a reason to refuse to close

## Surprises & Discoveries

- Observation: The stall was invisible to the verb *and* to the ceremony that reads it, because both are
  built to catch a file contradicting itself and a stalled plan contradicts nothing.
  Evidence: 2026-08-14. `close-plan` Step 0's own text names the risk it covers — a plan closed while a
  track is open, making the file lie — and its remedy is `plan status`. Neither half asks whether the
  open track is still being worked, and the skill's review clause names `plan status` as the place a
  defect would live if the hook stayed silent on an incoherent plan. It stayed silent on a *coherent* one,
  which is outside what either was built to see.

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
