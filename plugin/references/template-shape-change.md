---
vibe-ops-reference: template-shape-change@1
---

# A template's shape change has two populations

Changing what a template contains does not only affect the records written from it. It also falsifies
every sentence elsewhere that describes that template's shape — and those sentences stay readable as
authority for as long as nobody looks.

| Population | What it is | Who handles it |
|---|---|---|
| **The records** | Files written against the old template, carrying its structure | `/migrate`, one artifact at a time, from the note for each jump |
| **The descriptions** | Documents that say what shape a record has: governance docs, always-on rules, references, skills | The pass below, in the same run |

The second one has no version stamp, appears in no census, and cannot be found by reading the template.
It is not an afterthought to the first: **it is the half a reader acts on.** A record with an old heading
is one stale file; a reference saying records have that heading teaches everyone who reads it to write
one.

## Why a sweep by hand does not close it

Measured once and recorded as a trap. A template lost two sections; the template was edited, the note was
written, and the change was treated as complete. Four descriptions of the old shape were found two days
later, by looking. A sweep corrected one of them. Five more, two shipped into every repository the setup
skill scaffolds, were still standing eight days after that — and two agents auditing the repository read
them and reported the dropped sections as the current model.

**The count is what makes it invisible.** A description naming a section by name can be grepped for. A
description saying a record carries *four* living sections shares no token with anything that changed, so
it survives every search anyone thinks to run.

## The rule

- **A note that drops, renames or retypes a section MUST say what a document describing this shape now
  says instead.** The existing completeness rule — a dropped section with no stated destination is an
  unfinished note — extends from content to prose. "The living sections are now X and Y" is enough; a
  file list is not, because a file list is stale before the note is committed.
- **The descriptions are found by `template-heading-drift`, never by grep.** The gate reads the notes for
  what was dropped, the templates for what is live, and attributes each sentence to a record type before
  judging it — a heading dropped from one template may still be live in another, and a flat search
  accuses correct sentences about the type that kept it.
- **A sentence is rewritten to the current shape, or left and reported. Never deleted**, and never
  rewritten into a claim the note does not support. This is the same safety property that governs a
  dropped section's content, applied to the prose about it.
- **The pass is not done when the edits are made. It is done when the gate is clean**, and a second run
  finds nothing to do.

## What this means for a skill's own prose

A skill, a reference and a rule describe **the present**. Only a migration note discusses what a template
no longer has, because a note is the one document whose subject is a change.

So a sentence that explains an absence by naming the absent section — "a plan carries no `X`" — is doing
the note's job in the wrong file, and it goes stale in the same way for the same reason: the day `X` comes
back, or a second section leaves, the sentence is wrong and nothing says so. Write what the record **does**
carry. There is deliberately no waiver marker for this: a correct-but-flagged sentence is evidence that
the sentence should be rewritten, and an exemption is what gets used the next time somebody is in a hurry.
