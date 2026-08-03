# RFC — what only an RFC needs

An RFC asks *should we do X, and how?* — a proposal under discussion, not a decision (that is an ADR) and
not a build plan (that is a plan). The template's own comments specify each section; this file covers only
what they cannot.

## Numbering spans the archive

An RFC that reaches `Implemented` or `Rejected` moves into a subfolder and **keeps owning its number**. The
resolver already scans those subfolders for this reason. If you derive a number by hand from the authority
file instead, scan them too — a number freed by archiving is a collision waiting in the index.

## A new RFC is mostly empty, on purpose

Status is `Draft`. Write the **Summary** — one paragraph, plain terms, paraphrasing the proposal with no
invented technical detail — and leave every other section empty for the author.

Empty is not the same as placeheld: delete the template's guidance comments and leave the section blank
rather than writing "TBD" or a sketch of what might go there. A drafted-looking RFC invites review of
reasoning nobody has done yet.

**Open Questions** takes one bullet per unresolved point that surfaced while filling the repo-specific
sections below. If none surfaced, leave it empty.

## Repo-specific sections and follow-ups

`AUTHORITY` is where a repo declares what its RFCs carry beyond the template — a package-impact table, a
required reviewer set — and what must happen *after* the file is written, most often a row added to an
`INDEX.md`. Read it, fill what it names, and perform the follow-up. Skip silently if the repo defines none.

> **Effort seam.** If the authority file marks one of those sections as judgement-heavy and the session
> model is small, delegate just that section at higher effort:
> `Agent({ effort: "high", prompt: "<the repo's instruction for that section>\nRFC topic: <topic>" })`

## Checklist additions

- [ ] Heading is `# RFC-<id>: <Title>`; `Status: Draft`
- [ ] Summary written; every other section genuinely empty, with no placeholder prose
- [ ] Repo-specific sections filled and follow-ups performed per `AUTHORITY` — or none were required
- [ ] The number does not collide with an archived RFC in `implemented/` or `rejected/`
