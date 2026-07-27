---
name: new-task
description: Create a task dossier under project/tasks/, linked 1:1 to a GitHub issue, following the hybrid md+issue model. Use when the user asks to start a task, open a work item, track a piece of work, or "/new-task <topic>". For closing a finished task, use /vibe-ops:close-task instead.
disable-model-invocation: true
argument-hint: "<task topic>"
effort: inherit
---

# /new-task — Open a task dossier (issue-linked, ephemeral)

A task lives in **two artifacts that own different content** — never two copies of the same thing:

| Artifact | Owns | Never owns |
|---|---|---|
| **GitHub issue** | status, assignment, checklist, **executive summary**, final learnings | the long working log |
| **`project/tasks/NNN-slug.md`** (dossier, md) | the detailed working log + agent context + links to decision-log/research/ADR | "is this done" — the issue is authority |

The dossier is **ephemeral**: committed live while the work happens (history stays alive), then **deleted at
closure** after its lessons are distilled upward. Git history is the archive; the working tree only ever shows
in-flight work.

**Usage:** `/new-task <topic>` — e.g. `/new-task migrate storage adapter`. If no topic, ask.

---

## Step 0 — Locate the tasks setup

```bash
for d in project/tasks tasks; do [ -d "$d" ] && echo "TASK_DIR=$d" && break; done
for t in project/templates/task.md templates/task.md; do [ -f "$t" ] && echo "TASK_TPL=$t" && break; done
```

- No tasks dir → ask whether to create `project/tasks/`. No template → ask before inventing structure.
- **Read `<TASK_DIR>/AGENTS.md` if present** for this repo's naming/lifecycle; follow it over this skill.

## Step 1 — Inputs

1. **Topic** — short phrase (the task title). Use the argument if given, else ask.
2. **Issue** — is there already a GitHub issue for this work?
   - If yes, record its number `#NNN`.
   - If no, offer to open one now (`gh issue create --title "<topic>" --body "<one-line intent>"`) — **only
     if** the repo has a GitHub remote (`git remote -v` shows one) and `gh auth status` is ok. If the repo
     isn't on GitHub yet, proceed with a slug and add the issue number later (see naming below).

## Step 2 — Number & filename

- **With an issue:** name the dossier by the issue number → `<TASK_DIR>/<NNN>-<slug>.md` (zero-pad to the
  repo's width; default 3). This makes dossier ↔ issue obvious.
- **No issue yet:** use `<TASK_DIR>/<slug>.md`; rename to add the number once the issue exists.
- **Slug** — lowercase, hyphen-separated.

## Step 3 — Build the dossier

Start from `<TASK_TPL>` (delete its guidance comments). Set the header:

- `Status: Planned` · `Created:` (from `date +%Y-%m-%d`) · `Author:` (`git config user.name`).
- **Issue link** — add a line `Issue: <repo-url>/issues/NNN` (or "pending" if not opened yet). The dossier
  points *up* to the issue; the issue body points *down* to the dossier path.
- **Context / work items / order** — fill what is known; this is the detailed plan the issue does *not* carry.

Keep the issue lean: it holds the one-line intent + a link to the dossier, not the full plan.

## Step 4 — Commit live

Commit the dossier as you work (`git add <TASK_DIR>/<file> && git commit`). Update it freely during the task —
it is the living log. Status moves `Planned → In Progress → Done`.

## Step 5 — Closing the dossier

When the work is done, don't just delete the dossier — run **`/vibe-ops:close-task`**. It writes back to the
doc that started the work (so intent doesn't drift from outcome), propagates to living docs, spawns an ADR
if a decision emerged, then distills the summary + breadcrumb into the issue before removing the dossier.

## Checklist

- [ ] Dossier at `<TASK_DIR>/<NNN>-<slug>.md` (or `<slug>.md` if no issue yet), from the repo's template
- [ ] `Status`/`Created`/`Author` set; `Issue:` line links to the issue (or "pending")
- [ ] Issue holds the one-line intent + link to the dossier; the two don't duplicate the full plan
- [ ] Closure goes through `/vibe-ops:close-task`, not a plain delete
