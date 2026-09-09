## project/ governance — lifecycles

The **what and why** of each artifact type lives in [`../../GOVERNANCE.md`](../../GOVERNANCE.md) (the
human-facing doc). This rule is the **operational detail** for working inside `project/` — load it only
when a file under here is in context.

**Numbering is per repository.** Monotonic and never renumbered *within this repo* — not across a
workspace, an organization, or a family of related repos. Two repositories both holding an `ADR-0001` is
normal and costs nothing, because a cross-repo reference is a full URL and a local one names a file. A
number freed by moving a document to another repository is free again here. **Never skip a number to
avoid the appearance of a collision**: it leaves a permanent gap explained by nothing.

**The version lives in the frontmatter; the header table is presentation.** Every record opens with
`vibe-ops-template: <type>@<integer>` at offset 0, and that is what `/vibe-ops:migrate` and every
version-aware verb read. The integer moves only when an artifact written against it would now be shaped
differently — a different number from any package's semver, which answers a different question. The
`| Field | Value |` table below it renders for a human and for a markdown preview; **never move the
version into it, and never keep a second copy anywhere.** A record declaring no version is reported as
*unknown*, never resolved to the oldest known shape.

**When a record migrates is a policy, not a campaign** (maintainer decision, 2026-08-22). A record with a
terminal status — a shipped plan, an implemented or rejected RFC, anything in an archival directory —
**MUST** keep the shape it was written in: the delivered corpus only grows, so migrating it is an eternal
treadmill, and the sections an old shape carried are part of what that record was. A **living** record
**SHOULD** be migrated opportunistically, at the moment it is already being edited — the
`template-version-behind` warning on an open record is that trigger, and it goes silent when the record
reaches its archival directory. The exception: a record about to be closed **MAY** ship at its old shape
when migrating it would entangle two ceremonies. A corpus-wide migration pass **MUST NOT** be run.

**A migration note that changes a template's sections MUST also state what a document *describing* that
shape now says.** The records are not the only population, and `template-heading-drift` reads the note to
fail any document asserting a record carries a section its template no longer has, or stating the wrong
count of living ones.

**A rule, a reference or a skill MUST describe the present**, leaving what a template no longer has to the
migration note — the one document whose subject is a change. An absence **MUST** be written as what the
record does carry rather than as the name of the section that left.
