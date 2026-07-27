---
name: close-task
description: Close a finished task dossier — write back to the source doc with what actually happened, propagate the change to living docs, spawn an ADR if a decision emerged, then distill and delete the dossier. Use when a task/issue is done, when the user says "wrap this up" or "close the task", or before deleting a project/tasks/ dossier.
disable-model-invocation: true
argument-hint: "<task slug or issue number>"
effort: inherit
---

# /close-task — Close the loop, don't just delete the dossier

The failure mode this skill exists to prevent: a task finishes, the dossier gets deleted (or forgotten), and
the md file that *planned* the work — a task brief, an RFC, a plan doc — is left describing intent that no
longer matches reality. The fix is not a new document type; it's a step that was missing: **before
distilling and deleting, go back and update the doc that started the work.**

**Usage:** `/close-task <slug or issue number>` — e.g. `/close-task 042` or `/close-task migrate-storage`.

---

## Step 1 — Find the dossier and its source doc

Locate `project/tasks/<NNN>-<slug>.md` (or `<slug>.md`). Read it in full — the `Context` section names why
the work exists; if it was spawned from an RFC, plan brief, or another md, that's the **source doc**.

If the dossier itself *is* the source doc (task wasn't derived from anything else), it's still the target of
Step 2 — the write-back and the dossier are the same file until Step 5 deletes it.

## Step 2 — Write back what actually happened

Open the source doc and update it to reflect reality, not the original plan:

- What shipped as planned, what changed, what got cut, what appeared mid-work that wasn't anticipated.
- If the source doc is an `Accepted` RFC or a brief that's meant to freeze after implementation, don't rewrite
  it in place — add a short "Implementation note" pointing at what actually happened, or move it per this
  repo's RFC lifecycle (frozen → `implemented/`, see the `project/**`-scoped governance rule).
- This step is **not optional and not the same as Step 4** (the issue's executive summary). The source doc is
  read by someone who finds it later without the issue open in front of them — it needs to be accurate on
  its own.

## Step 3 — Propagate to living docs

Diff-driven: look at what the work actually changed and ask which doc now describes something that no longer
exists.

- Package/repo `README.md` — did the public surface change? (Usage/API/install steps.)
- `docs/` — did a how-to, reference, or explanation page describe the old behavior?
- Root `AGENTS.md` — did the layout, a package's status, or a "not obvious from the code" fact change?

Skip anything that didn't change. This is not a full documentation audit — only what this task touched.

## Step 4 — ADR, if a decision emerged

If the work settled something hard to reverse that wasn't already an ADR (a library choice, an API shape,
a rejected alternative worth recording), run `/vibe-ops:new-adr` now, before closing the task. If there's
rich context an ADR is too terse to carry (dead ends, why an alternative was rejected in detail), write a
paired `project/log/<slug>.md` linked to the ADR.

## Step 5 — Distill and delete

1. **Distill upward** — write the executive summary into the **issue** (comment or body): what shipped, in a
   few lines, for someone who never reads the dossier.
2. **Drop the breadcrumb** — `<sha>` = `git rev-parse HEAD` (the commit that still contains the dossier).
   Record in the issue, verbatim:

   ```
   git show <sha>:project/tasks/NNN-slug.md
   ```
3. **Delete the dossier** — `git rm project/tasks/<NNN>-<slug>.md` and commit
   (`chore(tasks): close <slug>, archived in history`).

## Checklist

- [ ] Source doc updated with what actually happened (Step 2) — not skipped because "the issue has it"
- [ ] Docs that the work made stale are updated (README / `docs/` / `AGENTS.md`), or confirmed none did
- [ ] ADR written if a hard-to-reverse decision emerged; paired `project/log/` entry if there's context an
      ADR can't carry
- [ ] Executive summary distilled into the issue
- [ ] Breadcrumb `git show <sha>:project/tasks/NNN-slug.md` recorded in the issue
- [ ] Dossier `git rm`'d and committed
