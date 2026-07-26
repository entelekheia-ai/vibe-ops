---
name: new-rfc
description: Scaffold a new RFC (design proposal) from the target repo's own RFC template and numbering convention. Use when the user asks to create/draft an RFC, propose a design change, or "/new-rfc <topic>". Convention-agnostic — reads this repo's project/rfc lifecycle and template, so any repo-specific sections (impact tables, an INDEX) come from the repo, not this skill.
disable-model-invocation: true
argument-hint: "<what the RFC proposes>"
effort: low
---

# /new-rfc — Create an RFC

Scaffolds one RFC from **this repo's own** template. It discovers paths, numbering, and any repo-specific
steps from the repo — nothing about a particular project is baked in here.

**Usage:** `/new-rfc <topic>` — e.g. `/new-rfc streaming output format`. If no topic is given, ask.

---

## Step 0 — Locate the repo's RFC setup

```bash
for d in project/rfc project/rfcs rfc rfcs docs/rfc; do [ -d "$d" ] && echo "RFC_DIR=$d" && break; done
for t in project/templates/rfc.md templates/rfc.md .agents/templates/rfc.md; do [ -f "$t" ] && echo "RFC_TPL=$t" && break; done
```

- No RFC directory → ask whether to create one (default `project/rfc/`).
- No template → ask before proceeding; do not invent structure. (A `/vibe-ops:scaffold-new-repo` repo has both.)
- **Read `<RFC_DIR>/AGENTS.md` if present** — it is the authority for the numbering scheme and for any
  repo-specific extras (e.g. a package-impact table, an `INDEX.md` to update). Follow it; this skill only
  covers the repo-agnostic core.

## Step 1 — Collect inputs

1. **Topic** — a short phrase describing the proposal. Use the argument if given, else ask.
2. **Author** — default to `git config user.name` (ask only if that is empty).

## Step 2 — Next number

Per `<RFC_DIR>/AGENTS.md` if it defines a scheme; otherwise default `NNNN`, scanning active **and** archived
subfolders so a moved RFC never collides:

```bash
find "$RFC_DIR" -maxdepth 2 -name '[0-9][0-9][0-9][0-9]-*.md' | grep -oE '[0-9]{4}' | sort -n | tail -1
```

Returns N → `N+1` zero-padded to 4; nothing → `0001`.

## Step 3 — Title, slug, date

- **Title** — Title Case of the topic. **Slug** — lowercase-hyphenated. **Filename** — `<RFC_DIR>/<NNNN>-<slug>.md`.
- Run `date +%Y-%m-%d` for the `Created` field — never guess.

## Step 4 — Read the template

Read `<RFC_TPL>`. **Do not reproduce its structure from memory** — it is the single source of truth for
section order, formatting, and any license block or repo-specific tables.

## Step 5 — Fill the RFC

From the exact template content:

- Keep any license block; delete the template's instruction/guidance HTML comments.
- Heading → `# RFC-<NNNN>: <Title>`.
- Metadata: `Status: Draft`, `Created` (from `date`), `Author`. Delete `Depends on` / `Related` rows unless real.
- **Summary** — one plain-terms paragraph paraphrasing the proposal (no invented technical detail).
- **All other sections** — leave empty (no placeholder text) for the author to fill.
- **Repo-specific sections** (impact table, etc.) — fill per `<RFC_DIR>/AGENTS.md`. If that doc marks one as
  judgment-heavy and the session model is small, delegate just that section at higher effort:
  > `Agent({ effort: "high", prompt: "<the repo's instruction for that section>\nRFC topic: <topic>" })`
- **Open Questions** — one bullet per unresolved point surfaced while filling repo-specific sections; else empty.

## Step 6 — Write, then repo-specific follow-ups

Write the file to `<RFC_DIR>/<NNNN>-<slug>.md`. Then perform any follow-up `<RFC_DIR>/AGENTS.md` requires
(e.g. add a row to an `INDEX.md`). Skip if the repo defines none.

## Checklist

- [ ] File at `<RFC_DIR>/<NNNN>-<slug>.md`; number follows the repo's scheme
- [ ] License block (if any) intact; all guidance comments removed
- [ ] Heading `# RFC-<NNNN>: <Title>`; `Status: Draft`, `Created` (from `date`), `Author` set
- [ ] `Depends on`/`Related` removed unless populated
- [ ] Summary written; other sections empty; no template/placeholder text left
- [ ] Repo-specific sections/follow-ups done per `<RFC_DIR>/AGENTS.md` (or none required)
