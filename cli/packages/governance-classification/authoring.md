---
vibe-ops-reference: records/classification@1
---

# Classification — what only the policy needs

A classification is not a record: it is not numbered and there is one policy per repository. What this
package owns is `templates/classification.md` — the four levels, what each permits in a committed file,
and what each does to a finding.

## Declaring a rule

A rule is an entry in `ops-exposure`, and it names three things: the `level` of the material it
keeps out, the patterns that material takes, and the population it governs. Nothing else. How a finding
is reported follows from the level and is not the entry's to decide.

A pattern must reach the end of what it means. Evidence quotes the match, so one that stops a character
past its prefix names something nobody can act on.

## Choosing the level

Ask what happens if the finding itself is read by someone who should not have the material. At `secret`
the answer is that the leak has happened, so the finding names where and not what. Everywhere else,
seeing the text is how someone removes it.

`public` forbids nothing and is refused as a rule level. It is the level a repository is written AT, not
a level material is kept out at.

## Where the patterns live

Inline in the entry, except for a list whose entries are themselves the material — a deny-list of private
names is `secret`, and writing it into a composition to search for it would commit the thing being kept
out. That list arrives as a path (`options.forbidFrom`, or `VIBE_OPS_DENYLIST`) and never as data of this
package. A list that is named and cannot be read is an error, never a clean sweep.
