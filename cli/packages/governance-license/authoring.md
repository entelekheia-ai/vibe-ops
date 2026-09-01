---
vibe-ops-reference: records/license@1
---

# Licence — what only a licence needs

A licence is not a record: it is not numbered, it carries no header table and no frontmatter, and a
repository holds exactly one. What this package owns is the set of texts and the registry that pins each
to the source it was published at.

## The texts are verbatim, and that is the whole point

A licence handed to another repository must be the licence, byte for byte. A paraphrase reads as
legal-sounding prose and is wrong in the operative clauses, and nobody re-reads a LICENSE — so the only
thing standing between a paraphrase and every repository the skill touches is the pin.

`templates/SOURCES.tsv` is that anchor: one row per licence id, carrying the URL it was published at and
the sha256 of the file as published. `ops-mirror`'s `license-text` entry hashes each shipped text and
holds it against its pinned column, which is why the comparison needs no second copy of the text.

## Choosing one

The choice belongs to the repository and is never inferred from what a sibling uses. `/vibe-ops:license-setup`
asks, and records the answer in the target's own `AGENTS.md` so the next contributor is not asked again.

A fork carries two attributions and needs both: the upstream licence as it stands, and a `NOTICE` naming
what was derived from where. Neither may be replaced by the other.

## What never goes in a shipped text

A copyright line naming a person. A template is copied into somebody else's repository, so an attribution
inside one credits this plugin's author for work that is not theirs — invisible, because the file reads
correctly in the repository that ships it. The placeholder stays a placeholder;
`ops-classification`'s `template-attribution` rule is the guard.
