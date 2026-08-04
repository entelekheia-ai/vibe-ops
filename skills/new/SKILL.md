---
name: new
description: 'Create one governance record from the repo''s own template and numbering: an ADR (decision record), RFC (design proposal), plan (implementation design with tracks), or task (issue-linked dossier). Use when asked to record a decision, propose a design, plan implementation work, break work into tracks, open a work item, or "/new <type> <topic>". Reads the repo''s own lifecycle.'
argument-hint: "<adr|rfc|plan|task> <topic>"
effort: inherit
---

# /new — Create one governance record

Four record types, one command. Which one to write is a real question, and the wrong answer is expensive:

| Type | Answers | Lifecycle |
|---|---|---|
| `adr` | *what did we decide, and why?* | immutable once accepted; superseded, never edited |
| `rfc` | *should we do X, and how?* | Draft → Accepted → Implemented (frozen) |
| `plan` | *how do we build X?* | permanent design record; the file is never deleted |
| `task` | *what is being worked on right now?* | ephemeral; the dossier is deleted at closure |

If the user did not say which, ask — do not infer from the topic. A misfiled record is worse than a
missing one, because the lifecycle attached to it is wrong from the start.

**This is an event skill** ([why that matters](../../references/convergence-policy.md)). It records that
something happened at a point in time. Running it twice correctly produces two records; it has no update
mode. An existing record is advanced through its own lifecycle, never re-scaffolded.

---

## Step 0 — Resolve the repo, in one call

```bash
sh "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-governance.sh" <type>
```

It prints where records of that type live, which template governs them, which file is the numbering
authority, how many exist, what number comes next — and then **the rules for that record type**, which are
the second half of this skill. Read them; they are not repeated here.

Add `--with-template` to get the template's contents in the same call when you are about to write
immediately.

What the output means:

- `DIR=(none)` — this repo keeps no records of that type. Ask whether to create the directory; do not
  create it silently. The default is the `project/<kind>/` layout `/vibe-ops:repo-setup` scaffolds.
- `TPL=(none)` — **stop and ask.** Never invent a structure. Offer to copy the matching template from
  `${CLAUDE_PLUGIN_ROOT}/skills/repo-setup/templates/project/templates/`.
- `AUTHORITY=` — the file that overrides this skill on numbering and lifecycle. When it is a path (rather
  than `(default)`), **read it and follow it** over anything here: older repos tie ids to a release train,
  or require follow-ups like an `INDEX.md` row.
- `NEXT=(unknown …)` — records exist but none is numbered the way the resolver understands. That is the
  signal to read `AUTHORITY` and derive the id its way, not to start over at 1.

## Step 1 — Collect what the record needs

**Topic** — from the command argument, else ask for a short phrase. **Author** — `git config user.name`,
asking only if empty. **Date** — `date +%Y-%m-%d`, never guessed.

Each type asks for one more thing (a supersession, an issue, a source document to migrate). The rules
printed in Step 0 say which. Do not proceed until you have it.

## Step 2 — Name the file

Slug is lowercase and hyphen-separated. The filename pattern comes from the type's rules — three of the
four are `<DIR>/<number>-<slug>.md`, and `task` is not always.

## Step 3 — Read the template

Read `TPL`. **Never reproduce a template's structure from memory** — the file is the single source of
truth for section order, formatting, and any license block. It is also where the guidance lives: most of a
template is HTML comments explaining what each section is for, and those comments are the specification
for filling it. This skill deliberately does not restate them.

## Step 4 — Fill it

Starting from the exact template content, and **writing every section in English regardless of the
conversation's language** — that is a product guarantee of this plugin, not a preference.

- Keep any license comment block at the top unchanged.
- Delete the template's guidance HTML comments.
- Delete optional metadata rows (`Depends on`, `Related`, `Tracking issue`) unless they are really
  populated. Never invent an issue number.
- **Where there is no material for a section, leave the template's stub or a short italic note.** A section
  that looks filled but was fabricated misrepresents how settled the record is, and it is the failure a
  small model reaches for first. This applies hardest to success criteria, tracks and options considered.

## Step 5 — Write, then do the type's follow-ups

Write the file. Then whatever the type's rules require afterwards — updating a superseded record, adding
an `INDEX.md` row the authority file asks for, stating a maintenance contract. Those are in the rules from
Step 0.

Do not create an index file unless the repo's own `AGENTS.md` asks for one: an uninstructed index is an
artifact nobody keeps updated.

## Confirming before you write

This skill is model-invocable, so it may fire when the user asked for something adjacent rather than for a
record. Creating a governance record is not reversible in the way an edit is — a number is consumed and,
for an ADR, immutability attaches immediately. **State the type, the path and the number, and get
agreement before writing.**

## Checklist — verify before reporting done

- [ ] The type was chosen by the user, not inferred
- [ ] Step 0 ran once; `AUTHORITY` was read and followed when it was a path
- [ ] File at the path the type's rules specify; the id follows this repo's scheme
- [ ] License block (if the template has one) intact; every guidance comment removed
- [ ] Metadata complete: status, date from `date`, author; unpopulated rows deleted; no invented issue
- [ ] Every section from the template present
- [ ] Sections with no source material left as honest stubs, not invented
- [ ] Content written in English
- [ ] No index file created unless the repo asked for one
- [ ] The type's own follow-ups from Step 5 done
