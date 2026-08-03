<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Collapse `close-task` + `close-plan` into one `close`, the way `new` already is

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-08-03 |
| Author | Danilo Borges |
| Issue | pending |

<!-- Status lifecycle: Planned → In Progress → Done → (dossier removed; git history is the archive) -->

---

## Context

All six work items landed and verified: `skills/close/SKILL.md` dispatches on `task`/`plan`,
`skills/close/finalize.sh` is the moved (unchanged) mechanical tail, every live reference across the repo
and its shipped templates was swept (a functionally critical one — `hooks/task-dossier-guard.sh`'s
deletion-guard regex — included, not just prose), the frontmatter is single-quoted, and
`skills/close-task/`, `skills/close-plan/` are deleted. `scripts/check-agents-md.sh` (15/15),
`--self-test`, `scripts/test-plan-progress-nudge.sh` (18/18) and `claude plugin validate .` all pass.

Plan-005 collapsed four `new-*` skills into one `/vibe-ops:new <adr|rfc|plan|task>`, dispatching on an
argument with the repo resolved once in Step 0 — 1,436 characters of skill-listing budget down to ~380.
Closure was left as two separate skills, `skills/close-task/` (155 lines + `finalize.sh`, the mechanical
tail) and `skills/close-plan/` (107 lines), that share most of their spine: find the record, route what
the work taught through the promotion test, propagate to living docs, run the demotion check, close the
issue.

Per ADR-0001, both `close-task` and `close-plan` are *event* skills (append-only, no update mode) — the
"never split into two skills" clause in that ADR binds *target-state* skills, so this collapse is
consistent with it, not an exception to it.

`finalize.sh` already carries a `--plan <path>` mode, so the shared mechanical tail already exists in one
place; it needs to move under the new skill's directory.

Full design: `/Users/danilo/.claude/plans/entao-monta-um-plano-delightful-patterson.md`, Task 003.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Decide: forwarding stubs vs. clean break for the old names — record the decision | S |
| 2 | P0 | New `skills/close/SKILL.md` dispatching on `task`/`plan` | M |
| 3 | P0 | Move `finalize.sh` to `skills/close/finalize.sh` | S |
| 4 | P0 | Update every in-repo reference (six shipped-template files + README + AGENTS.md) | M |
| 5 | P0 | Quote the new skill's frontmatter description; verify against `45-skill-frontmatter.sh` | S |
| 6 | P1 | Delete or stub `skills/close-task/`, `skills/close-plan/` per item 1's decision | S |

### 1. Forwarding stubs vs. clean break — P0

**What:** `/vibe-ops:close-task` and `close-plan` are named in six files vibe-ops *ships into other
repositories* (`skills/repo-setup/templates/agents/rules/governance.md`, `templates/root/GOVERNANCE.md`,
scaffolded `plan.md`/`task.md`). Those copies already exist in repos this rename cannot reach.
**Why:** Deciding silently means discovering the breakage later, in someone else's repo.
**Change:** Pick one — thin forwarding skills that point at `/vibe-ops:close`, or a declared break in
CHANGELOG (0.7.0 already declared one, for the four removed `new-*` commands). Record the choice and
reasoning in Decision Log below before touching skill files.

### 2. New `skills/close/SKILL.md` — P0

**What:** One skill, argument `<task|plan>` (or auto-detected from the record given), dispatching to the
shared steps with only the differing tail branching:

| | `task` | `plan` |
|---|---|---|
| Writes back | to the source doc, what actually happened | the retrospective, against the plan's own goals |
| Spawns an ADR | if a hard-to-reverse decision emerged | same |
| Ends with | distil into the issue, **delete** the dossier | close the issue, **keep** the file |

**Why:** Removes the duplicated spine (routing, promotion test, demotion check, issue closure) that
currently exists in two files.
**Change:** Apply Plan-005's deduplication rule — where the template's own comment already states
something, the skill points at the template instead of repeating it.

### 3. Move finalize.sh — P0

**What:** `skills/close-task/finalize.sh` → `skills/close/finalize.sh`.
**Why:** It is already the shared mechanical tail (`--plan <path>` mode exists); it belongs under the
skill that now owns both record types.
**Change:** `git mv`; update the one caller in the new SKILL.md.

### 4. Update references — P0

**What:** Every `/vibe-ops:close-task` / `close-plan` mention across shipped templates, README, AGENTS.md.
**Why:** A rename that misses a reference is exactly the drift Task 002's new `skills/ ↔ prose` check
exists to catch — run it after this item as the acceptance check.
**Change:** Per item 1's decision — either add `/vibe-ops:close` alongside forwarding stubs, or replace
outright.

### 5. Frontmatter — P0

**What:** Quote the new skill's `description:` outright.
**Why:** 0.7.0 shipped `skills/new/SKILL.md` with an unquoted description containing `": "`, which loads
with empty metadata and no error — caught only by `claude plugin tag` at release. Not repeating it.
**Change:** Single-quote the description; run `scripts/checks/45-skill-frontmatter.sh` (via
`check-agents-md.sh`) before committing.

### 6. Remove or stub old skills — P1

**What:** Removed outright per item 1's clean-break decision — `skills/close-task/`, `skills/close-plan/`
deleted via `git rm`.
**Why:** No stub was ever a candidate once item 1 chose clean-break.
**Change:** `git rm -r skills/close-task skills/close-plan`.

## Implementation order

```
P0:  1, 2, 3, 5, 4
P1:  6
```

## Surprises & Discoveries

- Observation: The planning-turn claim *"`finalize.sh` already carries a `--plan <path>` mode, so the
  shared mechanical tail already exists in one place"* was wrong. `--plan <path>` names a **source plan a
  task was spawned from** — it appends the closed dossier's breadcrumb to that plan file. It has nothing
  to do with closing a plan record: nothing is deleted when a plan closes, so there is no mechanical tail
  for it to share. `finalize.sh` is 100% task-closure-specific; it moved to `skills/close/finalize.sh`
  unchanged, and plan closure stays the direct, script-free sequence it always was (set `Status`, write
  the issue comment via `gh`, keep the file).
  Evidence: reading `skills/close-task/finalize.sh` in full before writing the merged skill, rather than
  building on the planning turn's characterization of it.
  **Routed:** true in any repository (verify a claim about existing code by reading the code, not by
  reusing an earlier characterization of it) — the maintainer's own practice, not vibe-ops's knowledge.
  Already on record there; not duplicated here.

- Observation: The dossier's own Work item 2 table claimed plan closure "Spawns an ADR: … same" as task
  closure. `skills/close-plan/SKILL.md`'s six steps never mention spawning an ADR — a hard-to-reverse
  decision made mid-plan is expected to already have one, written into the plan's own `Decision Log` while
  the work happened (per the plan template's own comment), so closure has nothing left to check there.
  The merged skill's Step 2 is marked task-only for this reason, with a one-line note explaining the
  asymmetry rather than silently dropping the row.
  Evidence: full read of `skills/close-plan/SKILL.md` before merging — the row was written from an
  assumption of symmetry between the two originals, not from their actual text.
  **Routed:** same maintainer's-practice fact as above (recurrence noted, not repeated as a second
  entry). The repo-specific residue — that a plan's hard-to-reverse decisions route through its own
  `Decision Log` rather than a closure-time ADR step — is already stated where it belongs: inline in
  `skills/close/SKILL.md` Step 2, not as separate prose here.

## Decision Log

- Decision: Clean break — `/vibe-ops:close-task` and `/vibe-ops:close-plan` are removed outright, no
  forwarding stubs. Replaced by `/vibe-ops:close task` and `/vibe-ops:close plan`.
  Rationale: Matches the precedent this repo already set today, in the same release: Plan-005 collapsed
  four `new-*` commands into `/new <type>` with a declared break in `CHANGELOG.md`, not forwarding stubs.
  A stub costs listing budget forever for a rename that costs nothing to type correctly once documented,
  and this is a personal plugin with few installs to break gently for. Every live reference this rename
  could reach was swept in item 4; the copies already shipped to other repos before this release keep
  their old text, same as any other repo's own frozen dependency on a prior version — that is what the
  CHANGELOG entry is for.
  Date / Author: 2026-08-03 / Danilo Borges

## Closure

- [x] Run `/vibe-ops:close task` — do not just delete this file.
