---
description: Hard invariants of the vibe-ops plugin repo — what breaks if you move the skills folder, inline a template, or add a dot to a template filename.
trigger: always_on
---

## Repo guardrails

Three things in this repo are cheap to state and expensive to rediscover, because each one looks like
tidying up and is actually a breakage.

- **Never move, merge, or rename `skills/` at the repo root.** It is the plugin's *product* — Claude Code
  loads it via `"skills": "./skills/"` in `.claude-plugin/plugin.json`. Agent config for working *on this
  repo* is a different thing and lives in `.agents/skills/`. A pass that "standardizes the layout" must
  leave the split alone; converging the two uninstalls the plugin's contents.

- **Never inline a template's content into a `SKILL.md`.** Templates live beside their skill in
  `skills/<skill>/templates/` and are copied at runtime from
  `${CLAUDE_PLUGIN_ROOT}/skills/<skill>/templates/`. A skill must *instruct the agent to copy the file*,
  never reproduce it — the moment there are two copies, the one in the SKILL.md is the one that goes stale
  and gets shipped into someone's repo.

- **Never give a template file its leading dot in this repo.** Files meant to land as `.gitignore`,
  `.editorconfig`, or `.gitkeep` are stored as `gitignore`, `editorconfig`, `gitkeep` and gain the dot at
  copy time. A literal `.gitignore` under `templates/` is applied by git to *this* repo instead of being
  shipped to the target.
