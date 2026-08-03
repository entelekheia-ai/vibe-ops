# ADR — what only an ADR needs

An ADR records *what we decided and why*. **One decision per record.** The template's own comments specify
each section; this file covers only what they cannot.

## Before writing

Ask two things, and do not proceed without both:

1. **The decision**, as a short noun phrase — this becomes the heading.
2. **Supersession** — *"Does this ADR supersede an existing one? If yes, which id?"* Record the id, or none.

## Status

Default **`Accepted`** — most ADRs record a decision already made. Use `Proposed` only when the user says
it is being circulated for ratification first. If unclear, ask, and default to `Accepted`.

## The section that carries the value

**Options considered** is the judgement-intensive part and the reason an ADR is worth writing: enumerate
realistic alternatives *including the rejected ones*, with honest trade-offs, mark the chosen one
`(chosen)`, and include at least one rejected option with its reason. An ADR whose alternatives are
strawmen records nothing a reader could not have guessed.

> **Effort seam.** If the session model is small or the decision is non-trivial, delegate just this section
> at higher effort and paste the result back:
> `Agent({ effort: "high", prompt: "Decision: <decision>\nContext: <context>\n\nList 3–4 plausible options incl. the chosen one; for each a label, a one-line pro/con, chosen or rejected+why. Markdown bullets: **Option X — label** — trade-off." })`

**Sunset & reversal** is included **only if** the decision is expected to expire — a stopgap, a bet on a
version. Then it carries *when to revisit* and *how to unwind*. Otherwise remove the section entirely
rather than leaving an empty placeholder.

## After writing — the supersession update

If this ADR supersedes `<old-id>`, open `<DIR>/<old-id>-*.md` and change **only** its `Status` to
`Superseded` and its `Superseded by` to this id.

**Touch nothing else.** An accepted ADR's body is immutable, and that chain is the project's decision
history: a decision is changed by writing a new record that supersedes the old one, never by editing what
was decided. Deleting an ADR is never correct.

## Checklist additions

- [ ] `Supersedes` row present only when superseding; `Superseded by` row removed (it is filled later, by
      the record that supersedes this one)
- [ ] Options considered: at least one rejected with a reason; the chosen one marked `(chosen)`
- [ ] `Sunset & reversal` present only if the decision is expected to expire
- [ ] If superseding: the old ADR's `Status` and `Superseded by` updated, its body untouched
