---
vibe-ops-reference: records/plan@1
---

# Plan — what only a plan needs

A plan answers *how do we build X?* and is **permanent**: it stays as the design record after the work
ships. The template's own comments specify each section, including the two living sections — `Decision
Log` and `Outcomes & Retrospective` — and why they are maintained during the work rather than written at
the end. This file covers only what they cannot.

Status starts at `Backlog`.

A `| Repository | <absolute path> |` row is optional and situational: only when the plan is being written
from a workspace root that is not the repository it belongs to (an umbrella over several independent
repos). `vibe-ops hook plan-context` (the UserPromptSubmit hook) requests it in exactly that case. It exists so an approved plan-mode plan
can be filed into its real repository's `project/plans/` automatically, rather than by a workspace's own
git toplevel — which, from an umbrella root, names the umbrella instead.

**That row is routing metadata, not part of the record**, and it is the one place a plan legitimately holds
an absolute machine path. `plan-approved-copy.sh` therefore *removes it* as it files the plan: the row has
done its whole job by then, and what it would otherwise leave behind is a laptop's directory layout in a
permanent, possibly public document. A plan written by hand carries the same obligation — delete the row
once the file is in place.

## Success criteria that survive contact

**A rename criterion phrased as "the old name appears nowhere" is almost always wrong.** A rename nobody
is told about is not finished, so the release note naming the old name is required output, and the grep
criterion then fails on the very file the rename obliges — allow exactly the announcement, and phrase the
criterion that way from the start. (Measured on this repository's own first retrofit, where the criterion
and the changelog it mandated contradicted each other within one track.)

## The exposure contract, and why a plan is the record most exposed to it

Everything in
[`${CLAUDE_PLUGIN_ROOT}/references/exposure-contract.md`](../../../plugin/references/exposure-contract.md) applies. Three
things make a plan the worst offender among the four types:

- **It is often written from outside the repository it belongs to** — the case the `Repository` row exists
  for. Whatever names the author had in front of them at that moment are the names that end up in `Context`.
- **It is permanent.** A task dossier is deleted at closure; a plan is kept precisely so someone can read it
  in a year. Anything that crosses, stays.
- **Its living sections are written under time pressure.** `Decision Log` and `Outcomes & Retrospective`
  are filled mid-work with the evidence at hand, which is exactly when a sibling repository gets named because
  naming it is the fastest way to finish the sentence. Write the constraint, drop the owner: "the consumer
  of this parser pins the current output shape" says everything the reader needs and refers to nobody.

**A plan's `Design` is the section that most often needs a diagram and most often ships without one.** It
describes a pipeline, a decision procedure, or a boundary something must not cross — all flows with
branches, which is exactly the test in
[`${CLAUDE_PLUGIN_ROOT}/references/authoring-style.md`](../../../plugin/references/authoring-style.md#diagrams). Draw it beside the
prose, not instead of it. The template says so in its own `Design` comment; this is the reminder for the
case where the comment was deleted before it was read.

## Migrating an existing document

A plan is often not written from nothing — a briefing, an RFC, or an older plan format is being converted.
That case has its own rules, and getting them wrong destroys the source:

- **Preserve all existing content.** Extract text as-is. Do not invent, simplify, or rewrite.
- **Reorganise by section.** Decisions found in the source belong in `Decision Log`; anything the source
  records as a surprise, a dead end, or a wrong assumption belongs to the task dossier the track spawns,
  which is where the working record of doing lives. Open questions and closed decisions move intact, with
  their rationale.
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
- **Migration is the highest-exposure moment this skill has.** The source was written somewhere with more
  context than the destination will ever have — a briefing drafted at a workspace root names the folders
  around it as a matter of course — and "preserve all existing content" carries every one of those names
  across unless someone stops it. Preserve the *content*; apply the exposure contract to the *references*.
  A sibling repository named in the source becomes the constraint it imposes; an absolute path becomes a
  repository-relative one; a pointer to the private original is dropped rather than rewritten, because a
  record that says "the fuller version lives elsewhere" has disclosed that it exists.

Do not fill any section from inference. A brand-new plan legitimately has an empty `Decision Log` and an
empty retrospective — nothing has been decided or learned yet.

## After writing — hand off the maintenance contract

State this in the report, plainly. It is the part most likely to be dropped, and a plan that loses it
becomes a document rather than an instrument:

- A decision goes into `Decision Log` when made, not at the end; if it is hard to reverse, also write an
  ADR and link it.
- A track's checkbox is ticked when that track lands. Anything finer — per-step progress, a discovery and
  its evidence — is recorded in the task dossier that track spawns, while the evidence is still at hand.
- `Status` moves `Backlog → In Progress → Shipped`. The file is never deleted — it is the record.
- At closure, `/vibe-ops:close-plan` writes the retrospective against these goals and runs the demotion
  check. **Never re-run `/new` on an existing plan** — edit it in place.

## Checklist additions

- [ ] Heading is `# Plan-<id>: <Title>`; `Status: Backlog`
- [ ] Both living sections present — `Decision Log` and `Outcomes & Retrospective` — with their format
      examples intact so the shape is obvious when the first real entry is added
- [ ] If migrating: all source content preserved as-is; decisions landed in `Decision Log`; a surprise has
      no home here and belongs to the task dossier the track spawns; sections without source material left
      as honest stubs; any incompleteness caveat preserved; external refs are full URLs
- [ ] Exposure contract applied to `Summary`, `Design` and `Decision Log`: nothing outside this repository
      is named, and no command pasted into `Success criteria` carries a machine path
- [ ] The `| Repository |` row is either genuinely needed *right now* by the filing step, or absent —
      never left behind in a filed plan
- [ ] The maintenance contract was stated in the report, not assumed
