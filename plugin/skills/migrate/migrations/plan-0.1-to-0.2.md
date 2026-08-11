# plan 0.1 → 0.2 — the plan becomes an epic

## What changed in the template

| Section | 0.1 | 0.2 |
|---|---|---|
| `## Progress` | step-level checklist, the only mandatory one | **dropped** |
| `## Tracks` | prose only | prose **plus one checkbox per track** — the plan's only checklist |
| `## Surprises & Discoveries` | living section | **dropped** |
| `## Decision Log` | "every decision, including small ones" | unchanged in shape, **narrowed in scope**: decisions only |
| Living sections | four | two — `Decision Log`, `Outcomes & Retrospective` |

The rule that decides every judgement call below: **the doing goes to the dossier, which is deleted at
closure; the design stays in the plan, which is permanent.**

## What it costs an existing artifact

### `## Progress` → `## Tracks`, or a task dossier

Split the existing checklist by grain:

- **A track-level item** — "Track 2 done" — becomes the checkbox on that track in `## Tracks`. Mechanical.
- **The `Run /vibe-ops:close-plan` item** moves to the end of the track list, keeping its checked state.
  Mechanical.
- **A step-level item** — anything finer than a track — has no home in 0.2 by design. It belongs to the
  task dossier that track spawns. **Needs a decision:** creating dossiers retroactively for finished work
  is usually waste, while an *unfinished* step is real state that must not evaporate. Report these; do not
  invent dossiers.
- **A dated item recording that something happened** is not progress, it is a working note. Route it with
  the `Surprises` rule below.

### `## Surprises & Discoveries` → routed, never deleted

This is the section that makes the migration dangerous: it is the largest in an old plan and every entry
is content someone wrote deliberately. **It is never deleted in place.** Each entry is routed by the three
questions the task template now carries:

1. Holds beyond this repository? → `project/learnings/`, via `/route-learnings`.
2. Can you name the file, folder or package where someone meets it again? → `project/log/`, and that answer
   is the entry's `path:` / `relatedTo:`.
3. A prescription for how an existing skill should behave? → edit that `SKILL.md`; mark the entry
   **discharged** with a pointer, rather than filing the prose a second time.
4. None of these? → dropped, deliberately and out loud. An entry too large to have a path is usually a
   decision (an ADR) rather than a trap.

**All of this needs a decision, per entry.** This migration performs none of it. Its job here is to report
the count and stop — a plan whose `Surprises` section is not empty **stays at 0.1**.

### `## Decision Log` — narrowed, not dropped

An entry that records *what happened* rather than *what was decided* now belongs in a task dossier, and
is routed by the same three questions. **Needs a decision** per entry; when in doubt leave it, because a
decision misfiled as a note is recoverable and the reverse is not.

## Mechanical vs. needs a decision

| Mechanical — apply it | Needs a decision — report it |
|---|---|
| Add the `plan@0.2` stamp above the H1 | Every `Surprises & Discoveries` entry |
| Track-level `Progress` items → track checkboxes | Step-level `Progress` items that are still open |
| The `close plan` checkbox → end of the track list | `Decision Log` entries that are not decisions |
| Delete `## Progress` **once it is empty** | — |
| Delete `## Surprises & Discoveries` **once it is empty** | — |

## Done looks like

- The stamp reads `plan@0.2`.
- No `## Progress` and no `## Surprises & Discoveries` heading remains.
- `## Tracks` carries one checkbox per track, plus the `close plan` box last, and no finer granularity.
- The living-sections block contains exactly `Decision Log` and `Outcomes & Retrospective`.
- Nothing that was in the file is gone without a named destination.
