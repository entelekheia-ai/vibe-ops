# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **0.4.0 is the first cut release.** The entries below it record versions the manifest carried before
> that: they exist in history, not on a release page, because each was bumped by the commit that added
> the feature. From 0.4.0 on, the version in `.claude-plugin/plugin.json` moves only when a release is
> actually cut. That distinction is not bookkeeping — the plugin is installed as a git clone **pinned to
> a released version**, so anything that has landed but not shipped is unreachable from
> `${CLAUDE_PLUGIN_ROOT}` in every install.

## [Unreleased]

### Added — the survey runs in a read-only subagent

- **`agents/governance-auditor.md`, the plugin's first agent surface.** Every target-state skill opens
  with a survey, and `audit` mode is that survey alone. Both used to run in the skill's own context, where
  "write nothing" was a sentence in the same file that had just explained how to write everything. The
  agent holds `Read`, `Grep`, `Glob` and `Bash` and no writing tool, so the guarantee is enforced by the
  tool set instead of promised by prose — and the directory listings, `vibe-ops check` output and `test -L`
  probes stay in its context, while only the gap list comes back to the caller.
- **`agents/` is auto-discovered — no manifest entry.** Measured: with no `agents` key in `plugin.json`,
  `claude --plugin-dir` lists the file as `vibe-ops:governance-auditor`. The manifest field exists but
  takes an *array of file paths* rather than a directory, so declaring it would cost one entry per agent
  and buy nothing; adding an agent stays "adding a file", as adding a skill is "adding a folder".
- **`convergence-policy@2` owns the delegation contract**, in one copy: the four inputs a caller passes,
  the gap-list shape that comes back, and the inline fallback for an install pinned to a version that
  predates the agent. `setup` (both modes), `authoring-agents-md` and `migrate` each point at it in one
  line instead of restating it.

### Changed — the document model reaches the last four hand-rolled gates (Plan-013)

- **`memory-slug`, `pairing`, `claude-md-content` and `check-frontmatter` read the parsed document
  instead of the file.** Each was solving, by hand, the problem the document model exists to solve:
  `memory-slug` toggled a fence flag and stripped code spans with a regular expression; `pairing` tested
  a `CLAUDE.md` for `@AGENTS.md` with a bare substring match, so a mention inside a code span or a fenced
  example read as a real import; `claude-md-content` stripped HTML comments the same fragile way.
- **`proseText(document)`, new in `@entelekheia/vibe-ops-core`,** is the one shared primitive all three
  needed: the document's prose with a fenced block, frontmatter, an HTML block and every inline code
  span masked to spaces, the same length as the source so a match index is a valid `lineAt` argument
  with no offset arithmetic. `[[slug]]` inside a code span never becomes a `text` node under the inline
  grammar at all — masking the source string is the only approach that actually finds what a line-based
  regex found.
- **`check-frontmatter` now detects frontmatter that does not parse, any fault, not only the one
  unquoted-`": "` shape a regular expression could name.** `rootNode.hasError` is a real, independent
  finding beside the existing heuristic — which stays, because it names the offending key in language
  that says what will happen, which a bare parse failure cannot.
- **`fragment-parity` forwards `options` to the gate it compares against.** Previously hardcoded to `{}`,
  so `check-frontmatter` was always compared under its `rule` default — `45-skill-frontmatter.sh` could
  not be validated against its own port at all. Three parity entries now run in `agents-md`, all reporting
  zero `port-regression` against this repository's own checkout.

## [0.9.0] — 2026-08-12

Six pieces of work. One changes a hook's behaviour in every repository this plugin is installed in; one
closes a leak the record-writing skills had no rule against; the third is design groundwork that reaches
a first live consequence in the fourth — a hook that repairs `AGENTS.md`/`CLAUDE.md` pairing on write. The
fifth moves the whole governance lifecycle out of shell and into the CLI, and is the one that changes what
a user types. The sixth puts a version on everything that can change behaviour and makes the verbs act on
it, which is what turns a stamp into routing.

### Added — versions travel with the record (Plan-012)

- **Every governance record declares its template version in frontmatter**, as
  `vibe-ops-template: <type>@<integer>`, and the header table below it is presentation only. The HTML
  comment above the H1 is the previous form and is still read, so a repository mid-migration is not
  reported as undeclared. **An artifact declaring no version is reported as unknown and refused, never
  resolved to the oldest known shape** — that guess is wrong in both directions.
- **`vibe-ops plan close` and `vibe-ops task close` dispatch on the version they were handed**, before
  any mutation. A record on an older version is closed with one line naming the documents that describe
  its shape; an undeclared, newer or mismatched one stops with the reason. **A current record produces no
  mention of a version anywhere** — the common path acquires no version vocabulary.
- **`records` becomes a noun with verbs**, like `plan`/`task`/`log`: `records resolve --type <t>` replaces
  the bare `records --type <t>`, and two verbs are new. **`records census`** reports every record and the
  version it declares; **`records handling <paths…>`** answers, per record, which version it is and which
  documents describe that shape.
- **Every gate, shell fragment, ops and module declares a version**, and it travels into the emitted
  observation's instrument field, so two readings under one id can be told apart when the detector
  between them changed. `defineGate` and the shell runner both refuse a definition without one.
- **Each file under `plugin/references/` declares `vibe-ops-reference: <name>@<integer>`**, and a closure
  reports the routing policy version it applied — which closures ran under which rule is now a query.

### Fixed — four surfaces that were silent (Plan-012)

- **`--json` printed nothing and exited 0 on a terminal**, for every module that declares it: `data` was
  rendered only by the MCP and hook surfaces. An empty success is the worst shape a query can have.
- **A refused verb reached an MCP client with no reason attached.** The refusal travelled in the text
  content, which a client discards in favour of `structuredContent`; `summary` and the logged output now
  travel there too. This affects every module's refusal, not only the destructive-confirmation gate.
- **A closure could report zero dangling references while leaving dead ones.** The check asked only about
  markdown links, and a plan's track list names its dossiers in code spans.
- **`fragment-parity` reported agreement when the runner did not exist** — a missing path returns no
  output, which read as "the fragment flagged nothing". It now skips, naming why, and records which two
  versions it compared even on a clean run.
- **`vibe-ops plan close` never ticked the plan's own closure box**, so every plan this repository has
  shipped reported itself as terminal-with-an-unchecked-track forever. `task close` had the equivalent
  from the start.
- **The `prefer-mcp` hook suggested a call that was wrong, not merely incomplete.** It reported module and
  verb only, so a verb reached through flags — the two new `records` ones — was answered as an empty call
  that runs something else and succeeds. The suggestion now carries the whole invocation: flags with their
  arity resolved from the module's own definition, and positionals as `args`.

### Changed — the governance lifecycle is three CLI nouns (Plan-011)

- **`/vibe-ops:close` is now `/vibe-ops:close-task` and `/vibe-ops:close-plan`.** The two lifecycles end
  differently — a dossier is deleted, a plan moves folder — and `paths:`/`hooks:` are declared per skill,
  so one file could not carry a trigger for each. Both keep the routing step verbatim.
- **A closed plan moves to `project/plans/shipped/` and keeps its number.** `vibe-ops plan close` sets the
  terminal status, `git mv`s the file, and **repoints links in both directions**: every link into the
  plan, and every relative link the plan itself carries from one level deeper. Nothing is deleted — the
  plan is the record someone reads in a year.
- **`vibe-ops` gains three governance nouns with verbs**, reachable identically from a terminal, over MCP
  and from a hook: `plan resolve|status|context|file|close`, `task resolve|close|guard`,
  `log resolve|index|sweep|lint`, plus `records resolve|census|handling` for the two record types with no
  noun of their own.
  `plan status` is new detection — it reads a plan's `Status` against its own track checkboxes, which no
  guard did before.
- **`log index` generates `project/log/README.md` from the entries themselves**, and `new-log`'s Step 5
  becomes "run it". The index rows *are* each entry's `description:`; the grouping is derived from `path:`.
- **Seven shipped shell scripts are gone**, 1,107 lines of them, each deleted in the same commit as its
  replacement. `plugin/scripts/` is down to `session-touched-repos.sh`, which is session bookkeeping
  rather than governance logic. **This makes the plugin and the CLI co-dependent**: five of the seven hook
  registrations now name `vibe-ops` directly, so a machine without it on `PATH` gets a loud failure rather
  than an install that looks like it works.
- **Record structure is read from a parse tree, not from lines.** A checkbox quoted in a fenced example is
  not a track; a closure marker quoted in a transcript does not block a deletion; a link written inside a
  code span is not rewritten when a dossier closes. Each of those was measured, not assumed.

### Fixed

- **`scripts/check-agents-md.sh --self-test` no longer emits its fixture's fabricated findings into a real
  destination.** `GATE_ARTIFACT_DIR` is now cleared alongside the other two variables the fixture must not
  inherit. The fixture is *designed* to violate every rule, and `.githooks/pre-commit` both exports that
  variable and runs the self-test whenever a commit stages a fragment — so its deliberate machine path was
  spooled as a genuine reading and ingested downstream as a repository violating the rule, over a
  population of 9 files. Nothing errored; the self-test passed and so did the gate. Third instance of the
  same hazard and the first to leave the machine, which is why the fix clears the variable **once, where
  the fixture is built**, rather than at each invocation.

- **`skills/setup/templates/harness/checks/_run.sh`'s composition-integrity assertion no longer fails a
  freshly installed, legitimately empty `scripts/checks/`.** Found rolling the harness out to real
  repositories (Plan-020 Track 3): the assertion existed to catch a fragment directory silently going
  missing from composition, but it read "nothing appeared in the output" the same way whether the
  directory held fragments that stopped composing or simply held none yet — so every fresh install
  failed before its first `/vibe-ops:new-signal`. Now split into two checks: the directory itself
  missing (still a hard failure, proven by moving `scripts/checks/` aside) versus it holding a fragment
  that did not compose (a hard failure only when there is something to lose).

- **[`hooks/plan-progress-nudge.sh`](plugin/hooks/plan-progress-nudge.sh) — the nudge now remembers what it
  asked, names one plan at a time, and produces nothing when it declines.** Three defects shipped in
  0.7.0/0.8.0, all in one loop. Its memory of what it had already asked about was rebuilt from empty on
  every firing and repopulated only from the repositories that turn wrote to, so working in a sibling
  repository erased it everywhere else. A plan the turn had itself written was skipped before the memory
  was written back, so complying with the nudge is what re-armed it. And every active plan was named at
  once, so the model triaged a list rather than answering a question.

  The output contract is reversed with them.
  [Plan-006](./project/plans/shipped/006-plan-progress-nudge-and-state-cleanup.md)'s first goal asked a declining
  turn for "an explicit statement that there was nothing worth recording"; measured across one
  workspace's whole session history, that statement is what 40% of firings produced. It is replaced by
  silence, plus one tab-separated line per firing in a date-partitioned log under the plugin's data
  directory, so the decision stays recoverable without being spoken. The reversal, its measurements and
  what it cost are in [Plan-008](project/plans/008-quiet-and-audit-the-plan-progress-nudge.md).

- **`hooks/plan-approved-copy.sh` — the `| Repository |` row no longer
  survives into the filed plan.** The row is routing metadata: it exists so an approved plan-mode plan
  written from a workspace root can be filed into the repository it actually belongs to. The hook read it
  and then wrote the plan verbatim, so an absolute path on the author's machine landed in a permanent —
  and possibly public — governance record, in exactly the case the row exists for. It is now stripped as
  the file is written, and the model is told it was, so it does not put it back. The placeholder form the
  template ships is dropped too.

- **[`scripts/checks/15-manifest-sync.sh`](cli/packages/module-check/sh/checks/15-manifest-sync.sh)** compares `plugin.json`
  against the newest **released** changelog heading, skipping `[Unreleased]`. Comparing against
  `[Unreleased]` made the check fail on every run of a repository accumulating changes between releases —
  permanently, for one that is deliberately not cutting versions.

### Added

- **`/vibe-ops:setup <repo | harness>`** — `repo-setup` renamed and given a second mode. `repo` is
  today's behaviour, unchanged. `harness` installs the guide-and-sensor apparatus: the fragment
  directory, the shared composition helper that makes a bare runner invocation stop being a silent trap,
  the manual entrypoint, the optional commit gate, and the artifact path. Two skills whose names differ
  by one word get chosen wrongly about half the time, which is the same argument that collapsed four
  record skills into `/new <type>`. The rename carries its reference updates rather than leaving them as
  follow-up; records under `project/` keep the old name on purpose, because a record should name what it
  was written against.
- **[`references/harness-pair.md`](plugin/references/harness-pair.md)** — the contract for building a guide and
  its guard as one unit. Why the pair (each hides the other's failure written separately), what binds
  three artifacts into one signal, the fixture-it-fails as a condition of installation, the vocabulary
  boundary, the population rules, and where the emitter lives.
- **[`scripts/gate-emit.sh`](cli/packages/module-check/sh/gate-emit.sh)** — a POSIX-sh emitter that travels with the plugin, so
  a fragment composed from here can report in any repository rather than only one that separately
  installed something. Verified byte-identical to the reference implementation it mirrors.
- **`/vibe-ops:new-signal`** — turns one rule into the matched pair, with the fixture proving the guard
  fires. Event skill: one signal per run, no update mode.
- **[`references/exposure-contract.md`](plugin/references/exposure-contract.md)** — what a record may carry into a
  repository that will be cloned on its own and may be made public later. A table of what crosses and what
  does not (another repository's name, a machine path, this repository's security posture, any pointer to a
  private companion), the two rules that make it survivable — write the sentence fresh rather than redacting
  one, and remember a count can identify as surely as a name — and, per artifact, the section that actually
  leaks. `new`, `close` and the plan/task rules point at it; `authoring-style.md` keeps the one-paragraph
  summary and defers. The single riskiest moments are named where they happen: migrating a document written
  somewhere with more context than the destination has, and lifting a line out of a dossier into the issue
  comment that outlives it.
- **[`scripts/checks/52-machine-paths.sh`](cli/packages/module-check/sh/checks/52-machine-paths.sh)** — fails when tracked
  markdown carries a home directory or checkout path. The one leak in the contract above that needs no
  supplied list to detect: the shape is identical on every machine. Unlike the deny-list check it names
  what it found, because the username is already in the tree at that point and hiding it would leave nobody
  able to fix it — and it deliberately passes the elided forms (`/Users/…/`, `/Users/.../`) a document uses
  when it is describing the rule rather than breaking it. Emits a neutral `home-path` artifact via
  `gate-emit.sh` when `GATE_ARTIFACT_DIR` is set; unset, its output is byte-identical to before.
- **`VIBE_OPS_DISABLED_CHECKS`** on `scripts/check-agents-md.sh` — a newline-separated `id:reason` list
  that reports a check as `SKIP [<id>] declared off: <reason>` instead of running it, so a repository with
  real pre-existing debt can adopt the gate today without a red commit blocking every future one. A
  disablement is a ledger entry, never a silent pass: `--self-test` proves it fires `SKIP` naming the
  reason on a fixture that would otherwise fail, and still counts as a composed, run check in the summary
  line. `skills/setup/templates/harness/checks/_run.sh` also gained a third `resolve_runner()` source — a
  sibling `../vibe-ops` checkout, preferred over `${CLAUDE_PLUGIN_ROOT}` and after a repository's own
  snapshot — so a repository living beside this one in the same workspace needs no copy to refresh.
- **[`scripts/checks/27-nudge-behaviour.sh`](cli/packages/module-check/sh/checks/27-nudge-behaviour.sh)** — five assertions
  that run the hook above against fixture repositories: one plan per firing, newest first, nothing
  re-named after being written or after a detour through another repository, and a firing log that is
  actually written. Every one of them fails against the version this release replaces.
- **[`scripts/measure-nudge-noise.sh`](cli/test/measure-nudge-noise.sh)** — the development instrument for
  the one thing a hook cannot observe about itself: what the model did after it fired. Bounded at both
  ends (`--since` / `--until`) so a before-and-after comparison is taken with the same command over the
  same kind of window.
- **[`project/research/research-document-format.md`](project/research/research-document-format.md)** — what
  a research document must carry that a later reader cannot reconstruct. Surveys ICD 203 (separating fact
  from assumption from judgment, and confidence from likelihood), PRISMA-S (a search recorded as run), the
  spike-template convention of answering the question at the top, and the research-repository literature on
  index legibility; audits a corpus of untemplated research against them; and records what was rejected
  with the trigger that would reopen each.
- **Sources credited** in [`ACKNOWLEDGEMENTS.md`](ACKNOWLEDGEMENTS.md) for the above, including the note
  that ICD 203 was read through a secondary explainer because the primary PDF yielded no extractable text.
- **`authoring-agents-md`'s first skill-scoped `hooks:` block, and the CLI it calls**
  ([Plan-009](./project/plans/shipped/009-the-first-skill-scoped-hook-and-the-cli-it-calls.md), verified in a real
  `claude --plugin-dir` session). Once the skill is active, writing an `AGENTS.md` with no sibling
  `CLAUDE.md` creates one automatically; a `CLAUDE.md` that exists but does not link back, or carries
  content beyond its import, produces one advisory line — never a block. RFC-0001's postponed step 4 and
  its "skill-scoped hook" section are both implemented.

  **`paths:` alone does not guarantee the skill is active** — measured in the same session: a matching
  write with the skill not already loaded installed no hook. `vibe-ops agents-md` (a full sweep) remains
  the only unconditional check; this hook is a convenience on top of it, not a replacement for it.

  The hook is the `vibe-ops` command itself — `vibe-ops hook <ops> [--fix <gates>]`
  (`packages/cli/src/hook.ts`), a new `Surface` alongside `"cli"` and `"mcp"` — not a shipped script: it
  reads the `PostToolUse` payload off stdin and answers in the hook's own protocol, so no skill hand-parses
  JSON or hand-rolls the response envelope. `vibe-ops` is now installable as a command
  (`npm link -w @entelekheia/vibe-ops-cli`; recipe in `cli/README.md`), which the plugin and the CLI are
  now co-dependent on — a missing install fails the hook loudly, by design, rather than silently doing
  nothing.

  Getting there needed three things the ops didn't have: **`--file <path>`**, scoping a run to one file
  without requiring it to be tracked; a **selective `--fix`** (`--fix pairing`, or bare for every fixable
  gate), because a caller reacting to one edit must not repair an unrelated gate that merely happens to be
  fixable; and `defineGate`'s `fixable`/`fix()` contract actually exercised — `pairing` now repairs its
  missing-sibling finding and splits its two findings by failure mode rather than by root-versus-nested
  depth (a nested `AGENTS.md` with no sibling now fails, like a root one, instead of warning). A new gate,
  `claude-md-content`, catches a `CLAUDE.md` carrying stray content. The sensor,
  `25-hooks-registration.sh`, now validates a skill's own `hooks:` block shape, not only
  `hooks/hooks.json`; and `70-plugin-root-paths.sh` gained a guard against a path that climbs out of the
  plugin root with `../` — it resolves in this working tree but in no installed plugin — closing ten
  call sites that had quietly depended on it.

### Changed

- **The release policy in [`AGENTS.md`](AGENTS.md) now states the freeze.** No version is being cut; the
  plugin is installed from a directory source and exercised in place, so the tree is the install and the
  "only counts as delivered once a release is cut" rule is suspended rather than quietly ignored. The rule
  itself is kept beside it, because it comes back the moment releasing does. `claude plugin validate
  . --strict` is named as the first-party check `check-agents-md.sh` sits on top of rather than replaces.
- **[Plan-004](project/plans/004-new-research-skill.md) — both Open questions closed.** Research is
  **dated**, not numbered, where it is written and named by topic where it is published, so the skill's
  discovery step looks for neither a prefix nor a next number. And research **has** a lifecycle: write-once
  with the supersession banner as its single legal edit, plus an index status of
  `valid → to-be-checked → expired | superseded by <link>`. The plan's `Design` section now points at the
  research instead of carrying an undesigned note, and its `governance.md` still needs the lifecycle
  written into it — that is Track 3.

## [0.8.0] — 2026-08-04

Designed as one unit in [Plan-007](./project/plans/shipped/007-taxonomy-guards-one-close-and-filing-approved-plans.md),
whose four tracks are the four groups below.

### Removed — BREAKING

- **`/vibe-ops:close-task` and `/vibe-ops:close-plan` no longer exist.** Use
  **`/vibe-ops:close <task|plan> <id>`**. A clean break with no forwarding stubs, the same precedent 0.7.0
  set when four `new-*` commands became one — an alias costs exactly the listing characters the merge
  exists to reclaim.

  The two shared almost their whole spine already: find the record, route what the work taught through the
  promotion test, propagate to living docs, run the demotion check, close the issue. What genuinely
  differs is now branched inline — a task writes back to its source doc and is distilled and deleted via
  `finalize.sh`; a plan writes its retrospective against its own goals and **keeps its file**.
  `finalize.sh` moved to `skills/close/` unchanged and is still task-only, because nothing is deleted when
  a plan closes.

  Two of the swept references were functionally critical rather than cosmetic, and had to move with the
  rename or a guard would have silently stopped firing: `hooks/task-dossier-guard.sh`'s closure-box
  detector, and `finalize.sh`'s own box-ticking `sed`.

  **If you have already scaffolded a repo with an older version**, its `GOVERNANCE.md`, governance rule and
  `plan.md` / `task.md` templates still name the old commands; this release cannot reach those copies.

### Added

- **`hooks/plan-approved-copy.sh`** — a `PostToolUse` hook on `ExitPlanMode` that copies an approved
  plan-mode plan into the right repository's `project/plans/` and tells the model where it landed, instead
  of leaving it under `~/.claude/plans/` until someone remembers to file it. It **copies, never moves and
  never overwrites**: the source is Claude Code's and stays put, and an existing target is left alone.

  It only fires for a plan that looks like a durable design record — an H1 **and** a metadata table with a
  `Status` row — so a throwaway planning turn never lands in `project/plans/`. Which repository is
  resolved from an optional `| Repository | <path> |` row when one is present, and otherwise from the
  tool's own cwd resolved to its git toplevel; from an umbrella workspace root the two differ, which is
  why the row exists. `jq` is required rather than optional here: the plan text is untrusted multi-line
  markdown, and extracting prose of that shape with `sed` is a risk this plugin's other hooks avoid for
  good reason.
- **Five new guards**, taking `check-agents-md.sh` from 10 composed checks to 15 — each closing a gap that
  existed while the validator was green: `15-manifest-sync` (`plugin.json` ↔ `marketplace.json` ↔ the
  `CHANGELOG` heading, on version, description and keywords), `25-hooks-registration` (`hooks.json` ↔
  `hooks/`, both directions, including the literal hook count in its own description),
  `35-dogfooding-drift` (every file this plugin dogfoods still matches its shipped copy, compared
  header-aware because a shipped template must omit the license header a naive byte comparison would trip
  on), `55-references-completeness` (a `references/records/` file exists for each record type the resolver
  knows), and `95-command-references` (every `/vibe-ops:<name>` in the README and `skills/` resolves to a
  real skill, scoped away from `project/**` and the changelog, which are historical by design).
- **`scripts/test-plan-progress-nudge.sh`** (18 assertions) — the gate suite 0.7.0 ran ad hoc and cut as
  debt, now committed, plus the two defects that escaped that ad hoc run: the offset-reset false positive
  on a session's first `Stop`, and the state sweep selecting its own directory.
- **`scripts/test-plan-approved-copy.sh`** (12 assertions) — against the documented `ExitPlanMode` payload
  shape. One residual is stated rather than implied: no CLI automation can deliver a real approval, so
  this ships verified at the script level against the documented contract, not against a live approval.
- **An optional `| Repository | <absolute path> |` row** in both plan templates and in
  `references/records/plan.md`. `plan-mode-context.sh` requests it only when its own resolved git toplevel
  differs from `CLAUDE_PROJECT_DIR` — genuine ambiguity, not every planning turn.
- **`PLAN_ACTIVE` and `LIVING` outputs** from `scripts/resolve-governance.sh`, derived from the target
  repo's own plan template, with an `AUTHORITY` fallback for the status word.

### Changed

- **`hooks/plan-progress-nudge.sh` now reads each repository's own plan vocabulary instead of imposing
  this one's.** It shipped in 0.7.0 hardcoding vibe-ops's status word and living-section names, then
  telling every repo it was installed in to maintain sections that may not exist there — a hook meant to
  prevent drift, creating it. It now degrades in three tiers: enumerate the repo's real section names when
  the template carries both markers; name the template without enumerating when only the start marker is
  there; and **stay completely silent** when the taxonomy cannot be derived. It never invents a section
  name. Detection also tolerates cell spacing and no longer stops at the first matching plan.
- **`hooks/plan-mode-context.sh` no longer claims a plan is saved only if you ask for it.** That sentence
  became false the moment `plan-approved-copy.sh` shipped, and two hooks contradicting each other inside
  one session is worse than either being silent. `/vibe-ops:new plan` keeps its narrower purpose: a plan
  written outside plan mode, or an older file the hook never saw.

### Fixed

- **`plugin.json` and `marketplace.json` had drifted apart** on version, description and keywords, each
  independently. Found by the `manifest-sync` guard written in this release, which is now what keeps them
  together.
- **`check-agents-md.sh --self-test` now exercises every check.** Its broken fixture was extended so all
  five new guards — plus the pre-existing `skill-frontmatter`, which had never been exercised — actually
  fire on it, rather than being composed and silently passing.

## [0.7.0] — 2026-08-03

### Removed — BREAKING

- **`/vibe-ops:new-adr`, `new-rfc`, `new-plan` and `new-task` no longer exist.** Use
  **`/vibe-ops:new <adr|rfc|plan|task> <topic>`**. There are no alias skills, because an alias costs
  exactly the listing characters the change exists to reclaim.

  The four opened with an identical Step 0 in four copies — two discovery loops, a numbering-authority
  cascade, and for `new-task` two more calls about GitHub — costing four to five shell round trips per
  invocation. They also restated their own templates, which are 78–80% guidance comments already.

  The reason for merging rather than deduplicating in place: **the ~8,000-character skill listing is
  shared with every other plugin the user has installed, not this plugin's to spend.** The four cost 1,436
  characters between them; the one that replaced them costs ~380, and this plugin's total dropped from
  3,839 to 2,779.

  What each record type needs beyond the shared scaffold now lives in `references/records/<type>.md`, and
  is delivered inline by the resolver, so only the file matching the argument is ever read.

### Added

- **`scripts/resolve-governance.sh`** — one call returns the artifact directory, the template, the
  numbering authority, how many records exist, the next number, the GitHub facts a task needs, and the
  rules for the type asked for. It anchors on the git toplevel rather than `CLAUDE_PROJECT_DIR`, which in
  a workspace whose project root is an umbrella repository names the wrong repository. Where a repo
  numbers its records some other way, it reports the authority file and declines to invent a number
  rather than confidently answering `001`.
- **A closure guard.** Deleting a task dossier is refused while its `## Closure` box is unchecked, and the
  refusal names `/vibe-ops:close-task`. This reads the marker the task template already shipped; ticking
  it is part of the ceremony, so a closure passes through and only a hand deletion is stopped.
- **`skills/close-task/finalize.sh`** — the ordering-sensitive tail of closure, as one script: collect
  every file referring to the dossiers *before* deleting any of them, tick, commit (that commit is the
  breadcrumb, being the last that still contains the dossier), delete, rewrite each link into plain text
  plus a runnable `git show`, append the breadcrumbs to the source plan, commit, re-run the link check
  **after** the deletion, and post the summary. `--dry-run` prints all of it and touches nothing.
- **A hook on the typed `/vibe-ops:new`**, resolving the repository before the skill starts. It calls the
  same script the skill calls — a second delivery path, never a second implementation.
- **[ADR-0009](project/adr/0009-hooks-as-a-delivery-surface.md)** — hooks admitted as a third delivery
  surface, bounded to what a line and a CI guard cannot do: state read from disk at that instant, or
  context placed at a moment an instruction file cannot reach.
- **A `Stop` hook that notices an `In Progress` plan's living sections were not part of a turn that wrote
  to that plan's own repository**, and hands the observation back to the agent — the four sections are
  meant to be maintained while the work happens, not reconstructed afterward. `scripts/session-touched-repos.sh`
  attributes the turn from the session transcript rather than `git status` in `cwd`, which is wrong in this
  kind of workspace twice over: `cwd` may be an umbrella repository over independent repos, and a dirty
  tree elsewhere may be a sibling agent's in-flight edit, not this session's. Returns
  `additionalContext`, not `decision:block` — the latter arrives at the model framed as a denial, which is
  wrong for an observation the model must be free to correctly decline. See
  [Plan-006](./project/plans/shipped/006-plan-progress-nudge-and-state-cleanup.md).
- **`hooks/session-state-cleanup.sh`**, on `SessionEnd`, plus an opportunistic sweep in the hook above —
  nothing previously deleted the per-session marker `plan-mode-context.sh` writes; 13 stray files had
  already accumulated on the maintainer's machine before this was noticed.

### Fixed

- The plan-mode hook reported the umbrella repository's next plan number when the work was in a nested
  repository. It now calls the resolver instead of carrying its own copy of the discovery loops.
- **The state sweep selected its own state directory.** `CLAUDE_PLUGIN_DATA` is itself named
  `vibe-ops-<marketplace>`, so it matched the sweep's `vibe-ops-*` pattern at depth 0 — `find` includes its
  own starting point. Nothing was lost, because `rm -f` refuses a directory; the guard was "the command we
  happen to use cannot" rather than "we never select it", which would have become data loss the moment
  anyone reached for `-delete`. Now scoped with `-type f`.
- **A resumed session re-attributed its entire history to one turn.** `SessionEnd` deletes the state file
  and a resume keeps the same `session_id`, so the next `Stop` found none and started from offset 0 —
  observed on a 5.5 MB transcript, nudging about a repository last written to hours earlier. The first
  `Stop` of a session now seeds the offset to the transcript's current size and stays silent, which is the
  under-triggering this design already prefers over a false nudge.

  Both were found after installing, by questions rather than by tests: the gate's cheap-exit chain was
  exercised, the *seeding* of that chain never was, because every case started from a state file that
  already existed.

### Changed

- **The README now names what this plugin does: context engineering.** The artifacts it authors —
  `AGENTS.md`, the rules, the skills — are not documentation *about* a project; they are the context an
  agent is handed before it acts, and *when* each one loads is as much of the design as what it says. The
  previous claim ("repositories that start organized") described the scaffolding half only, which is the
  half every other tool also does. Documentation only; no behaviour changed.

## [0.6.0] — 2026-08-01

### Fixed

- **`license-setup` shipped a LICENSE that was not the Apache License.** `templates/LICENSE-apache-2.0`
  was a paraphrase: §1's definitions of *Work*/*Contribution*/*Contributor* reworded, §3's patent
  termination and §4(d)'s `NOTICE` treatment rewritten, §7's disclaimer rewritten, and the close of §4
  replaced by MIT's *"sell copies … subject to the following conditions:"* with no conditions following it.
  Against apache.org's text it was missing 61 lines and carried 56 that do not appear in the license. Every
  repository scaffolded by the skill got that file, and so did this one. **A repo whose LICENSE is not
  Apache-2.0 is not licensed as it declares** — replacing an existing corrupted `LICENSE` is a maintainer
  decision this change does not make for you; `get-license.sh verify LICENSE --id Apache-2.0` finds them.

### Changed

- **License text is now fetched and checksum-verified, never authored.** The bundled template is gone.
  `skills/license-setup/get-license.sh` serves a pristine copy when it matches its pinned sha256 and falls
  back to `curl` from the canonical URL when it does not — verified either way, writing nothing on
  mismatch. The only edit ever made to the fetched file is the year and holder, and only where the license
  leaves blanks for them. See [ADR-0008](project/adr/0008-license-text-is-fetched-and-verified.md).
- **`license-setup` is no longer Apache-only.** Fifteen licenses ship pinned in
  `skills/license-setup/licenses/SOURCES.tsv` — Apache-2.0, MIT, BSD-3-Clause, BSD-2-Clause, ISC, 0BSD,
  Unlicense, MPL-2.0, GPL-3.0-only, GPL-2.0-only, LGPL-3.0-only, AGPL-3.0-only, CC-BY-4.0, CC-BY-SA-4.0,
  CC0-1.0 — each verified against upstream, and `get-license.sh pin <SPDX-ID>` adds any other. Step 1 now
  says what the choice implies: the license-rules templates and header stamping are written for a
  permissive *code* license, and a CC license does not belong on source.

### Added

- **A check at both ends, because nobody re-reads a LICENSE.** `get-license.sh verify <file>` compares a
  repo's `LICENSE` against the pinned digest of the license's canonical text — copyright holder and
  rewrapping ignored, every operative word required — and with no `--id` it identifies which pinned
  license a file actually is. Step 2b of the skill installs the same assertion permanently in the target
  repo (`templates/verify-license-text.sh` + `templates/license-text-ci.yml`, offline, no dependencies),
  and `scripts/checks/90-license-texts.sh` enforces it here: every shipped text against its pin, plus this
  plugin's own `LICENSE`.

## [0.5.2] — 2026-07-31

### Fixed

- **`templates/plan.md` and `templates/task.md` now end with an explicit, unchecked closing item**,
  instead of ending on a content section — so the last thing an author or agent does is no longer marking
  the final item done, which read as finished even though `/close-plan`/`/close-task` had not run.
  `plan.md`'s `Progress` checklist gains a final `Run /vibe-ops:close-plan` item. `task.md`'s `Closure`
  section already named `/close-task`, but only inside a guidance comment — the same kind every other
  comment in the template is, and those are deleted before a real dossier is committed, so the instruction
  never survived to reach one. It's now a real checklist line that survives that cleanup.
  ([#13](https://github.com/entelekheia-ai/vibe-ops/issues/13))
- **`license-setup` no longer writes repo-scoped git config on the user's behalf.** Step 5 used to run
  `git config core.hooksPath .githooks` and add an npm `prepare` script; in an npm-workspaces monorepo this
  silently repointed hooks for the entire repository from whichever package happened to run `npm install`,
  at a path that resolves from the worktree root regardless of which package wrote it — in `dot-agent-spec`
  the tracked `apps/dot-agent-cli/.githooks/pre-commit` was never invoked once because of it. `script` now
  writes the hook at the repo root and prints the one-line opt-in instead of running it; `ci` no longer
  wires a hook at all and is the new default whenever `.github/workflows/` exists. See
  [ADR-0007](project/adr/0007-license-enforcement-writes-no-git-config.md).
  ([#12](https://github.com/entelekheia-ai/vibe-ops/issues/12))
- **`templates/ensure-license-headers.sh` can now exclude paths.** It had no exclusion concept at all, so
  running it stamped the repo owner's SPDX header onto vendored third-party code and generator output
  (`pkg/` from wasm-bindgen, `bindings/` from ts-rs) — a licensing error, and in the generator case an
  infinite ping-pong between the next generate and the next commit. Step 1 now surveys for these paths and
  Step 5 renders them into a `is_excluded()` gate shared by both `--check` mode and the injection path, so
  the checker and the fixer can no longer disagree. Exercised by the new `scripts/test-license-headers.sh`,
  the first time this shipped script has ever actually been run in CI.
  ([#12](https://github.com/entelekheia-ai/vibe-ops/issues/12))

## [0.5.1] — 2026-07-30

### Fixed

- **The `memory-slugs` check no longer reports `[[…]]` written inside code.** A TOML array-of-tables in a
  fenced block — `[[language]]` in a Helix config snippet — was reported as a personal-memory pointer, so
  any repository documenting an editor config carried a red line it could not clear without mangling its
  own docs. Inline code spans are stripped too, which also stops the rule that *documents* the
  prohibition from being reported as violating itself. The self-test now asserts exactly one hit against
  a fixture carrying both decoys beside a real slug. ([#6](https://github.com/entelekheia-ai/vibe-ops/issues/6))
- **The `links` check no longer breaks on filenames containing spaces.** It iterated with command
  substitution, which word-splits: `agent - adapter generation.md` became three nonexistent paths and
  `awk` failed on each.

### Changed

- The governance rule and its shipped template now state **what scope artifact numbering is monotonic
  in** — per repository, not across a workspace. Two repos both holding an `ADR-0001` is normal; skipping
  a number to avoid the appearance of a collision leaves a permanent gap explained by nothing.

## [0.5.0] — 2026-07-30

### Changed

- **Every skill is now model-invocable.** `disable-model-invocation: true` was removed from the seven
  skills that carried it (`authoring-agents-md`, `authoring-readme`, `license-setup`, `new-adr`,
  `new-plan`, `new-rfc`, `new-task`). The flag hid them from the model entirely, so asking for the job in
  plain language — "write an ADR for this" — did nothing unless the `/command` was typed. All ten skills
  confirm before any irreversible step.
- **README rewritten** as presentation: a claim, verifiable badges, a navigation row, a screenshot of the
  command surface, and the directory tree `repo-setup` actually produces. The repository-layout table is
  gone; `AGENTS.md` is the only place it lives.
- `authoring-readme` gained a step that gathers what a repository cannot supply — the canonical claim
  (from the project's site, if it has one), the proof artefact, and which badges are true — plus a rule
  choosing the proof by the project's output medium, and a brief to issue before requesting a screenshot.
- `authoring-agents-md` no longer asks for one `Layout` row per folder. A row must now say what a
  directory listing does not; a multi-project workspace is the stated exception.

## [0.4.0] — 2026-07-30

### Changed

- **`/vibe-ops:scaffold-new-repo` is now `/vibe-ops:repo-setup`.** ⚠️ **Breaking** — the old invocation no
  longer works and there is **no deprecated alias**. Update any note, script or documentation that uses it.
  The skill is run on repositories that already exist at least as often as on new ones, and the old name
  promised creation; a `description` cannot outvote a name, because the name is what the user types and
  what the agent pattern-matches against. Recorded in
  [ADR-0001](project/adr/0001-skill-taxonomy-target-state-vs-event.md).
- `repo-setup` now surveys an existing repository before writing and applies an explicit verb per gap
  (`create` / `adopt` / `migrate` / `leave`), so a convention a repo settled on deliberately is no longer
  flattened.
- `authoring-agents-md` applies a content filter (only what an agent cannot discover on its own), a
  150-line budget that prefers relocating content over compressing it, guidance on pointing at a derived
  index instead of restating structure, and checks for nested files that never load.
- The `.agents/`↔`.claude/` bridge had been written out in three places, and only the newest copy carried
  the **Windows symlink fallback** — the other two would have sent a Windows user into a silent failure.
  It now has one home, and every skill that builds the bridge states the fallback.
- Two skills described the private context that produced them rather than the problem they solve; both
  rewritten.

### Added

- **`references/`** — shared policy the skills point at instead of restating: the convergence policy, the
  knowledge lifecycle, instruction surfaces, and authoring style. A rule that governs more than one skill
  now has exactly one copy.
- **Every skill declares its kind** — *target-state* (convergent and idempotent, so create and reconcile
  are one job) or *event* (append-only, no update mode).
- **`audit` mode** — `/vibe-ops:repo-setup audit` reports the gap between a repository and the baseline,
  with the verb it would apply to each gap, and writes nothing.
- **The plan artifact** — a `plan.md` template, a `project/plans/` directory in the scaffold, and four
  living sections (`Progress`, `Surprises & Discoveries`, `Decision Log`, `Outcomes & Retrospective`)
  maintained while the work happens rather than written at the end.
- **Frontmatter pass over every skill.** `effort` is now set per skill by what the work actually is —
  `high` for the two closures and for `authoring-agents-md`, whose whole job is deciding what earns a line;
  `low` for template scaffolding; `inherit` where a skill spans both, notably `new-plan` and `new-rfc`,
  which were `low` and should not have been because migrating a document is content restructuring. **The
  closures are now model-invocable**: their failure mode is being forgotten, which is what auto-invocation
  fixes, and `close-task` gained an explicit confirmation before its one irreversible step. `model:` is set
  nowhere, deliberately — it would override the user's own session choice.
- **`/vibe-ops:close-plan`** — a plan had no closure of its own, so one that never spawned a task dossier
  could ship, close its issue, and route nothing it learned. It writes the retrospective against the plan's
  original goals, routes every `Surprises & Discoveries` entry, runs the demotion check, closes the
  tracking issue, and **keeps the file** — the opposite of `close-task`, where the dossier is deleted.
  Every artifact now has a closure that performs the routing.
- **Closing a task routes what the work taught.** `close-task` gained a step that takes every
  `Surprises & Discoveries` entry through the promotion test — recurrence, discoverability, whether a guard
  already covers it, and where it lands — plus the demotion check that deletes an instruction line a new
  guard has made redundant. A learning is no longer deleted along with the dossier.
- **The validator is a capability, not a file this repository owns.** `scripts/check-agents-md.sh` checks
  the repository you point it at — the line budget, every relative link resolving inside the repo, `.claude/`
  holding real symlinks (including the case where git checked one out as text), every rule declaring a
  `description`, and no personal-memory link. It runs **from the plugin** and writes nothing into the
  target, so there is no per-repo copy to keep current: a copy would freeze at the version of the day it
  was taken, and the one real bug found so far would still be live in every repository holding one.
  - **Every skill that changes an instruction surface now runs it** — `authoring-agents-md` (in the survey,
    so findings reach the `audit` report, and again after writing), `repo-setup` (survey, and after
    staging), `close-task` (after propagating, where a moved doc breaks a link invisibly in a diff). The
    four event skills do not: they write into `project/` and touch no instruction surface.
  - **The `authoring-agents-md` checklist gave up the four items the script now enforces.** Two deleted
    outright, two narrowed to the half no script can see. A checklist item that restates a guard is the
    thing [ADR-0004](project/adr/0004-budgeted-artifacts-and-guards.md) exists to delete.
  - **One versioned fragment per check** under `scripts/checks/`. Composition selects and orders them and
    never authors one; `--list` prints what a run assembled and from where, which is the audit trail
    instead of a manifest that would drift from the directory it describes.
  - **The private-name deny-list is composed at runtime** into a temporary directory and deleted when the
    run ends, from `PRIVATE_NAME_LIST` or `PRIVATE_NAMES` — never from a file inside any repository.
    Composition expands *spellings*, not membership: a name supplied hyphenated is also searched for
    spaced, underscored and squashed. A hit reports where the entry came from and never what it said.
  - **`--self-test`** builds a deliberately broken repository and asserts every check fires on it, that
    nothing was written into it, and that no temporary directory survives — after a normal run **and**
    after an interrupted one. CI runs it before the real check, so a check that has quietly stopped
    detecting anything fails loudly instead of reporting a clean tree.
  - **`repo-setup` offers a CI copy**, once, saying in the question that the copy is a snapshot which will
    not receive later fixes. Declining writes nothing.
  - **Every `${CLAUDE_PLUGIN_ROOT}` path a skill names is checked to exist.** Those paths live inside
    fenced commands, where the link check cannot see them — so the files a skill tells an agent to copy or
    execute were the ones nothing verified.
- **Three more decision records** — a size budget on generated artifacts with guards replacing prose
  ([ADR-0004](project/adr/0004-budgeted-artifacts-and-guards.md)); derived knowledge consumed through a
  detected capability rather than a named product
  ([ADR-0005](project/adr/0005-derived-knowledge-via-detected-capability.md)); and the task model of a
  GitHub issue plus an ephemeral dossier
  ([ADR-0006](project/adr/0006-task-as-issue-plus-ephemeral-dossier.md)).
- **This repository's own governance** — `AGENTS.md`, `GOVERNANCE.md`, `ACKNOWLEDGEMENTS.md`, `project/`
  with six ADRs and two research notes, and the `.agents/`↔`.claude/` bridge. The plugin now follows what
  it prescribes.
- This changelog.

### Fixed

- **Every template this plugin ships carried the plugin author's copyright into your repository.** ⚠️ The
  four `project/templates/*.md` had it in a header block, and `license-setup` copied an `LICENSE`
  appendix naming him as the copyright owner — in the one file where attribution is the point. The header
  blocks are gone; the `LICENSE` appendix now attributes collectively to *"The `<project>` Authors"*, the
  same model `NOTICE`/`AUTHORS` already used, with `{{YEAR}}` and `{{PROJECT_NAME}}` substituted at write
  time. A `template-attribution` check fails on any literal copyright year under `skills/*/templates/`,
  so it cannot return. **If you scaffolded a repository with an earlier version, check its `LICENSE`.**
- **The governance model described four artifact types while five creation skills existed.** The plan is
  now in `GOVERNANCE.md` and in the `project/**` rule, with its own lifecycle — permanent, never deleted,
  four living sections.
- **`project/log/` had one documented reason to exist and needed two.** It is the narrative an ADR is too
  terse to carry *and* the rich context of one unit of work, decision or not — otherwise a real learning
  that is too local to promote has nowhere to go.
- **Only tasks had a stated issue↔file split.** Both governance documents now say what the issue owns and
  what the file owns for each artifact that can pair with one, including the part that does not carry over
  from tasks: a plan's issue closes, and the plan file does not.

## [0.3.0] — 2026-07-27

### Added

- `new-plan` skill.

### Changed

- Everything written into a target repository is in English, regardless of the conversation's language.
- README pass.

## [0.2.0] — 2026-07-27

### Added

- `close-task` — closing a task writes back to the document that started the work instead of deleting the
  dossier.
- `license-setup` — one shared license convention instead of one hand-rolled per repository.

### Changed

- Governance documentation collapsed from a file per folder into a single path-scoped rule.

## [0.1.0] — 2026-07-26

First release — a Claude Code plugin for born-organized repositories.
