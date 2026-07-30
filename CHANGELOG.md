# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **No version has been tagged or released yet.** The entries below `[Unreleased]` record the versions the
> manifest has carried, dated by the commit that set them. They exist in history, not on a release page —
> so the version in `.claude-plugin/plugin.json` moves only when a release is actually cut, not when work
> lands.

## [Unreleased]

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
- **`/vibe-ops:close-plan`** — a plan had no closure of its own, so one that never spawned a task dossier
  could ship, close its issue, and route nothing it learned. It writes the retrospective against the plan's
  original goals, routes every `Surprises & Discoveries` entry, runs the demotion check, closes the
  tracking issue, and **keeps the file** — the opposite of `close-task`, where the dossier is deleted.
  Every artifact now has a closure that performs the routing.
- **Closing a task routes what the work taught.** `close-task` gained a step that takes every
  `Surprises & Discoveries` entry through the promotion test — recurrence, discoverability, whether a guard
  already covers it, and where it lands — plus the demotion check that deletes an instruction line a new
  guard has made redundant. A learning is no longer deleted along with the dossier.
- **`scripts/check-agents-md.sh`** — the maintenance loop stops depending on someone remembering. Checks
  the line budget, that every relative link resolves and none escapes the repository, that `.claude/`
  holds resolving symlinks (including the case where git checked one out as text), and that every rule
  declares a `description`. Runs in CI, and `--self-test` builds a deliberately broken repository to prove
  the checks still fire.
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
