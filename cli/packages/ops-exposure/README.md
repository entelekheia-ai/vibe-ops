# @entelekheia/vibe-ops-exposure

What a committed file may not carry, by the classification of the material.

```bash
vibe-ops exposure              # run it
vibe-ops exposure --list       # the rules composed, and the paths each runs over
vibe-ops exposure --self-test  # assert every rule still fires on its fixture
```

## The four levels

Each entry is one rule: a level, the patterns that level forbids, and the population it governs. The
level is not a label — it decides how a finding may speak.

| Level | The finding | Composed here as |
|---|---|---|
| `secret` | names **where** only | `private-name` — a name from a list that is never committed |
| `confidential` | quotes the **match** | `file-path`, `template-attribution` |
| `internal` | quotes the match | `memory-slug` |
| `public` | refused — nothing is forbidden at this level | — |

## The match, never the line

A gate is a pure detector and cannot see the rules another entry is running. A rule quoting whole lines
would eventually print a line that a stricter rule matched elsewhere, defeating the stricter level in a
repository where both were correctly declared. Quoting only the span that matched removes the possibility
rather than coordinating around it — and it names the thing to change instead of the sentence containing
it.

A pattern therefore has to reach the end of what it means: one that stops a character past its prefix
produces evidence nobody can act on.

## Two rules that need something the others do not

**`private-name`** takes its patterns from a file rather than from the entry. Spelling private names into
a composition in order to grep for them would commit the very thing being kept out, so the list arrives as
a path — `options.forbidFrom`, or `VIBE_OPS_DENYLIST` — and its content is never data of this package.
With no list supplied the rule reports `SKIP`, which stays distinguishable from "the list was read and
nothing matched". A list that is named and cannot be read throws.

**`memory-slug`** declares `scope: "prose"`, which masks fenced blocks and inline code spans. `[[…]]` is
also TOML and Wikitext, and syntax quoted as code is being shown rather than used.

## Why this is not part of `agents-md`

That ops reads the instruction surface and asks whether it is well formed. These entries ask a different
question of a different population — whether any committed file carries material its classification
forbids — and the populations only overlap by accident.
