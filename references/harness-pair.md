# The harness pair — a rule, the guard that enforces it, and the reading that says whether it worked

A repository that works with coding agents has two halves. **Guides** feed forward — instruction files,
rules, skills, templates, conventions: everything that shapes what the agent does before it acts.
**Sensors** feed back — tests, linters, type checkers, hooks: everything that reports on what actually
happened. Most repositories invest in one half.

This file is the contract for building both at once, plus the third thing neither can supply alone. It is
the single copy of what governs `setup harness` and `new-signal`; a `SKILL.md` that restates any of it has
created a second copy, and the copy in the skill is the one that goes stale.

## Why the pair, and not two separate good ideas

A guide is **inferential**: it changes what a model tends to do, and it has no failure mode anyone
observes. When a rule is not honoured, nothing errors — the work simply proceeds differently, and the
divergence is found later by someone looking for something else, if at all.

A guard is **computational**: it says yes or no, deterministically, and it says nothing at all about
whether the rule was worth writing.

Written separately, each hides the other's failure. A guide nobody follows produces no error; a guard
nobody needed passes forever. Written as a pair with a reading attached, they answer each other:

| The reading says | What that means | What to do |
|---|---|---|
| Violations, steadily | the rule is real and the guide is not landing | strengthen the guide, or move the check earlier |
| Violations falling to zero, then staying | the guide worked | consider deleting the guide — the guard holds the line alone now |
| Zero from the first day, forever | the rule described a problem nobody had | delete both, and say so |

**The third row is the one no repository can currently answer**, and it is the only thing that lets an
instruction file shrink on evidence rather than on taste. That is the whole argument for measuring.

## A signal is three artifacts with one identity

| Artifact | What it is | Where it lives |
|---|---|---|
| **guide** | the prose that steers — a rule, a section of an instruction file, a reference | the repository being steered |
| **sensor** | a check fragment, plus **a fixture it fails** | the repository being checked, or the plugin that ships to it |
| **measurement** | the trait, its declared failure categories, and the analysis to consult when it stops passing | wherever the destination lives |

Three files with no shared identity are three artifacts, not one signal. What binds them is **the signal
id**: a short, lowercase, hyphenated name for the *failure mode*, never for the check. `machine-path`, not
`52-machine-paths`; `invented-reference`, not `links`.

That distinction is load-bearing. Several checks catching the same failure in different places are **one**
signal with a larger population, and naming by check produces a taxonomy that grows with the tooling
rather than with the phenomena — losing the only property that makes the numbers worth having, which is
that two checks witnessing the same behaviour become comparable evidence about it instead of two unrelated
counters.

## A generated gate must ship a fixture it fails

Not a recommendation — a condition of installation. **A check that detects nothing passes exactly like a
check that works.** At ten hand-written guards that is repairable by whoever remembers; at fifty generated
ones it is not, and the green stops meaning anything.

So every sensor arrives with a deliberately broken input and an assertion that it fires on it, and the
assertion is proven **red before the fix and green after** — never written afterwards against a check that
already passes. A sensor whose fixture passes is a build failure, not a warning.

Two ways this is quietly defeated, both observed here:

- **A fixture that trips every rule at once.** If every input in it is broken in some way, an assertion
  about *the fraction* affected is never exercised — and the shape that only appears in the fractional
  case goes untested for as long as that holds. Include at least one deliberately clean input.
- **A fixture that inherits the operator's environment.** A self-test that reads a variable the operator
  happens to have set is judging the fixture against someone's machine state, and it passes or fails for
  reasons unrelated to the check. Clear what the run must not see, once, where the fixture is built —
  once rather than per invocation, so an invocation added later inherits the isolation instead of the bug.

## The vocabulary boundary — a sensor names a rule, never a meaning

A sensor reports **what its tool found**, in the tool's own terms. It never names the observation, the
dialect, the failure category, or the destination's vocabulary for any of them. That mapping belongs to a
translator on the receiving side, and it is versioned there, because a translation that changes moves the
numbers exactly as a re-measurement does.

Two reasons, and the second survives the first being solved:

1. **The check must keep working where the destination is absent** — it cannot import from it and cannot
   fail without it. A repository that adopts a guard must not thereby adopt a dependency it cannot remove.
2. **A check that spoke the destination's vocabulary would have to be edited every time that vocabulary
   moved**, in a repository with no reason to know the vocabulary exists.

### Rule ids for a sensor with no tool to borrow from

A sensor wrapping a linter reports that linter's rule ids and is done. A shell fragment has none, so it
declares its own, under one rule: **the id names the shape that was found, never the reason it matters.**

| Write | Not |
|---|---|
| `home-path` | `exposure-violation` |
| `unresolved-link` | `invented-reference` |
| `absent-frontmatter` | `invalid-structured-output` |

The right-hand column is the destination's vocabulary wearing a rule id. Lowercase, hyphenated, and
stable — a rule id that changes silently reclassifies every reading ever taken under it.

## What a reading has to carry, and why pass/fail is not enough

A gate that reports only whether this run passed has already destroyed the answer. Four rules:

- **The denominator follows from the failure mode, never from the check, and never from commits.**
  References *emitted*; documents *carrying frontmatter*. A rate over commits measures how often somebody
  committed, not how often the failure occurred.
- **Declare the unit actually counted.** A check that examined files reports `unit: file`. It does not
  report references it never enumerated merely because references are what the destination would prefer.
  If the destination needs a unit the reading does not carry, that is a refusal, not a conversion.
- **Zero examined is not a reading.** A record of nothing examined is indistinguishable from a record of
  nothing wrong, so nothing is written at all. Zero *findings* over a non-empty population is a perfectly
  good reading and is written.
- **Take the reading where the failure is still visible.** At a gate that is the *attempt*, not the
  completed run: a blocked commit never reaches anything that fires afterwards, so measuring later
  describes a generator that never errs. A blocked attempt is not a missing data point — it is the data
  point.

## Where the emitter lives, and why it cannot move

The emitter — `${CLAUDE_PLUGIN_ROOT}/scripts/gate-emit.sh` — turns one tool's diagnostics into the neutral
artifact. It ships with this plugin, so a fragment composed from here can emit in any repository the
plugin reaches rather than only in one that separately installed something.

It standardizes **shape**; the translator on the receiving side standardizes **meaning**. That split is
not tidiness — the emitter has to run inside the gate because it captures what only the producing side can
know:

- **The population.** Linters report diagnostics and generally do not report how many inputs they
  examined, which is why the count is supplied by the caller and never derived here. Nothing downstream
  can recover a denominator nobody captured.
- **The moment.** Whether a reading was taken at a blocked attempt is knowable only where the attempt
  happens.

**Destination absent.** The output path comes from an environment variable and nothing else. Unset means
the check writes no artifact, does no work beyond what it already did, and reports exactly what it
reported before — no import, no probe for a directory, no error path. Verify that by diffing the check's
output with the variable unset against its output from before the emit line existed; it is a property to
prove, not to assert.

**A fragment never writes into the repository it is checking.** The artifact goes to the environment
variable's directory, which the caller creates. A check that edited the tree it judges would be doing the
one thing every skill invoking it promises not to.

## The order these are built in

Write the guide and the sensor together, in one change, with the fixture. Add the measurement when there
is somewhere for it to go — a signal with no destination is still a working pair, and the guard is useful
on the day it lands.

The reverse is not true: **a measurement with no guide measures nothing anyone chose.** A reading exists
to say whether a rule is working, so the rule has to have been written down first, as prose someone can
point at and eventually delete.
