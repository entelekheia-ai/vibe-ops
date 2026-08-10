# task 0.1 → 0.2 — the dossier becomes where the doing is recorded

## What changed in the template

| Section | 0.1 | 0.2 |
|---|---|---|
| Header table | `Status`, `Created`, `Author`, `Issue` | **plus `Plan`** — the plan and track this dossier serves |
| `## Implementation order` | a plain code fence, `P0: …` | **a checkbox list** — the only place per-step progress lives |
| `## Surprises & Discoveries` | *"if the task came from a plan, keep the entries in the plan's own section instead of duplicating them here"* | **reversed** — entries stay here, always, and carry the three routing questions |

The reversal is the substantive change: working notes stay in the dossier, which is deleted at closure,
instead of going up into the plan, which is permanent.

## What it costs an existing artifact

### `## Implementation order` → checkboxes

The 0.1 fence is prose inside a code block:

```text
P0:  fix the resolver
P1:  update the docs
```

becomes:

```markdown
- [ ] P0 — fix the resolver
- [ ] P1 — update the docs
```

**Mechanical**, with one judgement inside it: the fence carried no state, so every converted line starts
unchecked. If the dossier's other sections show an item is already done, tick it — otherwise leave it
unchecked and let the next session correct it. **An unchecked box that is actually done is a small lie; a
checked box that is not done is a dangerous one.**

### Header gains `| Plan |`

Add the row when the dossier came from a plan, naming the plan file and the track it serves. Leave it out
otherwise — an empty row is worse than an absent one. **Mechanical** where the plan is named anywhere in
the dossier; **needs a decision** where it is not, because guessing the parent invents a link.

### `## Surprises & Discoveries` — nothing moves, the rule changes

No content migration. Entries already here stay here. What changed is where *future* entries go, and that
takes effect the moment the dossier is at 0.2.

**Do not go looking for entries that 0.1 pushed up into the parent plan and pull them back.** That is the
plan's own migration (`plan-0.1-to-0.2.md`), it routes each entry through the promotion test rather than
relocating it, and doing it from this side would move content into a file that is about to be deleted.

## Mechanical vs. needs a decision

| Mechanical — apply it | Needs a decision — report it |
|---|---|
| Add the `task@0.2` stamp above the H1 | Whether a converted step is already done |
| `Implementation order` fence → checkbox list | The `Plan` row when no parent is named in the file |
| Add `\| Plan \|` when the parent is named in the file | — |

## Done looks like

- The stamp reads `task@0.2`.
- `## Implementation order` is a checkbox list, not a fence.
- The `Plan` row is present and correct, or deliberately absent.
- `## Surprises & Discoveries` is byte-identical to before.

## Skip rule

**Skip any dossier already at `Done`** and report it as skipped for that reason — never as migrated. A
dossier is short-lived, so most of the population ages out rather than needing conversion, and converting
one that is about to be deleted is waste.
