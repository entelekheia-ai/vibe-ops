---
name: new-signal
description: 'Turn one rule into a matched pair: the prose that steers the agent, the deterministic guard that enforces it, and the fixture proving the guard fires. Use when an instruction says "never do X" and nothing checks it, when a harness audit finds prose describing machinery, when a repeated review comment should become a check, or "/new-signal <the rule>". Creates one signal per run; it has no update mode — an existing guard is edited in place.'
argument-hint: "<the rule, in one sentence>"
effort: inherit
---

# /new-signal — a rule, the guard that enforces it, and proof the guard works

An instruction that says *never commit a machine path* is a `grep` written in English. It costs always-on
attention, it is honoured by choice, and when it is not honoured **nothing reports it** — the work simply
proceeds differently and the divergence is found later by someone looking for something else.

This skill converts one such rule into a pair: the prose stays, and a deterministic guard starts failing
on the thing the prose asks nobody to do.

**Read [`${CLAUDE_PLUGIN_ROOT}/references/harness-pair.md`](../../references/harness-pair.md) first.** It
is the contract — what binds three artifacts into one signal, why the fixture is a condition of
installation rather than a recommendation, and what a sensor may never name. This file is the procedure;
that file is the reasoning, and it is not repeated here.

**This is an event skill** ([why that matters](../../references/convergence-policy.md)). It records one
signal at a point in time. Running it twice correctly produces two signals; it has no update mode — a
guard that needs to change is edited in place, and a rule that has been superseded gets its guard deleted
rather than re-scaffolded.

## Step 0 — Which detector surface this repository has

**Two exist, and they are not interchangeable.** Decide before Step 4, because everything from there on
differs — where the sensor is written, what its contract is, where its fixture lives, and who is allowed
to make it emit.

```bash
ls scripts/checks/_run.sh 2>/dev/null          # the shell harness
ls cli/packages/gates 2>/dev/null || ls packages/gates 2>/dev/null   # the composed one
```

| What you found | The sensor is | Read |
|---|---|---|
| `scripts/checks/_run.sh` | a **shell fragment** the runner composes | Steps 4–7 as written, "shell" column |
| a `packages/gates/` tree | a **gate**, composed by an **ops** | Steps 4–7, "gate" column, and `cli/AGENTS.md` §Gates and ops |
| neither | nothing to compose a sensor into | stop; run `/vibe-ops:setup harness` first |

**A repository holding both gets the gate.** Fragments are being retired; write a new detector as one only
when there is no `packages/gates/`. Editing a fragment that already exists is not covered by this rule.

---

## Step 1 — Name the failure, not the check

The signal id is a short, lowercase, hyphenated name for **what goes wrong**: `machine-path`,
`invented-reference`, `absent-frontmatter`. Never for the tool or the file that catches it.

This is the decision that is expensive to reverse, because every reading ever taken is filed under it. Two
tests:

- **Could a second, unrelated check witness the same thing?** If yes, the name is at the right level, and
  that second check will join this signal rather than starting a rival one.
- **Does the name survive replacing the tool?** `markdown-lint` does not; `unresolved-link` does.

Then state the rule in one sentence, in the imperative, as it will read in the guide. If that sentence
needs a "usually" or a "should", stop: **a rule with exceptions is not ready to be a guard**, and the
honest outcome here is to write the guide alone and say so.

## Step 2 — Decide whether it can be checked at all, before writing either half

Three questions, in order. A no to the first two ends the run, and that is a legitimate outcome to report.

1. **Is the violation mechanically visible?** A shape in a file, a missing path, a pattern in tracked
   text — yes. An intent, a tone, a judgement about whether an abstraction is right — no. Say so and stop:
   a guard that approximates a judgement produces false positives, and a check whose standard response is
   `--no-verify` trains the reflex it exists to prevent.
2. **Does it already exist?** Search the repository, the composed built-ins (`check-agents-md.sh --list`),
   and any linter already configured. **This is the most common failure of this whole genre**: a confident
   new guard for something already written and merely unwired. *Wire it* and *build it* differ by an order
   of magnitude and only one is usually true.
3. **Would blocking on it punish the wrong action?** A violation repairable in sixty seconds without a
   context switch can block. One needing a ceremony — consolidating a corpus, rebuilding an index — must
   warn and name what fixes it. Getting this wrong is how a gate is switched off in its first week.

## Step 3 — Write the guide

Where it goes is the repository's business, not this skill's: an always-on rule under `.agents/rules/`, a
section of an existing instruction file, or a reference the file points at. The routing table in
[`instruction-surfaces.md`](../../references/instruction-surfaces.md#where-each-fact-goes) decides;
[`authoring-style.md`](../../references/authoring-style.md) decides how it reads.

Two things this guide must carry that ordinary prose does not:

- **The reason, not just the prohibition.** The guard already states the prohibition, mechanically and
  without argument. What the guard cannot carry is why anyone should care, and that is the half a reader
  needs in order to eventually decide the rule can go.
- **The shapes the guard deliberately allows** belong in the *fragment's* header, not here — that is where
  the pattern lives, and a near-miss documented three files away from the regex that implements it goes
  stale the first time the regex is tightened. Identify them now, because Step 4 has to encode them and
  Step 5 has to build them as decoys; write them down beside the pattern.

## Step 4 — Write the sensor

Where, and against which contract, follows from Step 0.

**Shell fragment.** A file at `scripts/checks/NN-<signal-id>.sh`, defining `check_<signal_id>` with `-` as
`_`. Pick `NN` from the gap in what is already composed; the number is ordering only, and a fragment sorts
near the ones it is thematically adjacent to. The contract is in the runner's own header: a fragment may
use `fail`/`pass`/`skip`, `head_`, `norm_rel`, `tracked_md` and `$ROOT`, declares `CHECK_VERSION` as an
integer, and **must not write anything into `$ROOT`**.

**Gate.** A folder at `packages/gates/src/<signal-id>/index.ts`, default-exporting `defineGate({ id,
version, summary }, run)`. `run` receives `{ files, documents, options }` and returns
`{ findings, examined }`; a finding is `{ rule, file, line?, evidence }`, where `rule` names the failure
and is what every reading is filed under. Three properties have no shell equivalent and are where a first
gate goes wrong:

- **A gate does not choose its population.** It is handed `files` and reads them. Never filter by a
  repository-specific path rule inside the detector — that belongs to the ops entry's `paths`, and to the
  repository's own `ignore` config. A hardcoded exclusion here is invisible to the person it affects.
- **A gate does not decide whether a finding blocks.** It declares a default `level`; the repository
  overrides it by rule, by label, or with `"*"`.
- **Read the parsed document, not the file.** `documents.get(file)` carries the tree; `proseText` masks
  code spans and `describedText` keeps them, and which one a detector reads decides whether a quoted
  example counts as a mention. A line-based regex over the raw text is how a gate accuses its own
  documentation.

Then compose it: one entry in the ops that owns this population, `{ gate: "<signal-id>", paths: [...] }`.
**A gate nothing composes is a file**, exactly as an unwired fragment is.

Four rules with teeth:

- **`skip` is a verdict, not a fallback.** A check that examined nothing reports `skip` with the reason,
  never `pass`. A pass over an empty population is indistinguishable from a real one, and that is how a
  check goes quiet without anyone noticing.
- **Decide whether a finding may be named**, and say why in the header. Most may: the offending text is
  already in the tree, so printing it discloses nothing and hiding it leaves nobody able to fix it. Some
  may not — a check searching for material that must not be published cannot print what it found, and
  reports only where the entry came from.
- **The guard must not fire on the guide.** A document explaining the rule contains the shape the rule
  forbids, in elided or quoted form. Make the pattern narrow enough to pass it, and say in the header
  which elisions are deliberate. A guard that flags its own documentation is one people switch off.
- **Do not make it emit yet.** The emit line is Step 7, and it is added only once the guard is proven.

## Step 5 — Build the fixture it fails, and prove it red

**This is the step that makes the rest worth anything**, and it is the one that gets dropped. A check that
detects nothing passes exactly like a check that works.

An input that violates the rule, plus **at least one decoy** — a near-miss from Step 3 that must *not*
fire. A fixture with only violations passes whether or not the check distinguishes anything, so the decoy
is what gives the assertion meaning.

Where it goes follows from Step 0: for a **fragment**, the repository's `scripts/checks/self-test.sh`; for
a **gate**, the owning ops's own test suite, extending the broken fixture it already builds rather than
starting a second one — a fixture that lives beside the others is run by whoever runs them, and a private
one is run by whoever remembers it. Assert the evidence string **this** signal alone produces, not only
its rule name: a rule name in a list passes on any finding filed under it, including one the detector
already made before this change.

Then assert both directions:

```sh
# the fixture, before the fragment is in place — must NOT report the signal
# the fixture, with the fragment  — must report it exactly as many times as there are real violations
```

Run it and **watch it fail before it passes**. An assertion written against a check that already passes
has proven nothing.

**A fixture must not inherit the operator's environment.** Clear what
the run must not see, once, where the fixture is built — once rather than per invocation, so an assertion
added later inherits the isolation instead of the bug.

## Step 6 — Prove it green on the real repository, and handle the backlog

Run the full gate. A guard that lands with a backlog of pre-existing violations is a guard someone turns
off, so decide explicitly and say which:

| The backlog is | Do |
|---|---|
| small and mechanical | fix it in the same change; the guard lands green |
| large but bounded | fix it first, as its own change, then land the guard |
| legitimate for this repository | the guard is wrong here — narrow it, or declare the exception explicitly and report `skip` naming the declaration |

The third row is not a defeat. A rule that is right in general and wrong in one place needs the exception
**declared and visible**, never inferred from something incidental like whether the repository has a
remote yet.

### If the fragment ships to repositories other than this one

A guard written inside a plugin — or inside any tree that other repositories compose their checks from —
does not land in one repository. It lands in **every repository the runner composes it into**, on the
next run, with no release and no opt-in. "Run the full gate" then checks the one repository you happen to
be standing in, which is the one place the backlog was least likely to be.

So before it lands, run it against **every repository that composes it**, and apply Step 6's table to each
independently. Expect the answers to differ: the same guard is routinely correct in one repository and
wrong in another, and finding that out afterwards means finding it out as a blocked commit in a repository
whose owner did not ask for the check.

Skipping this is invisible from inside the authoring repository, where everything is green.

## Step 7 — Make it report, if there is anywhere to report to

Only after Steps 5 and 6. The shape, the population rules and the absent-destination guarantee are all in
[`harness-pair.md`](../../references/harness-pair.md). **Who adds it differs by surface, and this is the
one place the two disagree outright:**

- **Shell fragment** — the fragment adds its own emit call, resolving the emitter as
  `$HOME_ROOT/sh/gate-emit.sh` rather than the literal `${CLAUDE_PLUGIN_ROOT}` path; that file's "Where
  the emitter lives" section says why the literal path is usually silently absent.
- **Gate** — **add nothing to the gate.** Emission is `{ gate: "…", emits: true }` on the ops entry, and
  the ops builds the emitter itself from the repository's `artifactDir`.

Emit only a signal that is behavioural and recurrent. A structural property stays corrected once
corrected, and its series is a flat line.

**Then prove the absent case by diff, not by argument**: with the destination variable unset, the check's
output must be byte-identical to what it produced before the emit line existed.

A repository with no destination stops at Step 6 with a complete, working pair. That is not a partial
result — the guard is useful on the day it lands, and the measurement is what tells you later whether the
guide can go.

## Step 8 — Report what was made, and what was not

Name the signal id, the guide's path, the fragment's path, the fixture's assertions, and whether it emits.
State plainly whether the guard was **proven red first** — if it was not, the pair is unverified and
should be said to be.

## Checklist

- [ ] Step 0 ran: the detector surface was read off the repository, not assumed
- [ ] The signal id names the failure, not the check or the tool
- [ ] Step 2 ran: mechanically visible, not already existing, and block-versus-warn decided by the
      sixty-second test rather than by severity
- [ ] For a gate: it chooses neither its population nor whether its findings block, and it is composed
      into an ops — a gate nothing composes is a file
- [ ] The guide carries the reason and the deliberately-allowed near-misses, not just the prohibition
- [ ] The fragment reports `skip` with a reason when its population is empty — never `pass`
- [ ] Whether a finding may be named was decided, and the reason is in the fragment's header
- [ ] The guard does not fire on the guide that explains it, and the deliberate elisions are documented
- [ ] The fixture carries at least one decoy, and the assertion was **observed red before green**
- [ ] The fixture clears whatever environment it must not inherit
- [ ] The full gate is green on the real repository, or the backlog decision is stated
- [ ] If the fragment ships to other repositories: run against **each** of them, with Step 6's table
      applied independently — not just against the repository it was authored in
- [ ] If it emits: absent-destination proven by diff against the pre-emit output, not asserted
- [ ] The report says whether the guard was proven red first

## ⟳ After every use: review this skill

Step 2's three questions are the load-bearing part, because everything after them is mechanical. **The
edit worth making is the signal that passed all three and should not have been built** — or the one that
failed question 2 as "already exists" when what existed was close enough to look like a match and
different enough to be useless. That distinction is where this file is thinnest.

Two failure modes that look like the skill working:

- **A fixture written after the fragment passed.** It will assert exactly what the fragment already does,
  including its bugs, and it will never have been red. If a run produces one, Step 5 needs a sharper
  prompt rather than a longer one.
- **A guard whose backlog was "fixed" by narrowing the pattern until the tree was clean.** That is the
  third row of Step 6's table reached by accident instead of by decision, and the resulting guard checks
  whatever happened to be easy.

**When a repository's detector surface changes, this file is part of that change.** The symptom to check
for is a step that names exactly one place a sensor can live.

Fold back what the run taught: a Step 2 question that decided the outcome and is not among the three, a
near-miss class Step 3 does not name, a sensor contract the runner or `defineGate` enforces that Step 4
does not state.
If a run produced no edits, say so — a pair that fit the procedure exactly is signal too.
