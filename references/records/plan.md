# Plan — what only a plan needs

A plan answers *how do we build X?* and is **permanent**: it stays as the design record after the work
ships. The template's own comments specify each section, including the four living sections and why they
are maintained during the work rather than written at the end. This file covers only what they cannot.

Status starts at `Backlog`.

## Migrating an existing document

A plan is often not written from nothing — a briefing, an RFC, or an older plan format is being converted.
That case has its own rules, and getting them wrong destroys the source:

- **Preserve all existing content.** Extract text as-is. Do not invent, simplify, or rewrite.
- **Reorganise by section.** Decisions found in the source belong in `Decision Log`; anything the source
  records as a surprise, a dead end, or a wrong assumption belongs in `Surprises & Discoveries`. Open
  questions and closed decisions move intact, with their rationale.
- **When the source is a file on disk, move its bytes rather than retyping them** — copy the file and edit
  in place. Retyping a long document into a tool call is where content silently changes.
- **A section with no source content stays a stub**, or carries a short italic note such as *"Not yet
  defined — pending further exploration."* This applies hardest to **Success criteria** and **Tracks**,
  the two that most invite invented specifics.
- **If the source carries a caveat about being incomplete or not yet actionable** — "this is a briefing,
  not an executable plan" — preserve it as a callout right after the metadata table. Silently upgrading a
  document's status to look more finished than it is, is the failure this rule exists to prevent.
- **External references use full URLs**, never relative paths: a relative path into another repository
  dangles for anyone who clones this one alone. Internal references stay relative.

Do not fill any section from inference. A brand-new plan legitimately has an empty `Progress` and no
surprises yet.

## After writing — hand off the maintenance contract

State this in the report, plainly. It is the part most likely to be dropped, and a plan that loses it
becomes a document rather than an instrument:

- `Progress` is updated at **every stopping point**, not at the end.
- A non-obvious discovery goes into `Surprises & Discoveries` **when found**, with its evidence, while the
  evidence is still at hand.
- A decision goes into `Decision Log` when made; if it is hard to reverse, also write an ADR and link it.
- `Status` moves `Backlog → In Progress → Shipped`. The file is never deleted — it is the record.
- At closure, `/vibe-ops:close-plan` writes the retrospective against these goals and routes every
  `Surprises & Discoveries` entry into the repo's durable knowledge. **Never re-run `/new` on an existing
  plan** — edit it in place.

## Checklist additions

- [ ] Heading is `# Plan-<id>: <Title>`; `Status: Backlog`
- [ ] All four living sections present, with their format examples intact so the shape is obvious when the
      first real entry is added
- [ ] If migrating: all source content preserved as-is; decisions landed in `Decision Log`, surprises in
      `Surprises & Discoveries`; sections without source material left as honest stubs; any
      incompleteness caveat preserved; external refs are full URLs
- [ ] The maintenance contract was stated in the report, not assumed
