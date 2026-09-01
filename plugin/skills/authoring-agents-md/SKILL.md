---
name: authoring-agents-md
description: Create or refresh an AGENTS.md — the agent-facing entry map for a repo or workspace — and the CLAUDE.md that imports it. Applies a content filter (only what an agent cannot discover on its own), a size budget, the .agents/ ↔ .claude/ config bridge, and a self-maintenance loop. Use when adding an AGENTS.md to a repo or folder, when editing or adding a line to one that already exists, standardizing its agent config (rules/skills), reconciling one that has drifted from what is on disk, or cutting one that has grown past its budget.
argument-hint: "[path, default repo root] [audit]"
effort: high
paths:
  - "AGENTS.md"
  - "**/AGENTS.md"
  - "CLAUDE.md"
  - "**/CLAUDE.md"
hooks:
  PostToolUse:
    - matcher: "Write|Edit|MultiEdit"
      hooks:
        - type: command
          command: vibe-ops
          args: ["hook", "ops", "agents-md", "--fix", "pairing"]
          timeout: 10
---

# Authoring an AGENTS.md

An `AGENTS.md` (paired with a `CLAUDE.md` that is just `@AGENTS.md`) is the **entry map an AI collaborator
reads first**. It steers every later decision, so stale or padded content here is a primary source of
hallucination — and unlike most documentation, being wrong here is worse than being absent.

**This is a target-state skill.** The target is the file described below; whether one exists already is a
detail of the same job. Before changing an existing file, apply the four verbs from
[`${CLAUDE_PLUGIN_ROOT}/references/convergence-policy.md`](../../references/convergence-policy.md). Two
other references carry rules this skill does not repeat:
[`instruction-surfaces.md`](../../references/instruction-surfaces.md) (which surface gets a fact, the
`.agents/`↔`.claude/` bridge, nested files) and
[`authoring-style.md`](../../references/authoring-style.md) (phrasing, budget mechanics, diagrams,
English-only).

**Scale the pass to the edit.** This skill loads whenever an `AGENTS.md` or `CLAUDE.md` is opened, so most
of the time it arrives for one added line, not a rewrite. Then only three things apply, and the nine steps
below **MUST NOT** be run: the line passes Step 3's content filter or it does not get written; it goes in
the section that already owns its subject rather than a new one; and if it puts the file over budget,
something comes out in the same edit. A full pass is for an explicit invocation, an absent file, or one you
have just found to be wrong about the disk.

---

> **Prefer the MCP tool over the terminal.** This plugin ships its own `vibe-ops` MCP server
> (`.claude-plugin/plugin.json`), so the verbs below are tools, and a tool returns its report as
> structured data instead of terminal text to read back. The tool's full name depends on how the server
> was registered — `mcp__vibe-ops__<noun>` from a project `.mcp.json`, `mcp__plugin_vibe-ops_vibe-ops__<noun>`
> when it comes from the plugin. **If neither is listed, the CLI is correct**: the shell forms shown below
> are the same command, and the server may simply not be running in this session.

## Step 1 — Scope

Decide what this file covers, because it decides everything else:

- **A committed repository** — must make sense to someone who cloned *just this repo*. No reference to a
  parent workspace, a sibling repository, cross-repo deduplication stories, or personal or machine state.
  Those dangle and leak private layout the moment the repo travels. **A sub-repo may not reach upward.**
- **A multi-project workspace root** — may map its child folders, and should say explicitly that they are
  independent and must not be treated as one codebase.

## Step 2 — Survey (skip only if no file exists)

Read the current file and produce a gap list before writing. **Delegate that survey to the
`vibe-ops:governance-auditor` agent** — the four inputs are in
[`convergence-policy.md`](../../references/convergence-policy.md), and the target state is this file's
Steps 1 and 3–8. It has no writing tool, and the listings stay in its context rather than yours. Run these
yourself only if the agent is not in the session's listing:

```bash
vibe-ops check .   # budget, links, the bridge, rule frontmatter
ls -a; ls .agents/rules .claude/rules 2>/dev/null
```

The script is the mechanical half of the survey (Step 9 explains what it covers). It reads the repository
and writes nothing into it. Two kinds of drift it cannot see, and you must:

1. **A folder on disk that nothing describes.** The script verifies that what the file *names* resolves;
   the reverse direction is judgement.
2. **Content that fails the filter.** See Step 3.

If the user asked for an `audit`, report the gap list — the script's findings included — with the verb you
would apply to each, and stop.

## Step 3 — The content filter: what earns a line

The only content worth the space is **what a competent agent cannot discover on its own in a few minutes**
([Roland Huß](https://ro14nd.de/what-goes-in-agents-md/)). This is not a style preference — an evaluation
across 138 real-world tasks found generated context files *reduced* success while raising cost, with
codebase overviews the least useful category of all
([evidence](../../../project/research/context-file-practices.md)).

**Earns a line:**

- Where the source of truth is, when more than one plausible candidate exists.
- A command whose behaviour is not guessable — what it writes, what it needs first, what looks like it
  works and does not.
- An invariant: *do this and it breaks*. The highest-value content in the file.
- A boundary: what not to touch, and what is out of scope by default.
- A convention the code follows but does not state, and no linter enforces.

**Does not earn a line — delete on sight:**

| Content | Why not |
|---|---|
| File-by-file or function-by-function description of the code | Reading the code is what that is for; it drifts on every refactor |
| A table restating what a generated file already contains | Two copies; the hand-written one goes stale first |
| Standard practice for the language, framework or tooling | The model already knows it |
| Status, roadmap, or history of how the design evolved | Belongs in a plan, an ADR, or `project/log/` |
| A rule a test, type, lint rule or hook already enforces | Write the guard instead — it is not ignorable |
| Anything true of *any* repository | Not repository knowledge; it belongs in the maintainer's own notes |

Test each line: *is it specific, falsifiable, and would its absence cost an agent real time?* Three yeses
or it goes.

## Step 4 — Budget

**Aim for 150 lines.** The always-on block passes a relevance gate as a whole, so padding does not merely
cost tokens — it raises the chance the lines that mattered are discounted with it. Over budget, the fix is
**relocation, not compression**: see the escape table in
[`authoring-style.md`](../../references/authoring-style.md#budget), and route each displaced fact with
[`instruction-surfaces.md`](../../references/instruction-surfaces.md#where-each-fact-goes).

## Step 5 — Sections

Pick what fits; do not pad. Each entry is one line pointing at the real source of truth.

- **What this is** — one short paragraph. For a workspace, that its folders are independent.
- **Layout** — a table of the folders whose *role* is not obvious from their name. A row earns its place
  by saying what a directory listing does not: which folder is authoritative for what, where to start
  reading, or a constraint invisible from outside. Omit folders that explain themselves — an agent reads
  the tree anyway, and a row that restates it is the least useful content measured
  ([research](../../../project/research/context-file-practices.md)). **Not** one row per folder.
  The exception is a multi-project workspace, where the table maps *boundaries between independent
  projects* — which no listing conveys, so there every project gets a row.
- **How this repo works** — the invariants and non-obvious mechanics. This is the section the filter in
  Step 3 exists to fill, and the reason the file is worth reading at all.
- **Source of truth** — a table mapping *what* → *where*.
- **Out of scope by default** — for a multi-project workspace: which folders to ignore unless named.
- **Agent config layout** — only if the repo carries rules or skills; build the bridge per
  [`instruction-surfaces.md`](../../references/instruction-surfaces.md#the-agents--claude-bridge).
- **Keeping this file current** — the loop in Step 7. Always include it.

## Step 6 — Point at derived knowledge instead of restating structure

If the repository carries a **generated index** of itself — a knowledge graph, a symbol or LSP index,
generated API documentation — then structural questions have a better answer than a hand-written section
that decays. Say the index exists, how to query it, and what it covers, and delete the layout prose it
replaces. That is the single largest cut available in most oversized files.

Two constraints:

- **Depend on a detected capability, never a named product.** Write "if the repo exposes a code-graph
  index, prefer querying it over browsing the source"; do not hard-code a tool name a reader may not have.
  A repository without the tooling must degrade to plain reading with nothing broken.
- **State the index's scope, or it lies.** An index that covers part of the tree while the file implies it
  covers all of it will answer confidently about the wrong code. If the scope is partial, say which part.

## Step 7 — The self-maintenance loop

Bake a section into the file that makes updating it **part of any task that touches layout**:

1. **Notice drift.** Whenever you `ls` the scope, compare disk against the tables above.
2. **Trigger conditions** — name the concrete ones for *this* repo: a folder or package appears or is
   archived; a "start at" doc moves; an invariant stops being true; a rule or skill is added under
   `.agents/`; a build step or manifest field worth knowing about appears.
3. **Update in place** — adjust the one affected line, keep entries to one line.
4. **Fold it into the current task** and mention the edit.

## Step 8 — `CLAUDE.md`

Ensure a `CLAUDE.md` exists containing `@AGENTS.md`, plus only content another agent would ignore or
misread. If there is none, one line is the correct end state — not a stub. This skill's own `hooks:`
block does this mechanically after every `AGENTS.md` write when `vibe-ops` is on PATH — but do it
yourself too, rather than assume the hook fired: it is silent on success, and a session without the
command installed gets no hook at all.

## Step 9 — Verify mechanically

```bash
vibe-ops check .
```

The line budget, every relative link resolving inside the repository, `.claude/` holding real symlinks
(including the case where git checked one out as text, which reads as a working rule file containing one
line of nonsense), every rule declaring a `description:`, and no personal-memory link in tracked markdown.
It reads the repository and writes nothing into it, so it is safe against a repo you do not own.

If this repository has names that must never appear in it, supply them for the run — `PRIVATE_NAMES='one
name per line' vibe-ops check .` (the CLI passes its own environment through to the check it runs) —
they are held in a temporary file for the run and deleted when it ends. **Never write that list into the
repository**; a command that spells out private names in order to grep for them has already leaked them.

A finding is not advisory. Fix it, or state why the run is expected to fail, before reporting done.

## Checklist

The mechanical items are gone from this list because the script above enforces them; what is left is what
someone still has to judge.

- [ ] Step 9 run, and green — or every finding addressed
- [ ] No folder on disk that matters is left undescribed (the direction the script cannot check)
- [ ] Self-contained — no parent workspace, sibling repo, machine path, or personal state
- [ ] Every line passes the Step 3 filter — nothing a lint/type/test/hook already enforces, no file-by-file
      description, no status or history
- [ ] Anything cut to get under budget was **relocated**, not deleted, unless it failed the filter
- [ ] Entries are one line pointing at a source of truth rather than restating it
- [ ] No fact appears both here and in a rule — the two load identically
- [ ] If a nested `AGENTS.md` was written: something actually loads it (sibling `CLAUDE.md`, `@`-import, or
      it should have been a path-scoped rule)
- [ ] A "keeping this file current" section is present, with trigger conditions specific to this repo
- [ ] `CLAUDE.md` exists and imports `@AGENTS.md`
