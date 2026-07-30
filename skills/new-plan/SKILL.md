---
name: new-plan
description: Create an implementation plan — a permanent, living design record with Progress, Surprises & Discoveries, Decision Log and Outcomes sections that are maintained while the work happens. Use when the user asks to create/draft a plan, break implementation work into tracks, or "/new-plan <topic>". Also migrates an existing briefing/RFC/old-format doc into this format without inventing content. Convention-agnostic — reads this repo's own plans lifecycle and template.
disable-model-invocation: true
argument-hint: "<topic>"
effort: inherit
---

# /new-plan — Create an Implementation Plan

A plan answers *"how do we build X?"* — distinct from an RFC ("should we do X, and how?") and from a task
dossier (ephemeral, deleted at closure). A plan is **permanent**: it stays in the repo as the design record
after the work ships.

**This is an event skill** ([why that matters](../../references/convergence-policy.md); the four living
sections and what happens to them at closure are in
[`knowledge-lifecycle.md`](../../references/knowledge-lifecycle.md)). It records that a plan was started, at
a point in time. Running it twice
correctly produces two plans; it has no update mode. An existing plan is not re-scaffolded — it is
*advanced* through its own status lifecycle and its living sections are edited in place (see Step 7).

Scaffolds one plan from **this repo's own** template. It never hardcodes paths or a numbering scheme — it
discovers them, so the same skill works whether a repo keeps plans at `project/plans/` or at a top-level
`plans/`.

**Usage:** `/new-plan <topic>` — e.g. `/new-plan implement agent registry`. If no topic is given, ask.

---

## What makes this format different

Two properties are load-bearing. A plan that lacks them is a document, not a working instrument.

**It is a living document.** Four sections below the divider — `Progress`, `Surprises & Discoveries`,
`Decision Log`, `Outcomes & Retrospective` — are maintained *while the work happens*, not written at the
end. `Progress` must always reflect the real state, splitting a partial item into what is done and what
remains. `Surprises & Discoveries` is where a non-obvious fact discovered mid-work lands; at closure
`/vibe-ops:close-task` routes those entries into the repo's durable knowledge, so an entry left unwritten
is knowledge the repo never acquires.

**It is self-contained.** Write for a reader who has only the current working tree and this one file — no
memory of prior plans, no other context. Name files by full path, define non-obvious terms where first
used, and never write "as decided previously" or "see the architecture doc": say the thing here, even at
the cost of repeating yourself. This is what makes a plan survive a context reset or a handoff.

**Prose first.** Sentences over bullet lists in the narrative sections; checklists belong in `Progress` and
nowhere else. This is the deliberate inverse of `AGENTS.md`, which is a map and not a narrative — opposite
documents, opposite rules.

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
- If no template exists, ask before proceeding — do not invent a structure. Offer to copy it from
  `${CLAUDE_PLUGIN_ROOT}/skills/repo-setup/templates/project/templates/plan.md`.
- **Numbering/lifecycle authority, in order:** `<PLAN_DIR>/AGENTS.md` if it exists (older repos may define
  a custom scheme or extra steps) → else `.agents/rules/governance.md` if present → else the default `NNN`
  (3-digit) scheme used below. Follow whichever is found over anything in this skill.

## Step 1 — Collect inputs

1. **Topic** — a short phrase describing what the plan covers. Use the `/new-plan` argument if given, else
   ask: *"What should this plan cover? Give a short phrase."*
2. **Author** — default to `git config user.name` (ask only if that is empty).

Do not proceed until both are known.

## Step 1b — Migrating from another format?

If converting an existing document (a briefing, an RFC, an old plan format) into this format:

- **Preserve all existing content** — do not invent, simplify, or rewrite. Extract text as-is.
- **Reorganize by section** — sort existing content into the plan's sections.
- **Keep decisions and questions** — open questions, closed decisions and rationale move intact. Decisions
  found in the source belong in `Decision Log`; anything the source records as a surprise, a dead end, or a
  wrong assumption belongs in `Surprises & Discoveries`.
- **External references** — for a document outside this repo use a full URL, never a relative path
  (relative paths break the moment either doc moves, and a path into another repo dangles for anyone who
  clones this one alone). Internal refs use relative paths.

Do not proceed to Step 2 until the content review is complete.

## Step 2 — Determine the next plan number

```bash
find "$PLAN_DIR" -maxdepth 1 -name "[0-9][0-9][0-9]-*.md" | grep -oE '[0-9]{3}' | sort -n | tail -1
```

This scans active plans only — not archived subdirectories, and not deeper than one level unless
`<PLAN_DIR>/AGENTS.md` says otherwise.

- If it returns a number N, the new plan number is `N + 1`, zero-padded to 3 digits (e.g. `017`).
- If it returns nothing, start at `001`.

## Step 3 — Derive title and slug

- **Title** — Title Case of the topic ("implement agent registry" → "Implement Agent Registry").
- **Slug** — lowercase, hyphen-separated (`implement-agent-registry`).
- **Filename** — `<PLAN_DIR>/<NNN>-<slug>.md`.

## Step 4 — Read the template

Read `<PLAN_TPL>`. **Do not reproduce the template structure from memory.** The file is the single source
of truth for section order, formatting, and any license block.

## Step 5 — Build the plan file

Starting from the exact content of `<PLAN_TPL>`, apply these edits in order. **Write every section in
English, regardless of the conversation's language.**

- Keep any license comment block at the top unchanged; delete the guidance HTML comments.
- Heading → `# Plan-<NNN>: <Title>`.
- Metadata: `Status: Backlog`, `Created` (from `date +%Y-%m-%d` — never guess), `Author` (from Step 1).
  Delete `Depends on` / `Related` rows unless there is a confirmed dependency or known related doc.
- `Tracking issue` — keep the row only if the plan already has an issue, and state the split on it: **the
  issue owns status and the executive summary; this file owns the design and the working record.** Do not
  open an issue as part of this skill, and do not invent a number. Unlike a task's, a plan's issue closes
  while the plan file stays — see the repo's `project/**` governance rule.
- **Summary** — one paragraph in plain terms. No invented technical detail. If migrating, preserve the
  existing summary text as-is.
- **Goals** — 3–5 concrete, checkable outcomes. If migrating, extract existing goals unmodified.
- **Scope → In / Out** — explicit. Name what a reader would assume is included but isn't, and where it
  lives instead. Preserve existing scope when migrating.
- **Design, Tracks, Success criteria** — leave as empty template stubs for the author, unless migrating and
  the source has real content, in which case preserve it intact.
- **The four living sections** — scaffold them with their format examples intact, so the shape is obvious
  when the first real entry is added. Fill them only from the source document when migrating, never from
  inference. A brand-new plan legitimately has an empty `Progress` and no surprises yet.

**If a section has no corresponding content in the source** (migration case), do not invent content —
including tasks, checklists, or "done" criteria that read as resolved. Leave the template's stub, or a short
italic note such as *"Not yet defined — pending further exploration."* A section that looks filled-in but
was fabricated is worse than an honestly empty one: it misrepresents how settled the plan is. This applies
especially to **Success criteria** and **Tracks**, the sections most likely to invite invented specifics.

If the source carries its own caveat about being incomplete or not yet actionable ("this is a briefing, not
an executable plan"), preserve that caveat as a callout right after the metadata table rather than silently
upgrading its status to look more finished than it is.

## Step 6 — Write the file

Write the complete plan to `<PLAN_DIR>/<NNN>-<slug>.md`.

Do not create a `<PLAN_DIR>/INDEX.md` unless the repo's own `AGENTS.md` explicitly asks for one — plans are
discovered by browsing the folder, and an uninstructed index is an artifact nobody will keep updated.

## Step 7 — Hand off the maintenance contract

State plainly, in the report, what now keeps the plan alive — it is the part most likely to be dropped:

- `Progress` is updated at **every stopping point**, not at the end of the work.
- A non-obvious discovery goes into `Surprises & Discoveries` **when found**, with its evidence, while the
  evidence is still at hand.
- A decision goes into `Decision Log` when made; if it is hard to reverse, also run `/vibe-ops:new-adr`.
- `Status` moves `Backlog → In Progress → Shipped`. The file is never deleted — it is the record.
- At closure, `/vibe-ops:close-task` reads `Surprises & Discoveries` and routes each entry into the repo's
  durable knowledge. **Do not re-run `/new-plan` on an existing plan** — edit it in place.

## Checklist — verify before reporting done

- [ ] File exists at `<PLAN_DIR>/<NNN>-<slug>.md`; number follows the repo's scheme
- [ ] License block (if the template has one) intact; all guidance comments removed
- [ ] Heading is exactly `# Plan-<NNN>: <Title>`
- [ ] Metadata table has `Status: Backlog`, correct `Created` (from `date`), correct `Author`
- [ ] `Depends on`, `Tracking issue` and `Related` rows removed unless populated; no issue number invented
- [ ] All section headers from the template are present, **including the four living sections**
- [ ] Self-contained: no "as decided previously"; no relative path pointing outside this repo; every
      non-obvious term defined where first used
- [ ] Narrative sections are prose; checklists appear only under `Progress`
- [ ] Content written in English
- [ ] No index file created unless the repo's `AGENTS.md` asks for one
- [ ] If migrating: all existing content preserved as-is (no rewrites or inventions); source decisions
      landed in `Decision Log` and source surprises in `Surprises & Discoveries`
- [ ] If migrating: sections with no source content left as honest stubs, not invented
- [ ] If migrating: external refs use full URLs; internal refs use relative paths
- [ ] If the source had a caveat about being incomplete/non-actionable, it was preserved
- [ ] The maintenance contract (Step 7) was stated in the report, not assumed
