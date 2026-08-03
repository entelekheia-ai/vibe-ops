# Research — why an instruction that is loaded is not an instruction that is followed

Feeds the open decision on whether this plugin should ship hooks at all, and which ones. There is no ADR
for it yet; this document is its input. If accepted, it extends
[ADR-0004](../adr/0004-budgeted-artifacts-and-guards.md) — *a guard, not a line* — with a third category
the ADR does not currently name.

> **Attribution.** External findings are **linked inline at first use** — follow the link for the original
> claim. Anything *not* linked is our own measurement: a corpus study of 40 plan-mode plans accumulated on
> one operator's machine, and three instrumented headless sessions run against a throwaway repository.

## The question

Every skill in this plugin ships instructions, and the plugin's own guard policy already distinguishes two
ways to deliver one: write it as a **line** in an instruction file, or enforce it as a **guard** in CI.
The question this investigation started from was narrower — could a plan written in Claude Code's plan mode
come out in this plugin's plan format, instead of being transcribed into it afterwards?

It turned out to be the wrong question, or rather too small a one. The interesting result is not about
plans. It is that **where an instruction is delivered changes whether it is obeyed**, and neither "line"
nor "guard" describes the third option.

## What the published documentation specifies

The [hooks reference](https://docs.claude.com/en/docs/claude-code/hooks) documents the event set and,
importantly for this question, *where in the conversation* each event's injected text lands:

- `SessionStart` and `Setup` place their text at the start of the conversation, before the first prompt.
- `UserPromptSubmit` and `UserPromptExpansion` place it **alongside the submitted prompt**.
- `PreToolUse` / `PostToolUse` place it next to the tool result; `Stop` places it at the end of the turn.
- Plan mode writes the plan to a file on disk *before* calling `ExitPlanMode`, and the hook receives both
  the content and the file path.
- `InstructionsLoaded` fires whenever a `CLAUDE.md` or a `.claude/rules/*.md` enters context, reporting
  why: eagerly at session start, as an include, or lazily when a `paths:` glob matches.

The documentation describes these as placement details. The measurement below suggests placement is the
whole mechanism.

## What we measured

**The corpus.** 40 plans produced by plan mode over months of ordinary use, median 10KB, ranging 3.2–23KB.
They converge, unprompted, on a stable de facto structure — and the overlap with this plugin's plan
template is uneven in a specific way:

| Element of the template | Present in the corpus |
|---|---|
| A context / summary opening | 100% |
| A verification or success section | 93% |
| Ordered steps, phases or changes | 50% |
| Files touched | 35% |
| Out of scope | 23% |
| Decisions taken | 23% |
| Design / approach | 13% |
| Risks | 10% |
| **Goals** | **0%** |
| **Metadata table (Status / Created / Author)** | **0%** |
| **Progress, Surprises & Discoveries, Decision Log, Outcomes** | **0%** |

Plan mode already produces the *descriptive* half of the format on its own. It produces none of the
half that makes a plan a governance record rather than a description — the four living sections, the
metadata, and the goals a retrospective is later written against. That boundary is not arbitrary: the
descriptive half is what the author needs to start work, and the governance half is what a *later* reader
needs. Nothing in the moment of planning creates pressure to write the second half.

Half the corpus is in a language other than English. This plugin guarantees English output in everything
it writes — a guarantee that holds only inside an invoked skill, and the corpus is what happens outside one.

**The instrumented sessions.** A throwaway repository was built with a plan template, an always-on rule
naming the template's path, a second rule scoped to the governance folder with a `paths:` glob, and hooks
on six events dumping every payload received. Three headless plan-mode sessions were run against it.

Three things came out of it that were not predicted from reading the documentation:

1. **A hook can tell it is in plan mode, before the model plans.** The `UserPromptSubmit` payload carries
   `permission_mode: "plan"`. `SessionStart` does not carry it at all — at session start, nothing knows
   whether the session will ever enter plan mode. So the only anchor for "inject at the moment of
   planning" is the per-turn event, and it is exact: a guard on one string comparison, silent in every
   other turn, session and repository.
2. **A one-line always-on rule pulls the full governance rule in behind it.** The always-on rule names the
   template path; the model goes and reads the template; that read matches the `project/**` glob and the
   scoped rule loads lazily. `InstructionsLoaded` reported it explicitly as a glob match triggered by the
   template file. The cheap line is not merely documentation — it is the trigger that loads the expensive
   rule exactly when it is relevant.
3. **Under injection, plan mode produced the full format.** The plan file written by plan mode came out
   with the H1, the metadata table, Summary, Goals, Scope in/out, Design, Tracks, Success criteria and all
   four living sections, in English — against a corpus baseline where those elements appear 0% of the time.

The mechanism was then rebuilt as a real plugin hook and exercised end to end, with the plugin loaded from
its working tree rather than an installed release. Two runs, and the second is the one worth reporting:

- **With a one-line always-on rule naming the template**, the plan came out in the full format *and
  included two sections the injected text never names*. The injection says to read the template; the model
  read it, and took more from it than was dictated. That is the outcome to want — the hook positions, the
  template governs.
- **With that line removed, on a small change**, the plan came out in the ordinary plan-mode shape. The
  hook demonstrably ran. Two explanations survive and were not separated: the always-on line is
  load-bearing, or the model correctly applied the injection's own condition — the text asks for the
  format only when the turn produces *a durable design record rather than a one-off change*, and a
  five-line debounce is a one-off change.

**No claim is made here that the hook is sufficient on its own.** The evidence supports the weaker and
more useful statement: the line and the hook do different jobs — the line makes the template discoverable
and pulls the scoped governance rule in behind it, the hook places the format and the number at the moment
of writing — and the measured success had both.

## A fourth delivery position, found late and not yet tested

The settings schema carries a key, `plansDirectory`, documented as *"custom directory for plan files,
relative to project root; if not set, defaults to `~/.claude/plans/`"*. A repository that sets it in its
own `.claude/settings.json` would have plan mode write its plan **into the repository** rather than into a
global scratch directory keyed by a generated slug.

It was then measured, and it does more than relocate a file. In a run with the setting present, **no
always-on line and no injection at all**, the plan landed inside the repository *and* came out in the full
template format. `InstructionsLoaded` shows why: the scoped governance rule loaded, triggered by a read of
the plan template. Nothing had pointed the model at that template — telling it that plans belong under
`project/plans` was apparently enough for it to look around `project/`, find the template, and pull the
governance rule in behind it.

So the setting belongs to a category none of the reasoning above considered: not a line, not a guard, not
placed context, but **a setting that changes where the artifact lands** — and, as a side effect, what the
model goes looking for before writing it. It is cheaper than all three, being two lines of configuration
and no plugin at all.

Two things it does *not* do. The file is named by a generated slug, not by the repository's numbering, so
a rename still stands between the artifact and the convention. And the H1 still carries a guessed number —
correct in the measured run only because the directory was empty. Whatever else changes, the number has to
come from disk.

The prompt in that run described work with two distinct pieces. The run that produced an ordinary
plan-mode plan described a five-line change. Prompt weight is a confound across every session here and was
never controlled for; no claim in this section separates it from the mechanism.

Two claims we had reasoned our way to from the documentation were wrong, and the measurement is what
caught them. Both are recorded here because the reasoning that produced them was plausible and will be
produced again.

- *"There is no signal for entering plan mode, so injection has to happen at session start."* False, and
  the cost of believing it is real: a session-start injection pays context in every repository and every
  session to serve the small fraction of turns that plan anything.
- *"A rule scoped to `paths: ["project/**"]` cannot load during plan mode, because plan mode reads source
  files."* False. It loads, lazily, as soon as anything under that path is read — including the template
  the always-on line just told the model to read.

We also have to state a contradiction with **our own experiment**. The first session (no injection)
differed from the later two in two variables at once — the injection *and* the prompt wording — so it is
not a clean control and no conclusion is drawn from it. The 40-plan corpus is the control that carries the
claim, because it is a large unassisted baseline measured independently of the sessions.

## What this implies across the plugin

If placement is the mechanism, the plugin has been delivering several of its invariants in the weakest
available position. The sweep, by skill:

**The four `new-*` skills** each open by discovering the same things — which directory holds the artifact,
which template governs it, what number comes next — with several shell round trips at invocation time.
`UserPromptExpansion` fires when the command is typed, matches on the command name, and can carry a
resolved answer as `additionalContext`. One script serves all four. It costs no context in any session
where the command is not typed, and the values it carries are computed from disk, which no static line can
do. The plan-mode result makes this concrete: under injection the model invented `Plan-001` because
nothing told it the real next number. Injecting a format without injecting the number ships a collision.

**`new-plan`** additionally has the plan-mode anchor described above.

**`new-task`** has the same shape of win but no equivalent anchor. There is no "task mode". The nearest
moments are the first substantial todo list of a session, and the teammate task events — both weaker
signals than a permission mode, both requiring a per-session marker to fire once instead of repeatedly.
The discovery injection applies unchanged; the moment-of-creation injection does not transfer.

**`close-task` and `close-plan`** carry the invariant most likely to be skipped, because it must hold days
after the skill that stated it last ran: the living sections are maintained *while* the work happens, and a
dossier is closed through the ceremony rather than deleted. One half of that is mechanically detectable —
a command that deletes a dossier is a string a `PreToolUse` hook can refuse. That is a line in a checklist
today and can become a guard, which is exactly the move ADR-0004 already prescribes. The other half —
noticing that a turn should have updated a plan's `Progress` — is a `Stop`-event judgement, not a string
match, and should be treated as a separate and more speculative proposal.

**The English guarantee** is the cross-cutting case, and the honest answer is that it does not become a
guard. Detecting that a document was written in the wrong language is not a grep. It stays an instruction,
and the corpus says that instruction is ineffective outside an invoked skill. What *can* be done is carry
it in every injection, which the plan-mode session confirmed works.

**The target-state skills** (`repo-setup`, `authoring-agents-md`, `authoring-readme`, `license-setup`)
gain little. Their invariants are already guarded in CI by the validator, and unlike the event skills they
have no privileged moment to be positioned at — a repository baseline is not something the model is about
to do at an identifiable instant.

## What is still open

- **Whether the hook works without the always-on line is unmeasured**, and the run that separates the two
  explanations above was designed and not executed. Until it is, treat the two as complementary rather
  than substitutable, and do not remove the line on the strength of the hook.
- **Who decides "durable"** is unresolved by construction. The injected text delegates that judgement to
  the model, which is what keeps a plans directory from filling with one-off changes — and is also what
  makes the hook's effect hard to observe, since declining the format is a correct outcome that looks
  identical to the hook failing.
- **The `ExitPlanMode` payload was never captured.** The tool is unavailable in headless mode; it needs an
  interactive session. Nothing in the recommendation depends on it, but the claim that a hook could move
  the finished plan into place is untested.
- **One model, one repository, three sessions.** The corpus is broad but the instrumented runs are not.
  The format result should be re-measured on a second model before being treated as a property of the
  mechanism rather than of one model's compliance.
- **Whether the injected format survives a long plan-mode research phase** was not tested. The probe
  repository was five lines long; the context injected alongside the prompt sat close to the moment of
  writing. A plan-mode session that reads fifty files before writing may not be the same experiment.
- **The cost of being wrong was not measured.** Every hook this plugin ships fires in every repository
  where the plugin is installed, including repositories that never adopted this convention. The guards
  proposed above all exit on a cheap test, but "cheap" here is asserted, not benchmarked.

## Conclusions carried into decisions

1. **There are three delivery positions, not two.** A line in an instruction file, a guard in CI, and
   context placed at the moment of the act. ADR-0004's rule stands, and gains a clause. *(Ours.)*
2. **An instruction that must hold at a specific moment should be delivered at that moment**, and if there
   is no event for that moment, the invariant is weak by construction and should be described as such
   rather than restated more firmly. *(Ours.)*
3. **A cheap always-on line earns its place by what it triggers**, not by what it says — naming a path
   causes the file to be read, which loads the scoped rule behind it. It is the hook's complement, not its
   competitor, and shipping the hook does not retire it. *(Ours, from the documented lazy loading
   behaviour; the substitutability question is open, above.)*
4. **Any injected format must carry the values computed from disk**, or it manufactures collisions. *(Ours,
   from the invented plan number.)*
5. **Prefer the narrowest event that carries the condition in its payload.** A per-turn hook guarded by a
   field is cheaper than a session-level hook that cannot know whether it is needed. *(Ours.)*
