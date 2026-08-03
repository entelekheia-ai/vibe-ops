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
  [Plan-006](project/plans/006-plan-progress-nudge-and-state-cleanup.md).
- **`hooks/session-state-cleanup.sh`**, on `SessionEnd`, plus an opportunistic sweep in the hook above —
  nothing previously deleted the per-session marker `plan-mode-context.sh` writes; 13 stray files had
  already accumulated on the maintainer's machine before this was noticed.

### Fixed

- The plan-mode hook reported the umbrella repository's next plan number when the work was in a nested
  repository. It now calls the resolver instead of carrying its own copy of the discovery loops.

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
