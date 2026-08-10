# AGENTS.md — plugin/

The Claude Code plugin: skills that scaffold born-organized repos and author their governance docs.
**No build** — this directory *is* the distributable, and `.claude-plugin/plugin.json` is its manifest.

The repository-wide map is [`../AGENTS.md`](../AGENTS.md); the deterministic half lives in
[`../cli/`](../cli/AGENTS.md) and is not shipped from here.

## Layout

| Path | What is not obvious about it |
|---|---|
| [`skills/<name>/SKILL.md`](skills/) | **The product** — what Claude Code loads (`plugin.json`'s `"skills"` points here). A `templates/` folder beside a SKILL.md holds files that skill copies at runtime; it is never inlined into the SKILL.md. A skill may also ship tooling it *runs* rather than copies — `license-setup/get-license.sh` + its pinned `licenses/`, the only sanctioned way a LICENSE is produced ([ADR-0008](../project/adr/0008-license-text-is-fetched-and-verified.md)). |
| [`templates/`](templates/) | The versioned governance templates `/new` and `/migrate` read. Each carries a `vibe-ops-template <type>@<version>` stamp above the H1 that survives the instruction block being deleted, so migration is **per artifact, not per plugin**. |
| [`hooks/`](hooks/) | The only always-on surface — auto-discovered from `hooks.json`, no manifest entry. A hook fires in **every** repository where the plugin is installed, so each carries its own cheap exit as its first act. Why this surface exists: [`positioned-context-and-hooks.md`](../project/research/positioned-context-and-hooks.md). |
| [`references/`](references/) | Shared policy the skills point at instead of restating — the single copy of any rule governing more than one skill. |
| [`scripts/`](scripts/) | **Runtime**, shipped and run inside a target repo. `resolve-governance.sh` is what `/new` calls instead of rediscovering the repo; `session-touched-repos.sh` is what the `Stop` hook calls to attribute a turn's writes to a repository from the session transcript, never from `cwd`. |

## Skills

| Skill | Does |
|---|---|
| [`setup`](skills/setup/SKILL.md) | Two modes. `repo` brings a repo to the baseline — package/build, `project/`, docs, the rules bridge, `AGENTS.md` — orchestrating the skills below. `harness` installs the guide/sensor apparatus: fragment directory, runner wiring, the commit gate, the artifact path. |
| [`authoring-agents-md`](skills/authoring-agents-md/SKILL.md) | Writes or refreshes an `AGENTS.md` (+ its `CLAUDE.md`). Path-scoped, so it also arrives on a one-line edit. |
| [`authoring-readme`](skills/authoring-readme/SKILL.md) | Writes or cleans up a README as presentation and usage, not process history. Path-scoped. |
| [`license-setup`](skills/license-setup/SKILL.md) | `LICENSE`, `NOTICE`/`AUTHORS` for a fork, and optional header enforcement. |
| [`new`](skills/new/SKILL.md) | Creates one governance record of any of the four kinds, using the *target repo's* own template and numbering. The body holds only what all four share; what diverges lives in [`references/records/<type>.md`](references/records/) and is delivered by the resolver, so only the matching one is ever read. |
| [`close`](skills/close/SKILL.md) | Closes the loop for a task or a plan. A task dossier is distilled and deleted; a plan's file **is not deleted** — retrospective, demotion check, issue closed, file kept. |
| [`migrate`](skills/migrate/SKILL.md) | Brings artifacts up to the current template, reading the version stamp. Per-jump detail lives in [`migrations/`](skills/migrate/migrations/), never in the SKILL body; a jump with no note stops the run instead of being invented. |
| [`new-migration`](skills/new-migration/SKILL.md) | The other half of `migrate`: moves a template's version and writes its note, as one act. Path-scoped to `templates/*.md`, so it loads when the debt is created. |

## How this works — not obvious from the code

The three "don't do this or it breaks" invariants are in
[`../.agents/rules/repo-guardrails.md`](../.agents/rules/repo-guardrails.md), which loads on its own.

- **Adding a skill = adding a folder.** `plugin.json` points at the directory, no per-skill manifest
  entry; the only other place to update is the skill table above.
- **Skills delegate instead of duplicating** — `setup repo` orchestrates `license-setup` →
  `authoring-agents-md` → `authoring-readme` by name. A rule governing more than one skill lives in
  [`references/`](references/README.md) and is *pointed at*, never copied into a `SKILL.md`.
- **Every skill declares its kind** — target-state (convergent, idempotent, has an `audit` mode) or
  event (append-only, no update mode). See [`references/convergence-policy.md`](references/convergence-policy.md).
- **Everything written into a target repo is in English**, whatever language the conversation is in.
  That is a product guarantee, stated in the README.
- **A hook is not a cheaper way to write a line.** It earns its place only by delivering something a
  line cannot: state read from disk at that instant, or context placed where an instruction file cannot
  reach. `claude --plugin-dir <this tree>` is the intended test loop; **it did not deliver a `Stop` hook
  in a headless `-p` run** (measured 2026-08-06, claude-code@2.1.221 — nothing reached the transcript),
  and each `-p` invocation ends its session, so `SessionEnd` clears per-session state and every resumed
  turn arrives as a *first* event. Exercise session-scoped behaviour in a real session, or against
  fixtures — [`27-nudge-behaviour.sh`](../cli/packages/module-check/sh/checks/27-nudge-behaviour.sh) is
  the pattern.

### Releasing, and why the install goes stale

- **No release is being cut, and that is policy, not a backlog.** The version stays at the `plugin.json`
  value; work accumulates under `[Unreleased]` and reaches no marketplace. **Do not bump `plugin.json`
  or `marketplace.json`.** The freeze ends when the maintainer decides what shape this is derived into.
- **A directory-source marketplace does NOT mean the tree is the install.** That sentence used to be
  here and was false; it cost ten commits of silent divergence before anyone noticed a renamed skill
  still answering to its old name. Two fields have confusingly similar names and only the second decides
  what loads:

  | File | Field | Points at |
  |---|---|---|
  | `~/.claude/plugins/known_marketplaces.json` | `installLocation` | this tree — the **marketplace's** |
  | `~/.claude/plugins/installed_plugins.json` | `installPath` | `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` — the **plugin's**, where skills actually load from |

  Even from a `source: directory` marketplace, installing **copies** the tree into that versioned cache
  and records the `gitCommitSha`. `${CLAUDE_PLUGIN_ROOT}` resolves there, never here.
- **So under the freeze the install never refreshes itself.** The cache path is keyed by version and the
  version is pinned, so the copy made on install day runs forever. Measured 2026-08-07: the install sat
  ten commits behind, still offering `/vibe-ops:repo-setup` after the rename. **`claude plugin uninstall`
  + `install` re-copies at the same version** — verified byte-identical to the tree. Do it after any
  change you intend to *use*, or check `gitCommitSha` against `git rev-parse HEAD` when a skill behaves
  like an older version of itself. `claude --plugin-dir` bypasses the cache and is the better loop.
- **When releasing resumes, the version does this by itself.** A moved version means a new cache path
  and a fresh copy. The lasting half: a feature whose invocation path is a **new file** is unreachable
  in every install until the version moves. That the path exists here is checked by `plugin-root-paths`;
  that it existed at the last release is the part you have to think about.
- **`claude plugin validate . --strict` is the first-party check** and the only one reading the manifest
  and frontmatter schemas. `vibe-ops check` is this repo's layer on top, never a replacement.

### SKILL.md frontmatter

- **Fields Claude Code honors:** `name`, `description`, `model`, `effort`, `allowed-tools`,
  `disallowed-tools`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `shell`,
  `when_to_use`, `paths`. `model` and `effort` are **per skill**.
- **`paths:` is how a target-state skill reaches an edit it was not invoked for.** A skill carrying one
  **MUST** say near its top how to scale down to a single edit, or it teaches people to ignore it.
- **No skill sets `disable-model-invocation`.** The flag removes a skill from the model's listing —
  zero context cost, and in exchange it can only fire from a typed `/command`, including when the user
  asks for exactly that job in plain language. That failure is silent and looks like the skill not
  working. **A model-invocable skill must confirm before any irreversible step**, since the user may not
  have asked for the run.
- **Never set `model:`** — it silently overrides the user's session choice. A small model fabricates
  sections to fill a template with no source material, exactly what `/new`'s migration mode warns about.
- **Don't use `when_to_use`.** The listing renders it as `description - when_to_use`, making it a second
  home for trigger text. Keep triggers in `description`; one copy.
- **The skill listing is a fraction of the context window, shared with every other installed plugin.**
  `skillListingBudgetFraction` defaults to 1%, 1,536-character cap per skill. That sharing is why four
  record-creating skills became one `/new <type>` (1,436 characters, down to ~380). Measure with
  `claude plugin details vibe-ops@<marketplace>`; hooks cost nothing.

## Keeping this file current

Updating it is **part of any task that changes the plugin's shape**. Triggers: a skill is added, renamed
or removed; a skill gains or loses a `templates/` folder; a file is added to `references/` or a skill
stops pointing at one; an invariant above stops being true; a manifest field worth knowing about appears.
Adjust the one affected line, keep entries to one line, and point at the source of truth rather than
restating it.
