---
name: authoring-agents-md
description: Create or refresh an AGENTS.md — the agent-facing entry map for a repo or workspace. Covers self-contained scope, map-not-narrative entries, the .agents/ ↔ .claude/ config bridge, and a self-maintenance loop. Use when adding an AGENTS.md to a repo/folder, standardizing its agent config (rules/skills), or reconciling one that has drifted from what's on disk.
---

# Authoring an AGENTS.md

An `AGENTS.md` (paired with `CLAUDE.md` → `@AGENTS.md`) is the **entry map an AI collaborator reads
first**. It steers every later decision, so stale or leaky content here is a primary source of
hallucination and cross-project bleed. This skill is the recipe for writing one that stays useful.

## When to use

- A repo or folder needs an `AGENTS.md` (and a `CLAUDE.md` that just does `@AGENTS.md`).
- Standardizing a repo's agent config (rules / skills) onto the `.agents/` ↔ `.claude/` bridge.
- **Refreshing** an existing `AGENTS.md` that has drifted — folders described that no longer exist, or
  folders on disk that aren't described.

## Core principles

1. **Self-contained to its own scope.** A committed repo's `AGENTS.md` must make sense to someone who
   cloned *just that repo*. No references to a parent workspace, sibling folders, cross-repo dedup
   stories, or personal/machine state — those dangle and leak private layout the moment the repo travels.
   A *workspace-root* `AGENTS.md` may map its child folders; a *sub-repo* one may not reach upward.
2. **A map, not a narrative.** One line per entry. Point at the project's own source-of-truth doc instead
   of duplicating it here — duplicated detail drifts.
3. **Code/docs are the source of truth, not this file.** State where truth lives; when this file and the
   code diverge, the code wins.
4. **No personal-memory leakage.** Never reference a personal-memory slug (`[[…]]`, `feedback_…`,
   `project_…`) or any private state in a committed file. Put the actual fact in the file.

## Recommended sections

Pick what fits the repo; don't pad.

- **What this is** — one short paragraph: what the repo/workspace is, and (if a workspace) that folders
  are independent and must not be treated as one codebase.
- **Layout / active projects** — a table, one line each, each row pointing at that project's own doc.
- **Source of truth** — a table mapping "what" → "where".
- **Out of scope by default** — for a multi-project workspace: which folders to ignore unless named.
- **Agent config layout** — only if the repo carries rules/skills (see the bridge below).
- **Keeping this file current** — the self-maintenance loop (see below). Always include this.

## Agent config layout — the `.agents/` ↔ `.claude/` bridge

Agent configuration has **one canonical home: `.agents/`** (`rules/`, `skills/`, `workflows/`). The
`.claude/` folder holds **thin relative symlinks** back into it, so Claude Code and the Antigravity/gemini
side read the *same* file — no second copy to drift.

| Kind | Canonical file | Claude adapter (symlink) |
|---|---|---|
| **Rule** (always-on fact/guardrail) | `.agents/rules/<name>.md` — give it a `description:`; **no** `paths:` = always-on, or `paths: ["glob"]` to scope | `.claude/rules/<name>.md` → `../../.agents/rules/<name>.md` |
| **Skill** (on-demand capability) | `.agents/skills/<name>/SKILL.md` | `.claude/skills/<name>` → `../../.agents/skills/<name>` |
| **Workflow** | `.agents/workflows/<name>.md` | via the rule/skill that references it |

```bash
ln -s ../../.agents/rules/<name>.md .claude/rules/<name>.md      # add a rule
ln -s ../../.agents/skills/<name>   .claude/skills/<name>        # add a skill
```

- **Never put the real file under `.claude/`** — the gemini side reads `.agents/` and would never see it,
  and the two copies drift silently.
- **Skill vs rule:** a *skill* is a capability ("how to do X"), loaded on demand. A *rule* is a fact or
  guardrail ("this repo has Y; never do Z") and must be always-on — a guardrail that loads only on demand
  can arrive after the mistake.
- Sub-repos opened standalone need their **own** committed `.agents/`/`.claude/`; a root-level skill is not
  discovered from inside a subfolder. Replicate per repo rather than relying on the parent.

## Keeping this file current — the self-maintenance loop

Bake a section into the `AGENTS.md` that makes updating it **part of any task that touches layout**, so it
never silently rots:

1. **Notice drift.** Whenever you `ls` the scope, compare disk against the doc: a described folder that's
   gone, or a folder on disk that isn't described, is the signal.
2. **Trigger conditions** (name the concrete ones for the repo): a new folder/project appears; something
   graduates from scratch into real work; a project is archived; a "start at" doc moves; a rule/skill is
   added under `.agents/` (verify it follows the bridge above).
3. **Update in place** — adjust the one affected line; keep entries to one line.
4. **Fold it into the current task** and mention the edit.

## Steps

1. Identify the scope (single repo vs multi-project workspace) — it decides sections and whether upward
   references are allowed (they aren't, for a sub-repo).
2. Draft the sections above; keep every entry to one line pointing at the real source of truth.
3. If the repo carries rules/skills, set up (or verify) the `.agents/` ↔ `.claude/` bridge.
4. Add a `CLAUDE.md` containing `@AGENTS.md` if none exists.
5. Run the **before-committing checklist**.

## Before committing — checklist

- [ ] Every folder/package mentioned exists; every folder on disk that matters is mentioned (no drift).
- [ ] Nothing references a parent workspace, sibling repo, or personal/machine state — **self-contained**.
- [ ] No personal-memory slug (`[[…]]`, `feedback_…`, `project_…`) anywhere in the diff.
- [ ] Entries are one line, pointing at the project's own doc rather than restating it.
- [ ] If rules/skills exist: canonical file in `.agents/`, symlinked into `.claude/`, **no** real file
      under `.claude/`; rules have a `description:`.
- [ ] A "keeping this file current" section is present.
