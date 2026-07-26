---
name: new-learning
description: Distill one durable, reusable lesson into research/learnings/ — the permanent extract that outlives a closed issue or a deleted task dossier. Use when the user says they learned something worth keeping, wants to record a gotcha/insight, or "/new-learning <topic>", especially at task closure.
disable-model-invocation: true
argument-hint: "<the lesson, in a phrase>"
effort: inherit
---

# /new-learning — File a durable lesson

A learning is the **reusable takeaway** extracted from work — the thing worth reading months later, after
the task's issue is closed and its dossier deleted. One file per lesson, topic-named, in
`research/learnings/`. It is an *extract*, not a second copy of the working log.

**Usage:** `/new-learning <lesson>` — e.g. `/new-learning path-scoped rules load only in-folder`. If no
argument, ask what the lesson is.

---

## Step 0 — Locate learnings

```bash
for d in research/learnings project/research/learnings learnings; do [ -d "$d" ] && echo "LEARN_DIR=$d" && break; done
```

If none exists, default to `research/learnings/` (create it). A `/vibe-ops:scaffold-new-repo` repo has it.

## Step 1 — Shape the lesson

A good learning is **general enough to reuse** and **specific enough to trust**:

1. **Title** — the lesson as a claim, not a topic ("Path-scoped rules load only when a matching file is in
   context", not "rules").
2. **The lesson** — 2–5 sentences: what is true, and the concrete case that proved it (names/paths/versions
   so future-you believes it).
3. **Why it matters / how to apply** — the action it should change next time.
4. **Source** — the issue and a git ref, so the full detail is retrievable even after the dossier is gone
   (e.g. `#42` + `git show <sha>:project/tasks/042-slug.md`).

## Step 2 — Filename

`<LEARN_DIR>/<slug>.md`, slug = lowercase-hyphenated topic. If a closely related learning already exists,
**append/refine it** rather than creating a near-duplicate.

## Step 3 — Write

```markdown
# <Lesson as a claim>

<2–5 sentences: what's true + the concrete case that proved it.>

**Why it matters:** <the consequence of not knowing this>
**How to apply:** <what to do differently next time>

**Source:** <issue #NNN> · `git show <sha>:project/tasks/NNN-slug.md`
```

Keep it self-contained (no personal-memory slugs, no cross-repo/workspace references — a committed file
travels standalone).

## Checklist

- [ ] File at `<LEARN_DIR>/<slug>.md`; title is a claim, not a topic
- [ ] Concrete proof case included (names/paths/versions); not just an abstraction
- [ ] `Why it matters` + `How to apply` present
- [ ] Source issue + git ref recorded (so detail survives dossier deletion)
- [ ] Self-contained; refined an existing learning instead of duplicating where one existed
