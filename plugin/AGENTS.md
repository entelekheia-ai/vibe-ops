# AGENTS.md — plugin/

The Claude Code plugin: skills that scaffold born-organized repos and author their governance docs.
**No build** — this directory *is* the distributable, and `.claude-plugin/plugin.json` is its manifest.

The repository-wide map is [`../AGENTS.md`](../AGENTS.md); the deterministic half lives in
[`../cli/`](../cli/AGENTS.md) and is not shipped from here.

## Layout

| Path | What is not obvious about it |
|---|---|
| [`skills/<name>/SKILL.md`](skills/) | **The product** — what Claude Code loads (`plugin.json`'s `"skills"` points here). A `templates/` folder beside a SKILL.md holds files that skill copies at runtime; it is never inlined into the SKILL.md. A skill ships no tooling of its own since Plan-040: `license-setup` names `vibe-ops license get|verify|list` and a package root, and the licence texts with their pins live in `@entelekheia/governance-license` — still the only sanctioned way a LICENSE is produced ([ADR-0008](../project/adr/0008-license-text-is-fetched-and-verified.md)). |
| [`agents/<name>.md`](agents/) | Subagents the skills dispatch to. **Auto-discovered — no manifest entry**, and that is the tested shape: with no `agents` key in `plugin.json`, `--plugin-dir` lists the file as `vibe-ops:governance-auditor` (measured 2026-08-13); the manifest's `agents` field takes an *array of file paths*, not a directory, so declaring it would trade auto-discovery for one entry per agent. Two today, both read-only for the same reason — [`governance-auditor`](agents/governance-auditor.md), which every target-state skill delegates its survey to (`vibe-ops records norm --type base --facet policy --name convergence --print`), and [`migration-rehearser`](agents/migration-rehearser.md), which walks a migration note against the artifact it handles worst: neither holds a writing tool, so "writes nothing" is enforced rather than promised. The third, `scaffolder`, retired with Plan-040 Track 6: it existed because copy-and-substitute had no deterministic surface, and `vibe-ops setup scaffold` is that surface. [ADR-0013](../project/adr/0013-the-model-a-shipped-plugin-may-pin.md) stays as the policy under which a plugin may pin a model, with no instance. Which fields are set and which are deliberately refused — `skills` preloads rather than restricts, `maxTurns` on a surveyor truncates into a plausible answer, `isolation: worktree` would survey the committed tree instead of yours — is [Plan-024](../project/plans/shipped/024-the-work-a-skill-declares-and-the-caller-cannot-afford.md)'s Decision Log. |
| *(the norm's data)* | **Gone from this tree since Plan-033** — templates, authoring rules, migration notes and each type's `type.json` live in that artifact's own governance package (`cli/packages/governance-<t>/`), activated through `vibeops.config` and read through the CLI (`vibe-ops records norm`). This plugin keeps only the knowledge of driving the CLI; an artifact's `vibe-ops-template: <type>@<version>` stamp still travels in the artifact itself, so migration stays per artifact. |
| [`hooks/`](hooks/) | The only always-on surface — auto-discovered from `hooks.json`, no manifest entry. A hook fires in **every** repository where the plugin is installed, so each carries its own cheap exit as its first act. **All nine registrations name `vibe-ops` and this directory ships no script** ([`docs/reference/hook-surfaces.md`](../docs/reference/hook-surfaces.md) is the catalogue; [`docs/how-to/write-a-hook.md`](../docs/how-to/write-a-hook.md) is the recipe). A surface's decision logic belongs to the package it is about — the plan-progress nudge's is in `governance-plan` — while the transcript, the state directory and the JSON envelope stay in the CLI wrapper. Why this surface exists: [`positioned-context-and-hooks.md`](../project/research/positioned-context-and-hooks.md). |

## Skills

| Skill | Does |
|---|---|
| [`setup`](skills/setup/SKILL.md) | Two modes. `repo` brings a repo to the baseline — package/build, `project/`, docs, the rules bridge, `AGENTS.md` — orchestrating the skills below. `harness` installs the guide/sensor apparatus: fragment directory, runner wiring, the commit gate, the artifact path. **`harness audit` is the assessment**, and it lives here rather than in a skill of its own because auditing a harness and installing one are the same knowledge asked twice; it measures with `vibe-ops harness resolve|shape|catalog|audit` and judges with `vibe-ops harness policy --name model --print`. |
| [`authoring-agents-md`](skills/authoring-agents-md/SKILL.md) | Writes or refreshes an `AGENTS.md` (+ its `CLAUDE.md`). Path-scoped, so it also arrives on a one-line edit. |
| [`authoring-readme`](skills/authoring-readme/SKILL.md) | Writes or cleans up a README as presentation and usage, not process history. Path-scoped. |
| [`license-setup`](skills/license-setup/SKILL.md) | `LICENSE`, `NOTICE`/`AUTHORS` for a fork, and optional header enforcement. |
| [`new`](skills/new/SKILL.md) | Creates one governance record — the four numbered kinds, and since Plan-029 any type the repository declares or an installed package ships — using the *target repo's* own template and numbering. The body holds only what all four share; what diverges lives in each type's own governance package (`authoring.md`), delivered by `vibe-ops records norm --facet authoring`, so only the matching one is ever read. |
| [`close-task`](skills/close-task/SKILL.md) | Closes a dossier: write back, route what it taught, then distil into the issue and delete, leaving a `git show` breadcrumb. `vibe-ops task close` does the ordering-sensitive tail. |
| [`close-plan`](skills/close-plan/SKILL.md) | Closes a plan: retrospective against its own goals, demotion check, issue closed, then `vibe-ops plan close` sets the terminal status and moves the file into `shipped/`. **Never deleted.** Installs `hook plan-status` while it runs. |
| [`new-log`](skills/new-log/SKILL.md) | Writes one `project/log/` entry: a trap, addressed by the path where it recurs. Separate from `/new` because a log is **not numbered** and so never touches the resolver, and path-scoped because its normal caller is `close`, not a person. |
| [`migrate`](skills/migrate/SKILL.md) | Brings artifacts up to the current template, reading the version stamp. Per-jump detail lives in each type's governance package (`migrations/`, via `vibe-ops records norm --facet migrations`), never in the SKILL body; a jump with no note stops the run instead of being invented. |
| [`new-migration`](skills/new-migration/SKILL.md) | The other half of `migrate`: moves a template's version and writes its note, as one act. Path-scoped to the governance packages' `templates/*.md`, so it loads when the debt is created. |

## How this works — not obvious from the code

The three "don't do this or it breaks" invariants are in
[`../.agents/rules/repo-guardrails.md`](../.agents/rules/repo-guardrails.md), which loads on its own.

- **Adding a skill = adding a folder.** `plugin.json` points at the directory, no per-skill manifest
  entry; the only other place to update is the skill table above.
- **The plugin ships its own MCP server**, declared as `mcpServers` in `plugin.json` and started as
  `vibe-ops mcp` — resolved from `PATH`, because `cli/` is not inside an install (`source: "./plugin"`).
  So installing the plugin is what puts the `plan`/`task`/`log`/`check` tools in a session, and the
  co-dependency the hooks already create is the same one: no `vibe-ops` on `PATH`, no tools. A machine
  that also registers the server in a project `.mcp.json` gets **both**, under different tool prefixes —
  which is why no skill here hardcodes a prefix.
- **Skills delegate instead of duplicating** — `setup repo` orchestrates `license-setup` →
  `authoring-agents-md` → `authoring-readme` by name. A rule governing more than one skill lives in the
  package whose policy it is and is read through the CLI (`vibe-ops records norm --facet policy`), never
  copied into a `SKILL.md`.
- **Every skill declares its kind** — target-state (convergent, idempotent, has an `audit` mode) or
  event (append-only, no update mode). Read it with `vibe-ops records norm --type base --facet policy --name convergence --print`.
- **Everything written into a target repo is in English**, whatever language the conversation is in.
  That is a product guarantee, stated in the README.
- **A hook is not a cheaper way to write a line.** It earns its place only by delivering something a
  line cannot: state read from disk at that instant, or context placed where an instruction file cannot
  reach. `claude --plugin-dir <this tree>` is the intended test loop; **it did not deliver a `Stop` hook
  in a headless `-p` run** (measured 2026-08-06, claude-code@2.1.221 — nothing reached the transcript),
  and each `-p` invocation ends its session, so `SessionEnd` clears per-session state and every resumed
  turn arrives as a *first* event. Exercise session-scoped behaviour in a real session, or against
  fixtures — [`nudge-behaviour.test.ts`](../cli/packages/harness/test/nudge-behaviour.test.ts) is
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
- **`claude plugin validate . --strict` is the first-party check**, and it **ignores unknown frontmatter
  keys entirely** — measured 2026-08-13 against a control key, and it passed a plugin agent whose
  `description` carried an unquoted `": "`, which drops every field at load. So it passing is not evidence
  that a field is honoured, spelled correctly, or read at all. `vibe-ops check` and the `agents-md` ops
  are this repo's layer on top, never a replacement.

### SKILL.md frontmatter

- **Fields Claude Code honors:** `name`, `description`, `model`, `effort`, `allowed-tools`,
  `disallowed-tools`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `shell`,
  `when_to_use`, `paths`, `hooks`. `model` and `effort` are **per skill**.
- **`hooks:` scopes to the skill's own lifecycle** — installed only while the skill is active, gone when
  it finishes. Combined with `paths:`, the chain costs nothing standing: `paths:` makes the skill
  *eligible* to load on a matching edit — **it does not guarantee the load fires**, measured 2026-08-10:
  a `Write` to a matching file with the skill not already active installed no hook, and only did once the
  skill had been explicitly invoked first (Plan-009, Decision Log). Once it does load, the skill installs
  the hook, the hook acts, both leave together. `authoring-agents-md` is the first user —
  its `hooks:` block names `vibe-ops` (the CLI, on PATH) directly as the command, not a shipped script:
  the CLI's `hook` surface reads the `PostToolUse` payload itself and answers in the hook's protocol, so
  no skill needs to hand-parse JSON or hand-roll the response envelope. **This makes the plugin and the
  CLI co-dependent** — a machine without `vibe-ops` on PATH gets a loud hook failure, not a silent no-op,
  by design (`cli/README.md` has the install recipe: `npm link -w @entelekheia/vibe-ops-cli`). Sensor:
  [`25-hooks-registration.sh`](../cli/packages/module-check/sh/unported/checks/25-hooks-registration.sh) validates
  every skill's `hooks:` block shape, not only `hooks/hooks.json`. See
  [RFC-0001](../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md#specification) and
  [Plan-009](../project/plans/shipped/009-the-first-skill-scoped-hook-and-the-cli-it-calls.md).
- **`paths:` is how a target-state skill *can* reach an edit it was not invoked for — not a guarantee
  that it will**, per the measurement above. A skill carrying one **MUST** say near its top how to scale
  down to a single edit, or it teaches people to ignore it.
- **No skill sets `disable-model-invocation`.** The flag removes a skill from the model's listing —
  zero context cost, and in exchange it can only fire from a typed `/command`, including when the user
  asks for exactly that job in plain language. That failure is silent and looks like the skill not
  working. **A model-invocable skill must confirm before any irreversible step**, since the user may not
  have asked for the run.
- **`model:` is pinned downward only, and only behind a verifier** — a cheaper tier is permitted where a
  deterministic check runs immediately after the pinned work and fails loudly, and the verifier is named
  where the pin is declared. Never upward: a pin runs on the installer's session and budget, and they
  sized it when they chose their model. `inherit` everywhere else, which is also the default when the
  field is absent. The reasoning, and the three rejected alternatives, are
  [ADR-0013](../project/adr/0013-the-model-a-shipped-plugin-may-pin.md); this line is the rule, not the
  record. A small model still fabricates sections to fill a template with no source material — which is
  why no *authoring* surface qualifies, exactly what `/new`'s migration mode warns about.
- **Don't use `when_to_use`.** The listing renders it as `description - when_to_use`, making it a second
  home for trigger text. Keep triggers in `description`; one copy.
- **The skill listing is a fraction of the context window, shared with every other installed plugin.**
  `skillListingBudgetFraction` defaults to 1%, 1,536-character cap per skill. That sharing is why four
  record-creating skills became one `/new <type>` (1,436 characters, down to ~380). Measure with
  `claude plugin details vibe-ops@<marketplace>`; hooks cost nothing.

## Keeping this file current

Updating it is **part of any task that changes the plugin's shape**. Triggers: a skill or an agent is
added, renamed or removed; a skill gains or loses a `templates/` folder; a file is added to `references/` or a skill
stops pointing at one; an invariant above stops being true; a manifest field worth knowing about appears.
Adjust the one affected line, keep entries to one line, and point at the source of truth rather than
restating it.
