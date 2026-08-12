---
vibe-ops-template: log@2
name: dropping-a-section-from-a-template
description: Removing two living sections from the plan template left four prose descriptions of the old
             shape standing — the template is the only copy a gate compares, so every sentence that
             describes it elsewhere goes stale silently and keeps being read as authority.
kind: trap
path:
  - "plugin/templates/*.md"
  - "plugin/references/**/*.md"
  - "GOVERNANCE.md"
attempted: 2026-08-12
source: Plan-012 Track 7
---

# Changing what a template contains, and expecting the prose about it to follow

> **Not current truth.** This records what was attempted on 2026-08-12 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

The plan template lost `Progress` and `Surprises & Discoveries` — a permanent file cannot discharge what
is written into it, so those two moved to the task dossier. The template was edited, a migration note was
written for the jump, and the change was treated as complete.

## What happened

Every prose description of the plan's shape stayed on the old text, and stayed readable as authority for
two days. Found by looking, not by any gate:

- `plugin/references/knowledge-lifecycle.md` — a four-row table titled *"A plan carries four living
  sections"*, one of whose rows named a section the template no longer has.
- `plugin/references/records/plan.md` — twice: the opening paragraph, and a checklist item reading
  *"All four living sections present"*, which a `/new plan` run would have been checked against.
- `GOVERNANCE.md` and its dogfooding twin under `plugin/skills/setup/templates/root/` — *"tracks, design,
  and the four living sections"*, shipped into every repository the setup skill scaffolds.

Four copies, two of them in files cited by name as authority by more than one skill, and one of them in a
document this repository ships to other people.

## The mechanism

A template is machine-comparable and its descriptions are not. `dogfooding-drift` compares the template
against its shipped twin byte for byte, and the migration note describes the jump — both fire on the
template itself. Nothing relates a template to the sentences *about* it, because that relation is
semantic: "four living sections" shares no token with the section headings it counts.

The count is what made it invisible. A description naming `Progress` would be findable by searching for
the section that left; a description saying *four* survives every search for anything that changed.

## What to do instead

When a template gains or loses a section, sweep for descriptions of its shape before considering the
change done — and search for the **count and the shape**, not only the section names:

```sh
git grep -niE 'living sections|four (living|sections)|all (four|three|two)' -- '*.md'
```

The same sweep applies to any file under `plugin/references/`, since those are cited as authority and a
stale one is followed rather than noticed.

No mechanical guard is known. A gate would have to relate a heading set to prose counting it, which is
not a comparison this repository's gates can express — the honest state is that this one is caught by
looking, and the trap is worth recording precisely because it is not caught by anything else.
