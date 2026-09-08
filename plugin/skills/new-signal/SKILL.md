---
name: new-signal
description: 'Turn one rule into a matched pair: the prose that steers the agent, the gate that enforces it, and the fixture proving the gate fires. Use when an instruction says "never do X" and nothing checks it, when a harness audit finds prose describing machinery, when a repeated review comment should become a check, when judging whether an existing gate covers everything a check it replaced did, or "/new-signal <the rule>". Creates one signal per run; it has no update mode — an existing gate is edited in place.'
argument-hint: "<the rule, in one sentence>"
effort: inherit
---

# /new-signal — a rule, the gate that enforces it, and proof the gate works

An instruction that says *never commit a machine path* is a `grep` written in English. It costs always-on
attention, it is honoured by choice, and when it is not honoured **nothing reports it** — the work simply
proceeds differently and the divergence is found later by someone looking for something else.

This skill converts one such rule into a pair: the prose stays, and a deterministic gate starts failing
on the thing the prose asks nobody to do.

**Read [`${CLAUDE_PLUGIN_ROOT}/references/harness-pair.md`](../../references/harness-pair.md) first.** It
is the contract — what binds three artifacts into one signal, why the fixture is a condition of
installation rather than a recommendation, and what a sensor may never name. This file is the procedure;
that file is the reasoning, and it is not repeated here.

**This is an event skill** ([why that matters](../../references/convergence-policy.md)). It records one
signal at a point in time. Running it twice correctly produces two signals; it has no update mode — a
gate that needs to change is edited in place, and a rule that has been superseded gets its gate deleted
rather than re-scaffolded.

## Step 0 — Which of the three shapes this detector is

**A new detector is a gate. There is no second surface.** Shell fragments are being retired and none is
written any more; a repository still holding some is holding history, and editing one that exists is not
covered here. What the repository already composes is worth reading before you add to it:

```bash
ls cli/packages/gates 2>/dev/null || ls packages/gates 2>/dev/null   # a gates tree of its own
vibe-ops config get ops 2>/dev/null                                  # ops this repository declares
```

**Three shapes, and all three work outside the vibe-ops checkout.** Pick by what the detection is, not
by which repository you are standing in:

| What you need | Where it goes |
|---|---|
| an existing gate (`classification`, `mirror`, `markdown-link`, `budget`, …) over a population of yours | one entry in a local `ops.json` — **no new code at all** |
| a detector this repository owns and nobody else wants | a **local gate**: a plain `.mjs` in the repository, named by path from that same `ops.json` |
| a detector every repository should get | a gate in the vibe-ops checkout (`packages/gates/src/<id>/index.ts`), composed by a shipped ops |

Try them in that order. The first is a config edit; the second is one file with no dependencies; only the
third obliges you to be working inside vibe-ops itself.

### Composing an existing gate: a local `ops.json`, and nothing else

An ops collection is a **JSON file**, and the gates it names resolve out of the installed CLI's own core
— so a repository composes detectors of its own with no import, no dependency and no publication. Two
files:

```jsonc
// .vibe-ops/ops.json — this repository's own composition
{
  "id": "local",
  "version": "0.0.1",
  "summary": "this repository's own detectors",
  "gates": [
    { "gate": "classification", "label": "no-todo", "paths": ["**/*.md"],
      "options": { "level": "internal", "rule": "todo-left",
                   "subject": "an unfinished note left in a committed document",
                   "forbid": ["TODO"] } }
  ]
}
```

```ts
// vibeops.config.ts — a path resolves against the repository root; a bare name resolves as a package
export default { ops: { local: "./.vibe-ops/ops.json" } };
```

`vibe-ops check` then composes it beside the defaults and reports it in the same line. Verified end to
end on 2026-09-08 in a scratch repository with nothing installed but the CLI: the entry fired
(`FAIL [todo-left] notes.md:3`). Steps 1–3 and 5–8 all apply unchanged; Step 4 is the entry above rather
than a new file.

### A local gate: one file, no dependencies

**A gate does not have to be built against anything.** `loadGate` accepts any module whose default export
carries `{ definition, run }` and revalidates the definition itself — a gate that never called
`defineGate` reaches that check intact. So a repository writes one in plain JavaScript, with no imports,
no `package.json` and nothing installed but the CLI on `PATH`:

```js
// .vibe-ops/no-shouting.mjs — no imports; `documents` and `files` arrive from the ops
export default {
  definition: { id: "no-shouting", version: 1, summary: "no ALL-CAPS headings" },
  run: ({ files, documents }) => {
    const findings = [];
    for (const file of files) {
      for (const [i, line] of (documents.get(file)?.text ?? "").split("\n").entries()) {
        if (/^#+\s+[A-Z][A-Z ]{4,}$/.test(line)) {
          findings.push({ rule: "shouting-heading", file, line: i + 1, evidence: line.trim() });
        }
      }
    }
    return { findings, examined: files.length };
  },
};
```

```jsonc
// .vibe-ops/ops.json — a path is repository-relative; a bare name is a built-in; @scope/x is a package
{ "id": "local", "version": "0.0.1", "summary": "this repository's own detectors",
  "gates": [ { "gate": "./.vibe-ops/no-shouting.mjs", "label": "no-shouting", "paths": ["**/*.md"] } ] }
```

Verified end to end on 2026-09-08 in a scratch repository: `FAIL [shouting-heading] notes.md:3`, composed
into the same `N checks, M failed` line as the built-ins.

`definition.version` is required and is an integer, for the same reason it is on a shipped gate: two
readings filed under one rule are comparable only while the detector between them has not moved.

### The one thing that still needs the vibe-ops checkout

**Writing the gate in TypeScript against core's types.** `import { defineGate } from
"@entelekheia/vibe-ops-core"` resolves that bare specifier from the importing file, and the packages are
**not published** — so outside this checkout there is nothing to resolve and no way to install it
(measured 2026-09-08; `npm link` does not close it either, only the CLI is linked globally). Write the
plain-JavaScript form above instead; it is not a downgrade, it is the same object without the compile-time
check. A gate that belongs to every repository is the other case, and it belongs in this checkout anyway.

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
2. **Does it already exist?** Search the repository, what is already composed (`vibe-ops check --list`),
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
- **The shapes the guard deliberately allows** belong in the *gate's* header, not here — that is where
  the pattern lives, and a near-miss documented three files away from the regex that implements it goes
  stale the first time the regex is tightened. Identify them now, because Step 4 has to encode them and
  Step 5 has to build them as decoys; write them down beside the pattern.

## Step 4 — Write the gate

**A local gate is the file from Step 0** — a plain `.mjs` exporting `{ definition, run }`, named by path
from the repository's own `ops.json`. **A shipped gate** is a folder at `packages/gates/src/<signal-id>/
index.ts` inside this checkout, default-exporting `defineGate({ id, version, summary }, run)`. The
contract below is identical for both; only the wrapper and the location differ. `run` receives `{ files, documents, options }` and returns `{ findings, examined }`; a
finding is `{ rule, file, line?, evidence }`, where `rule` names the failure and is what every reading is
filed under.

Three properties are where a first gate goes wrong:

- **A gate does not choose its population.** It is handed `files` and reads them. Never filter by a
  repository-specific path rule inside the detector — that belongs to the ops entry's `paths`, and to the
  repository's own `ignore` config. A hardcoded exclusion here is invisible to the person it affects.
- **A gate does not decide whether a finding blocks.** It declares a default `level`; the repository
  overrides it by rule, by label, or with `"*"`.
- **Read the parsed document, not the file.** `documents.get(file)` carries the tree; `proseText` masks
  code spans and `describedText` keeps them, and which one a detector reads decides whether a quoted
  example counts as a mention. A line-based regex over the raw text is how a gate accuses its own
  documentation.

Then compose it: one entry in the ops that owns this population — `{ gate: "<signal-id>", paths: [...] }`
for a shipped gate, `{ gate: "./.vibe-ops/<name>.mjs", label: "<signal-id>", paths: [...] }` for a local
one. **A gate nothing composes is a file.** If the repository has no ops of its own, the entry goes in
the local `ops.json` from Step 0, which `config.ops` names by path.

Three rules with teeth:

- **`skip` is a verdict, not a fallback.** A gate that examined nothing reports `skipped` with the reason,
  never a clean result. A pass over an empty population is indistinguishable from a real one, and that is
  how a check goes quiet without anyone noticing.
- **Decide whether a finding may be named**, and say why in the header. Most may: the offending text is
  already in the tree, so printing it discloses nothing and hiding it leaves nobody able to fix it. Some
  may not — a gate searching for material that must not be published cannot print what it found, and
  reports only where the entry came from.
- **The guard must not fire on the guide.** A document explaining the rule contains the shape the rule
  forbids, in elided or quoted form. Make the pattern narrow enough to pass it, and say in the header
  which elisions are deliberate. A guard that flags its own documentation is one people switch off.

## Step 5 — Build the fixture it fails, and prove it red

**This is the step that makes the rest worth anything**, and it is the one that gets dropped. A check that
detects nothing passes exactly like a check that works.

An input that violates the rule, plus **at least one decoy** — a near-miss from Step 3 that must *not*
fire. A fixture with only violations passes whether or not the check distinguishes anything, so the decoy
is what gives the assertion meaning.

It goes in the owning ops's own entry (`fixture: { expect, files }`), extending the broken fixture that
ops already builds rather than starting a second one — a fixture that lives beside the others is run by
whoever runs them, and a private one is run by whoever remembers it. Assert the evidence string **this**
signal alone produces, not only its rule name: a rule name in a list passes on any finding filed under it,
including one the detector already made before this change.

Then assert both directions:

```sh
# the fixture, before the gate is composed — must NOT report the signal
# the fixture, with the gate composed   — must report it exactly as many times as there are real violations
```

Run it and **watch it fail before it passes**. An assertion written against a check that already passes
has proven nothing.

**A fixture must not inherit the operator's environment.** Clear what the run must not see, once, where
the fixture is built — once rather than per invocation, so an assertion added later inherits the isolation
instead of the bug.

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

### If the gate ships to repositories other than this one

A gate composed into an ops that other repositories install does not land in one repository. It lands in
**every repository composing that ops**, on their next run, with no opt-in. "Run the full gate" then
checks the one repository you happen to be standing in, which is the one place the backlog was least
likely to be.

So before it lands, run it against **every repository that composes it**, and apply Step 6's table to each
independently. Expect the answers to differ: the same guard is routinely correct in one repository and
wrong in another, and finding that out afterwards means finding it out as a blocked commit in a repository
whose owner did not ask for the check.

Skipping this is invisible from inside the authoring repository, where everything is green.

## Step 7 — Make it report, if there is anywhere to report to

Only after Steps 5 and 6. The shape, the population rules and the absent-destination guarantee are all in
[`harness-pair.md`](../../references/harness-pair.md).

**Add nothing to the gate.** Emission is `{ gate: "…", emits: true }` on the ops entry, and the ops builds
the emitter itself from the repository's `artifactDir`. A gate that reached for an emitter would be
deciding something the composition owns.

Emit only a signal that is behavioural and recurrent. A structural property stays corrected once
corrected, and its series is a flat line.

**Then prove the absent case by diff, not by argument**: with `artifactDir` unset, the run's output must
be byte-identical to what it produced before `emits` was added.

A repository with no destination stops at Step 6 with a complete, working pair. That is not a partial
result — the guard is useful on the day it lands, and the measurement is what tells you later whether the
guide can go.

## Step 8 — Report what was made, and what was not

Name the signal id, the guide's path, the gate's path, the ops entry that composes it, the fixture's
assertions, and whether it emits. State plainly whether the guard was **proven red first** — if it was
not, the pair is unverified and should be said to be.

## Judging an existing gate instead of writing one

The same questions answer a different job: **does a gate that already exists do everything a check it
replaced did?** That is not a comparison a tool can run once the two are not the same shape, so it is
asked here, per check, and answered in writing:

1. What does the old check detect — every branch of it, read from its source, not from its name?
2. Which gate and which `rule` covers each branch, and where is it composed?
3. **What input makes the gate fail?** If no fixture already proves it, Step 5 applies before any
   retirement: a port nobody has watched fail is a port nobody has tested.
4. What does the old check do that nothing covers? That is the answer, and it is a legitimate one — it
   means the old check stays, or the gap gets its own signal through Steps 1–7.

Write the answers down where the retirement decision lives. A retirement justified by "the port exists"
is the failure this whole procedure is against.

## Checklist

- [ ] Step 0 ran: whether an existing gate already detects this shape was decided BEFORE a new gate was
      considered, and the publication blocker was checked before any gate file was written
- [ ] The signal id names the failure, not the check or the tool
- [ ] Step 2 ran: mechanically visible, not already existing, and block-versus-warn decided by the
      sixty-second test rather than by severity
- [ ] The gate chooses neither its population nor whether its findings block, and it is composed into an
      ops — a gate nothing composes is a file
- [ ] The guide carries the reason and the deliberately-allowed near-misses, not just the prohibition
- [ ] The gate reports `skipped` with a reason when its population is empty
- [ ] Whether a finding may be named was decided, and the reason is in the gate's header
- [ ] The guard does not fire on the guide that explains it, and the deliberate elisions are documented
- [ ] The fixture carries at least one decoy, and the assertion was **observed red before green**
- [ ] The full gate is green on the real repository, or the backlog decision is stated
- [ ] If the ops ships to other repositories: run against **each** of them, with Step 6's table applied
      independently
- [ ] If it emits: absent-destination proven by diff against the pre-emit output, not asserted
- [ ] The report says whether the guard was proven red first

## ⟳ After every use: review this skill

Step 2's three questions are the load-bearing part, because everything after them is mechanical. **The
edit worth making is the signal that passed all three and should not have been built** — or the one that
failed question 2 as "already exists" when what existed was close enough to look like a match and
different enough to be useless. That distinction is where this file is thinnest.

Two failure modes that look like the skill working:

- **A fixture written after the gate passed.** It will assert exactly what the gate already does,
  including its bugs, and it will never have been red. If a run produces one, Step 5 needs a sharper
  prompt rather than a longer one.
- **A guard whose backlog was "fixed" by narrowing the pattern until the tree was clean.** That is the
  third row of Step 6's table reached by accident instead of by decision, and the resulting guard checks
  whatever happened to be easy.

**Step 0's blocker has an expiry.** When `@entelekheia/vibe-ops-core` is published, a consumer repository
can author a gate and the "stop at Step 3" instruction becomes wrong — delete it then, and check whether
Step 4's composition paragraph still describes how a consumer declares its own ops.

Fold back what the run taught: a Step 2 question that decided the outcome and is not among the three, a
near-miss class Step 3 does not name, a gate contract `defineGate` enforces that Step 4 does not state.
If a run produced no edits, say so — a pair that fit the procedure exactly is signal too.
