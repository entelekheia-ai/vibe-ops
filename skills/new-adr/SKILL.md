---
name: new-adr
description: Scaffold a new Architecture Decision Record from the target repo's own ADR template and numbering convention. Use when the user asks to create/record an ADR, write a decision record, or "/new-adr <topic>". Convention-agnostic — reads this repo's project/adr lifecycle, so it fits both a DA-style scheme and a plain NNNN scheme.
disable-model-invocation: true
argument-hint: "<decision topic>"
effort: inherit
---

# /new-adr — Create an Architecture Decision Record

Scaffolds one ADR file from **this repo's own** template. It never hardcodes paths or a numbering scheme —
it discovers them from the repo, so the same skill works across every repo you open.

**Usage:** `/new-adr <decision topic>` — e.g. `/new-adr REST-first API surface`. If no topic is given, ask.

**This is an event skill** ([why that matters](../../references/convergence-policy.md)). It records one
decision, taken at a point in time. It has **no update mode**: an accepted ADR is immutable, and changing a
decision means writing a *new* ADR that supersedes it — never editing the old one. Running this skill twice
correctly produces two records.

---

## Step 0 — Locate the repo's ADR setup

Discover, in order, and stop at the first hit:

```bash
# ADR directory
for d in project/adr adr docs/adr; do [ -d "$d" ] && echo "ADR_DIR=$d" && break; done
# ADR template
for t in project/templates/adr.md templates/adr.md .agents/templates/adr.md; do [ -f "$t" ] && echo "ADR_TPL=$t" && break; done
```

- If no ADR directory exists, ask the user whether to create one (default `project/adr/`).
- If no template exists, ask before proceeding — do not invent a structure. (A repo scaffolded by
  `/vibe-ops:repo-setup` always has both.)
- **Numbering/lifecycle authority, in order:** `<ADR_DIR>/AGENTS.md` if it exists (older repos, may define a
  custom scheme like `DA<minor>-<seq>`) → else `.agents/rules/governance.md` if present (repos scaffolded by
  `/vibe-ops:repo-setup`) → else the default `NNNN` scheme in Step 2. Follow whichever is found over
  anything in this skill.

## Step 1 — Collect inputs

1. **Decision** — a short noun phrase (the ADR title). Use the `/new-adr` argument if given, else ask:
   *"What decision should this ADR record? Give a short noun phrase."*
2. **Supersession** — ask: *"Does this ADR supersede an existing one? If yes, which id?"* Record it or "none".

Do not proceed until both are known.

## Step 2 — Determine the next id

Follow `<ADR_DIR>/AGENTS.md` if it defines a scheme — some repos tie ADR ids to a release train rather than
a flat counter (`<prefix><minor>-<seq>`). Otherwise use the **default `NNNN` scheme**:

```bash
ls "$ADR_DIR" | grep -oE '^[0-9]{4}' | sort -n | tail -1
```

- Returns N → new id is `N+1`, zero-padded to 4 (`0007`). Nothing → start at `0001`.

## Step 3 — Today's date

```bash
date +%Y-%m-%d
```

Use the output as the `Date` field. Never guess the date.

## Step 4 — Slug, filename, deciders

- **Slug** — lowercase, hyphen-separated ("REST-first API surface" → `rest-first-api-surface`).
- **Filename** — `<ADR_DIR>/<id>-<slug>.md`.
- **Deciders** — default to `git config user.name` (fall back to asking).

## Step 5 — Read the template

Read `<ADR_TPL>`. **Do not reproduce its structure from memory** — the file is the single source of truth
for section order, formatting, and any license block.

## Step 6 — Status

Default **`Accepted`** — most ADRs record a decision already made. Use `Proposed` only if the user says it
is being circulated for ratification first. If unclear, ask; default to `Accepted`.

## Step 7 — Fill the ADR

Starting from the exact template content. **Write every section in English, regardless of the
conversation's language.**

- Keep any license comment block at the top unchanged.
- Delete the template's instruction/guidance HTML comments.
- Set the heading to the decision noun phrase; set `Status`, `Date`, `Deciders`.
- `Supersedes`: set to the superseded id, or remove the row. Remove the `Superseded by` row (filled later).
- **Context** (2–4 sentences: forces/constraints, why now — facts, not the conclusion).
- **Decision** — one active-voice sentence, "We will …". One decision per ADR.
- **Options considered** — the judgment-intensive part. Enumerate realistic alternatives incl. rejected
  ones with honest trade-offs; mark the chosen one `(chosen)`; ≥1 rejected with a reason.
  > **Effort seam.** If the session model is small or the decision is non-trivial, delegate just this
  > section at higher effort, then paste the result:
  > `Agent({ effort: "high", prompt: "Decision: <decision>\nContext: <context>\n\nList 3–4 plausible options incl. the chosen one; for each a label, a one-line pro/con, chosen or rejected+why. Markdown bullets: **Option X — label** — trade-off." })`
- **Consequences** — what gets easier AND harder; accepted costs; follow-ups/risks.
- **Sunset & reversal** — include **only if** the decision is expected to expire (stopgap): *When to revisit*
  + *How to unwind*. Omit entirely otherwise (no empty placeholder).
- **Related** — RFCs/tasks/sibling ADRs, or leave empty.

## Step 8 — Write

Write the complete file to `<ADR_DIR>/<id>-<slug>.md`.

## Step 9 — Supersession (if any)

If superseding `<old-id>`: locate `<ADR_DIR>/<old-id>-*.md` and update **only** its `Status` → `Superseded`
and `Superseded by` → this id. Touch nothing else — an accepted ADR's body is immutable; that chain is the
project's decision history.

## Checklist

- [ ] File at `<ADR_DIR>/<id>-<slug>.md`; id follows the repo's scheme (from `<ADR_DIR>/AGENTS.md` or NNNN)
- [ ] License block (if the template has one) intact; all guidance comments removed
- [ ] `Status`, `Date` (from `date`), `Deciders` set; `Supersedes` present only when superseding; `Superseded by` removed
- [ ] Context · Decision · Options considered · Consequences · Related all present
- [ ] Options: ≥1 rejected with reason; chosen marked `(chosen)`
- [ ] `Sunset & reversal` present only if the decision expires
- [ ] If superseding: old ADR `Status`/`Superseded by` updated, body untouched
- [ ] No template/placeholder text left in the body
- [ ] Content written in English
