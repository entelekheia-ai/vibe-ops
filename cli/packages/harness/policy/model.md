---
vibe-ops-reference: harness-model@1
---

# The harness model, and how to judge a repository against it

A **harness** is the tooling and practice around a coding agent that keeps its output correct without a
human reading every line. The working equation is `Agent = Model + Harness`: the model is bought, the
harness is built, and it is where a repository's own leverage lives.

Deliberately repo-neutral, so it can be applied to a repository it knows nothing about. The procedure that
applies it is [`plugin/skills/setup/SKILL.md`](../../../../plugin/skills/setup/SKILL.md), Step H.

**The measurements this rests on are commands, not readings.** `vibe-ops harness shape`, `harness audit`
and `harness catalog` answer the factual half; everything below is the half that needs judgement. A number
in an audit that did not come from one of those verbs is a number someone estimated, and this document's
last section is a list of what that has actually cost.

## The two axes

The decomposition is Birgitta Böckeler's, in
[Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html)
(Thoughtworks, April 2026).

**Direction — what the component does relative to the change.**

- **Guide** (*feedforward*) — enters before the work and shapes it. Instruction files, rules, skills,
  templates, reference docs, code mods, conventions.
- **Sensor** (*feedback*) — measures after the work and reports. Tests, linters, type checkers, structural
  tests, static analysis, review, logs, browser output.

**Execution — what runs it.**

- **Computational** — deterministic, CPU, milliseconds to seconds, reliable. A test either passes or does
  not.
- **Inferential** — semantic, model-run, slower, costlier, non-deterministic. Instruction files and skills
  are *inferential guides*: they work by a model choosing to honour them. Model-graded review is an
  *inferential sensor*.

The 2×2 they form is the audit's instrument:

|  | **Computational** | **Inferential** |
|---|---|---|
| **Guide** | scripts, codemods, generators, lint config, editor config | instruction files, rules, skills, templates, conventions |
| **Sensor** | tests, linters, type checkers, structural tests, hooks, CI | model review, LLM-as-judge, human review |

**Why the classification carries weight.** An inferential guide has no failure mode that anyone observes.
When a model does not honour a rule, nothing errors — the work simply proceeds differently, and the
divergence is found later by someone looking for something else, if at all. A computational sensor fails
loudly by construction. A repository whose entire investment sits in the top-right cell has bought
guidance it cannot verify is working.

Reading the filled grid is mechanical:

| What the grid shows | What it means |
|---|---|
| Guides full, sensors empty | The repository instructs and never verifies. Every rule is honoured by choice. |
| Sensors full, guides thin | The agent gets corrected repeatedly for things nobody told it. Expensive per change. |
| Everything late in the lifecycle | Quality is found at review or CI, when it is most expensive to fix. |
| Inferential sensors only | Verification costs a model call every time and is non-deterministic. |

**The empty inferential-sensor cell is usually fine.** Model-graded review is expensive and optional. The
empty *computational-sensor* cell is the finding, because that is the half whose absence is invisible: a
guide nobody follows produces no error, so nothing ever reports it.

## Position in the change lifecycle

Böckeler's second principle is **keep quality left**: distribute sensors across the lifecycle by cost,
speed and criticality, as far toward the start as each can usefully run. Same check, different position,
different economics.

| Position | Cost | Authority | Suited to |
|---|---|---|---|
| While the agent works | milliseconds | advisory | per-file checks the agent can fix for free, immediately |
| Self-correction loop | seconds | advisory | anything the agent should resolve before finishing a turn |
| Pre-commit | seconds | blocking | whole-tree checks whose repair is fast and local |
| Pre-push / CI | minutes | blocking | full suites, cross-cutting checks, anything slow |
| Scheduled / continuous | any | reporting | drift, entropy, decay — things no single change causes |

The last row is what OpenAI's team calls **garbage collection**: recurring agent tasks that scan for
deviation from encoded principles and open small, reviewable fixes, rather than letting debt compound
into a cleanup that never gets scheduled
([Harness engineering, February 2026](https://openai.com/index/harness-engineering/)).

A harness where everything sits at the last two rows is not wrong, but it is expensive: every defect is
found when fixing it costs the most.

## Three regulation categories

A harness regulates three different things, and they mature at very different rates.

- **Maintainability** — conventions, structure, legibility. Best served today; most conventions are
  expressible as a linter or a structural test.
- **Architecture fitness** — module boundaries, dependency direction, layering. Served by structural tests
  and custom linters; the tooling exists and is under-used.
- **Behaviour** — does the thing actually do what it should. The weakest by far. Feedforward is a
  specification; feedback is the test suite, which is itself increasingly agent-written. There is no
  settled answer here, and an audit should say so rather than manufacture one.

## Instruction files: map, not encyclopedia

The failure modes of a single large instruction file are documented from practice: context is scarce and
a large file crowds out the task; when everything is marked important nothing is; it rots faster than
anyone maintains it; and a monolith resists mechanical checking. The working shape is a short entry point
that points at deeper sources — progressive disclosure, with the deeper material verified by its own
checks.

## Context is an attention budget, not a cost line

The governing principle for what enters context is the **smallest set of high-signal tokens** that
produces the desired behaviour
([Anthropic, effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).
Note *smallest set*, not *shortest text*: enough to fully specify the behaviour, and nothing that competes
with it.

Two consequences an audit must hold together:

- **Prompt caching makes always-on context cheap in money.** Recommending trimming to save cost is usually
  arguing about rounding.
- **Nothing makes it cheap in attention.** Long contexts degrade non-linearly, and the mechanism that
  bites hardest in a well-documented repository is *distractor interference* — material that is
  semantically close to the task and irrelevant to it. A repository's own governance corpus is exactly
  that shape during a coding session.

So the trimming recommendation is real, and the reason usually given for it is not.

## Turning a gap into a recommendation — three tests, in order

A gap that fails any of these is not reported as a recommendation. It is reported as **considered and
dropped, with the reason**, which is a different and equally useful line.

1. **Does it already exist?** `vibe-ops harness catalog` answers this mechanically: it lists every gate and
   check fragment the install ships that is composed into nothing. Search the repository and its tooling
   before proposing to build anything. This is the most common failure of the whole genre — a confident
   recommendation to build a check that is already written and merely unwired. *Wiring* something and
   *building* it are recommendations of wildly different cost, and only one of them is usually true.
2. **Is it prose describing machinery?** An instruction that says "before committing, search the diff for
   X" is a `grep` written in English. Those convert one-for-one and are the highest-value findings in any
   audit, because they cost always-on attention *and* fail silently. Quote the instruction and name the
   command it becomes. `/vibe-ops:new-signal` is the verb that performs the conversion.
3. **Would blocking on it punish the wrong action?** A check whose repair takes sixty seconds and no
   context switch can block. A check whose repair requires a separate ceremony — consolidating a corpus,
   rebuilding an index, a rewrite — must warn and name what fixes it. Blocking on the second kind is how a
   gate gets switched off in its first week.

## Five ways this audit produces confident nonsense

Every one has happened. The first four are now answered by a verb; they are kept because knowing *why*
the verb exists is what stops someone reaching for the shell again.

- **A shell glob that matched nothing, with `2>/dev/null` swallowing the error.**
  `ls "$d/.github/workflows/"*.yml 2>/dev/null | wc -l` returns `0` for *every* repository whether or not
  workflows exist. It produced "this workspace has no CI at all", which was false and more dramatic than
  the truth. `harness shape` reads the directory and distinguishes absent from empty; be suspicious of any
  hand-rolled sweep that returns zero uniformly.
- **Deriving a measurement instead of taking it.** A file's line count estimated from its word count was
  off by 35%, and the estimate was placed against a published budget. `harness audit` reports an exact
  count per guide, and asserts it against `wc -l` including the no-trailing-newline case.
- **Recommending what already exists.** Fifteen versioned check fragments, including the exact one being
  recommended, sat in a dependency the repository already had. `harness catalog` is that reading; test 1
  above exists because of this.
- **Assuming CI.** A repository with no remote cannot have CI, and "add CI" sounds correct everywhere, so
  the recommendation survives review. `harness shape` reports whether a remote exists; check it before
  offering anything that needs one.
- **Proposing a hook for native behaviour.** A post-write linting hook was designed and written into a
  plan before anyone observed that the harness already returned those diagnostics unprompted. This one has
  no verb and cannot get one: write a file and look at what comes back.

When a measurement is corrected mid-audit, report both the wrong result and the right one. The wrong one
is usually the more alarming, and a reader deserves to know it was caught rather than never produced.

## Sources

- [Böckeler, *Harness engineering for coding agent users*](https://martinfowler.com/articles/harness-engineering.html) — the two axes, keep-quality-left, regulation categories, harness templates.
- [Böckeler, *Harness Engineering — first thoughts*](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering-memo.html) — the shorter memo that precedes it.
- [OpenAI, *Harness engineering: leveraging Codex in an agent-first world*](https://openai.com/index/harness-engineering/) — instruction-file failure modes, golden principles, garbage collection.
- [Hashimoto, *My AI adoption journey* — "engineer the harness"](https://mitchellh.com/writing/my-ai-adoption-journey#step-5-engineer-the-harness) — the origin of the term's current use.
- [Anthropic, *Effective context engineering for AI agents*](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — attention budget, compaction, sub-agent isolation.
- [Anthropic, *Effective harnesses for long-running agents*](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — the initializer/worker split for work spanning context windows.
- [`ai-boost/awesome-harness-engineering`](https://github.com/ai-boost/awesome-harness-engineering) — index of the wider field: evals, memory, sandboxing, observability.
