---
vibe-ops-reference: exposure-contract@1
---

# Exposure contract — what a record may carry into a repository

Applies to everything this plugin writes into a target repository — ADRs, RFCs, plans, task dossiers,
`AGENTS.md`, README — **and to the issue comments `close` posts**, which are the only surface that leaves
the repository altogether.

## The asymmetry this exists for

A record is written where the work happens and read where the repository ends up. Those are not the same
place, and the gap only widens:

- **A repository travels alone.** Someone clones it without the folder it sat next to and without the other
  repositories it was developed beside. A sentence that depends on that context does not become wrong — it
  becomes unreadable, and there is nobody left to ask.
- **A repository's visibility is decided later, in a hurry.** "Private today" is a state, not a property.
  Whoever flips it will not re-read forty governance records first.

So: **write every record as if the repository were already public and standing alone.** Apply this while
writing, not as a review pass afterwards — a published document that describes the private context which
produced it is not correctable by editing the file.

## What may cross, and what may not

| Material | In the record | Never |
|---|---|---|
| **Published sources** — papers, vendor docs, standards, other people's repositories | named and linked freely | — |
| **This repository's own paths, files, commands, issues, commits** | named freely; this is the repository describing itself | — |
| **Another repository, or the folder this one sits inside** | the *constraint* it imposes, stated as a fact about this repository — "the parser output feeds a downstream build that pins this exact shape" | its name, its location, its layout; "the workspace", "the sibling repo", "the umbrella" |
| **A machine path** — a home directory, a checkout location, a laptop's disk layout | never: use a repository-relative path, or say the tool derives it | `/Users/<someone>/…`, `/home/<someone>/…`, `C:\Users\…` |
| **Counts and inventories of things outside this repository** | quantified, never enumerated — "two of the repositories that consume this" | the list |
| **Private note identifiers** — personal-memory slugs, `[[…]]` links, ids in a tracker nobody else can open | the fact itself, written out in full | the pointer. Nobody else holds the note, and it dangles the moment the note is renamed |
| **Security posture** — what is unscanned, unpinned, over-permissioned, unpatched; which credential is in play | **nothing.** The general gap is publishable ("this class of dependency is rarely scanned"); this repository's standing in it is not | any form of it. Quantifying does not fix it — "a dozen unpinned dependencies" is an invitation with a number attached |
| **The record's own provenance** — that a fuller private version exists, who asked for the work, which conversation produced it | **nothing.** A pointer to an unpublished companion is itself a disclosure, and it survives every rule aimed at findings | "the full analysis is recorded alongside this", "see the internal version" |
| **People and organizations** | those already public *in this repository* — commit authors, issue participants, the license holder | a client, an employer, an unannounced partner, anyone who has not put their own name here |

Two rules follow, and both are easy to get wrong:

- **Write the sentence from scratch; never redact one.** Redaction leaves the shape of what was removed —
  "the other repository that depends on this" tells a reader there is one and invites the guess. Restate
  the constraint as a property of *this* repository and the sentence stops pointing outward at all.
- **A number can identify as surely as a name.** "Two of nine" is arithmetic; a count so specific that only
  one candidate fits is a name with extra steps. Coarsen it when in doubt.

**Detail is not free in the other direction either.** Include a path, a version or a file name because a
reader would act differently for knowing it — never as evidence that the work was done.

## Where the excluded half goes

Nowhere in the repository. This contract removes material; it does not relocate it into a second committed
file, and a record that says "the rest is recorded elsewhere" has already broken the provenance row above.

The detail belongs in whatever the author keeps outside every repository. The link is **one-directional**: a
private note may name a repository file; a repository file never points back.

## Per artifact — where each one actually leaks

| Artifact | The section that leaks | Why |
|---|---|---|
| **Plan** | `Summary`, `Design`, `Decision Log` | They hold the *reason*, and a reason is often "because of what something outside this repository does". Write the constraint, drop the owner. `Success criteria` leaks machine paths instead, because that is where commands get pasted. |
| **Task** | the **issue**, more than the dossier | The dossier is deleted at closure; the issue comment is permanent and, on a public repository, world-readable the moment it is posted. `close`'s executive summary is subject to this contract in full — it is the most exposed thing either skill writes. |
| **ADR / RFC** | `Options considered`, `Consequences` | Rejecting an option invites explaining who else it would have affected. |
| **`AGENTS.md` / README** | the layout table, the "not obvious from the code" list | A line earns its place there by being non-obvious — which is exactly where outside context creeps in. |

## What is checked, and what cannot be

`check-agents-md.sh` catches three shapes mechanically, and only three: personal-memory slugs
(`memory-slugs`), machine paths (`machine-paths`), and names the operator supplies to the run
(`private-names`, which reports itself **skipped** rather than passed when it was given nothing to look
for — "no private name found" and "I was not asked to look for any" are different answers).

This includes **negative** references: a validation command written into a document that spells out the
private names it greps for has already leaked them. The pattern belongs in the guard script, never in prose.

Nothing catches a paraphrase. "The other repository that consumes this" passes every grep ever written, and
it is the most common form of this failure. The guards exist for the shapes a tired writer produces; the
contract is what has to be applied while the sentence is still being written.
