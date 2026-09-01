# Information classification

Four levels, and what each permits in a file this repository commits. A rule declares the level of the
material it keeps out; the level is not a label, it decides how a finding may speak.

Read it with `vibe-ops records norm --type classification --facet template --print`.

## The levels

| Level | May appear in a committed file | Never |
|---|---|---|
| `public` | published sources, this repository's own paths, files, commands, issues and commits | — |
| `internal` | a sibling repository named, a count enumerated rather than coarsened | a pointer to a note nobody else holds; anything below |
| `confidential` | a client, an employer, an unannounced partner, named where they have named themselves | an absolute path from someone's machine; an attribution a target repository never made; anything below |
| `secret` | nothing | any credential; this repository's own security posture; any entry of a deny-list |

A level inherits every prohibition below it. `public` is the strictest reading of a document and the one
a repository should be written at by default: a repository's visibility is decided later, in a hurry, by
someone who will not re-read forty governance records first.

## What each level does to a finding

| Level | The finding |
|---|---|
| `secret` | names the file and line, and the entry that matched — never the text |
| `confidential` · `internal` | names the file and line, and quotes the **match** |
| `public` | forbids nothing, so a rule declared there is refused |

Every rule quotes the match rather than the line. A detector cannot see the rules another entry is
running, so a rule quoting whole lines would eventually print a line that a stricter rule matched
elsewhere — the stricter level defeated by the looser one in a repository where both were correctly
declared. Quoting the span removes the possibility, and names the thing to change rather than the
sentence containing it.

## Why `secret` material never reaches this file

A list of forbidden names, written down in order to search for them, has already leaked them. So the
patterns for a `secret` rule arrive as a path — `options.forbidFrom`, or `VIBE_OPS_DENYLIST` — composed
for the duration of one run and never committed anywhere. This package holds the policy; it never holds
what the policy keeps out. That asymmetry is what makes this document itself `public`.

## Two rules that follow, and are easy to get wrong

**Write the sentence from scratch; never redact one.** Redaction leaves the shape of what was removed —
"the other repository that depends on this" tells a reader there is one and invites the guess. Restate
the constraint as a property of *this* repository and the sentence stops pointing outward at all.

**A number can identify as surely as a name.** "Two of nine" is arithmetic; a count so specific that only
one candidate fits is a name with extra steps. Coarsen it when in doubt.

## What is checked, and what is not

The rules composed by `ops-exposure` cover the mechanically detectable part: a private name, an
absolute path from a machine, an attribution inside a shipped template, a pointer to a personal note.

The rest of this policy has no guard and is applied while writing — a sibling repository named, a security
posture disclosed, a count that identifies, a pointer to an unpublished companion. Those are the rows a
future rule fills, and until it exists, saying so here is the honest state.
