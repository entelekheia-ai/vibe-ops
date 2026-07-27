---
name: new-plan
description: Scaffold a new implementation plan from the target repo's own plan template and numbering convention. Use when the user asks to create/draft a plan, break down implementation work into tracks, or "/new-plan <topic>". Also handles migrating an existing briefing/RFC/old-format doc into a plan without inventing content. Convention-agnostic — reads this repo's project/plans lifecycle and template.
disable-model-invocation: true
argument-hint: "<topic>"
effort: low
---

# /new-plan — Create an Implementation Plan

A plan answers *"how do we build X?"* — it breaks work into tracks and tasks, distinct from an RFC ("should
we do X, and how?") and from a task dossier (ephemeral, deleted at closure). A plan is **permanent**: it
stays in the repo as the design record even after the work ships.

Scaffolds one plan from **this repo's own** template. It never hardcodes paths or a numbering scheme — it
discovers them from the repo, so the same skill works whether a repo keeps plans at `project/plans/` or
(like some older repos) at a top-level `plans/`.

**Usage:** `/new-plan <topic>` — e.g. `/new-plan implement agent registry`. If no topic is given, ask.

---

## Step 0 — Locate the repo's plan setup

Discover, in order, and stop at the first hit:

```bash
# plan directory
for d in project/plans plans docs/plans; do [ -d "$d" ] && echo "PLAN_DIR=$d" && break; done
# plan template
for t in project/templates/plan.md templates/plan.md .agents/templates/plan.md; do [ -f "$t" ] && echo "PLAN_TPL=$t" && break; done
```

- If no plan directory exists, ask the user whether to create one — default `project/plans/` (matching this
  plugin's ADR/RFC/task convention). Some repos predate this convention and keep a root-level `plans/`
  instead; if one already exists, use it as found rather than moving it.
- If no template exists, ask before proceeding — do not invent a structure.
- **Numbering/lifecycle authority, in order:** `<PLAN_DIR>/AGENTS.md` if it exists (older repos may define a
  custom scheme or extra steps) → else `.agents/rules/governance.md` if present (repos scaffolded by
  `/vibe-ops:scaffold-new-repo`) → else the default `NNN` (3-digit) scheme used below. Follow whichever is
  found over anything in this skill.

## Step 1 — Collect inputs

1. **Topic** — a short phrase describing what the plan covers. Use the `/new-plan` argument if given, else
   ask: *"What should this plan cover? Give a short phrase."*
2. **Author** — default to `git config user.name` (ask only if that is empty).

Do not proceed until both are known.

## Step 1b — Migrating from another format?

If you are converting an existing document (a briefing, an RFC, an old plan format) into this plan format:

- **Preserve all existing content** — do not invent, simplify, or rewrite sections. Extract text as-is.
- **Reorganize by section** — sort existing content into the appropriate plan sections (Summary, Goals,
  Scope, Design, Tracks, etc.).
- **Keep decisions and questions** — if the source document has open questions, closed decisions, or
  rationale, move them intact to the corresponding sections.
- **External references** — if linking to a document outside this repo, use a full URL rather than a
  relative path (relative paths break the moment the doc moves). For docs inside this repo, use relative
  paths.

Do not proceed to Step 2 until the content review is complete.

## Step 2 — Determine the next plan number

```bash
find "$PLAN_DIR" -maxdepth 1 -name "[0-9][0-9][0-9]-*.md" | grep -oE '[0-9]{3}' | sort -n | tail -1
```

This scans active plans only — not archived subdirectories, and not deeper than one level unless
`<PLAN_DIR>/AGENTS.md` says otherwise.

- If the command returns a number N, the new plan number is `N + 1`, zero-padded to 3 digits (e.g. `017`).
- If it returns nothing, start at `001`.

## Step 3 — Derive title and slug

- **Title** — Title Case of the topic (e.g. "implement agent registry" → "Implement Agent Registry").
- **Slug** — lowercase, hyphen-separated (e.g. `implement-agent-registry`).
- **Filename** — `<PLAN_DIR>/<NNN>-<slug>.md`.

## Step 4 — Read the template

Read `<PLAN_TPL>`. **Do not reproduce the template structure from memory.** Use the file content as the
single source of truth for section order, formatting, and any license block.

## Step 5 — Build the plan file

Starting from the exact content of `<PLAN_TPL>`, apply these edits in order. **Write every section in
English, regardless of the conversation's language.**

- Keep any license comment block at the top unchanged.
- Delete the template's instruction/guidance HTML comments.
- Heading → `# Plan-<NNN>: <Title>`.
- Metadata: `Status: Backlog`, `Created` (from `date +%Y-%m-%d` — never guess), `Author` (from Step 1).
  Delete `Depends on` / `Related` rows unless there is a confirmed dependency or known related doc.
- **Summary** — one paragraph paraphrasing the topic in plain terms. Do not invent technical detail yet. If
  migrating, preserve the existing summary text as-is; do not rewrite.
- **Goals** — 3–5 concrete outcomes ("done" looks like what?). If migrating, extract existing goals
  unmodified.
- **Scope → In Scope / Out of Scope** — explicit. If migrating and scope already exists, preserve it.
- **Design, Success Criteria, Tracks, Dependencies, Open Questions, Related** — leave as empty template
  stubs for the author to fill, unless migrating and the source has real content for a section, in which
  case preserve it intact.

**If a section has no corresponding content in the source document** (migration case), do not invent
content to fill it — including tasks, checklists, or "done" criteria that read as resolved/certain. Leave
it as the template's empty stub, or write a short italic note such as *"Not yet defined — pending further
exploration."* A section that looks filled-in but was fabricated is worse than an honestly empty one: it
misrepresents how settled the plan actually is. This applies especially to **Success Criteria** and
**Tracks**, the sections most likely to invite invented specifics.

If the source document carries its own caveat about being incomplete or not yet actionable (e.g. "this is a
briefing, not an executable plan yet"), preserve that caveat — as a callout right after the metadata table —
rather than silently upgrading its status to look more finished than it is.

## Step 6 — Write the file

Write the complete plan to `<PLAN_DIR>/<NNN>-<slug>.md`.

Do not create a `<PLAN_DIR>/INDEX.md` unless the repo's own `AGENTS.md` explicitly asks for one — plans are
discovered by browsing the folder, and an uninstructed index is an artifact nobody will keep updated.

## Checklist — verify before reporting done

- [ ] File exists at `<PLAN_DIR>/<NNN>-<slug>.md`; number follows the repo's scheme
- [ ] License block (if the template has one) intact; all guidance comments removed
- [ ] Heading is exactly `# Plan-<NNN>: <Title>`
- [ ] Metadata table has `Status: Backlog`, correct `Created` (from `date`), correct `Author`
- [ ] `Depends on` and `Related` rows removed unless populated
- [ ] All section headers from the template are present
- [ ] Content written in English
- [ ] No index file created unless the repo's `AGENTS.md` asks for one
- [ ] If migrating: all existing content preserved as-is (no rewrites or inventions)
- [ ] If migrating: sections with no source content are left as honest stubs, not invented
- [ ] If migrating: external refs (outside this repo) use full URLs; internal refs use relative paths
- [ ] If the source document had a caveat about being incomplete/non-actionable, it was preserved
