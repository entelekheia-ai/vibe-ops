# AGENTS.md — tasks/

**Implementation work items** — technical debt, planned features, prerequisite changes that were already
decided (informally or via an accepted RFC). Tasks describe **what to build**, not whether to build it.

- Not design proposals — if something still needs design discussion, it belongs in `rfc/` first.
- **Everything here is pending.** Before assuming a task is done: check its `Status`, and verify the actual
  code — the dossier describes intent, not outcome.

## Hybrid model — dossier ↔ GitHub issue

Each task lives in **two artifacts that own different content**, never two copies:

| GitHub issue | `tasks/NNN-slug.md` (dossier) |
|---|---|
| status, assignment, checklist, **executive summary**, final learnings | the detailed working log + agent context + links to research/ADR |
| authority for "is this done" (closes with the PR) | never claims status |

The dossier's filename number matches the issue (`042-slug.md` ↔ issue #42). It links up to the issue;
the issue links down to the dossier.

## Ephemeral lifecycle

```
Planned → In Progress → Done → (dossier deleted; git history is the archive)
```

Dossiers do **not** accumulate. At closure: distill the executive summary + durable lessons **up** into the
issue (and `research/learnings/` via `/vibe-ops:new-learning`), record the breadcrumb in the issue —

```
git show <sha>:project/tasks/NNN-slug.md
```

— (`<sha>` = `git rev-parse HEAD` before deleting), then `git rm` the dossier. The working tree then shows
only in-flight work; the full detail stays recoverable in history.

## Naming

`<NNN>-<slug>.md` where `NNN` is the issue number (zero-padded). Before an issue exists, use `<slug>.md` and
rename once opened. Always link the issue in the dossier header.

Use `/vibe-ops:new-task` to scaffold one. See [`../../GOVERNANCE.md`](../../GOVERNANCE.md).
