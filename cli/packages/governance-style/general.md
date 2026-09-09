---
vibe-ops-reference: authoring-style@2
---

# Authoring style — how a generated document is written

Applies to everything this plugin writes into a target repository. The rules below are the ones that
repeat across skills; anything specific to one artifact stays in that skill.

## Language

**Everything written into a target repository is in English**, regardless of the conversation's language.
This is a product guarantee, not a preference — a repository travels further than the conversation that
produced it.

## Prescriptive, not descriptive

An instruction file is read as guidance, so hedged prose reads as optional.

| Instead of | Write |
|---|---|
| "you should probably run the tests" | "run `npm test` before committing" |
| "the build is a bit unusual" | "`npm run build` writes to `dist/`; `tsc` alone produces nothing" |
| "we generally prefer X" | "use X; Y is present only in files predating <date>" |

Two properties make a line worth its space: it is **specific** (a command, a path, a name — not a
sentiment) and it is **falsifiable** (a reader can check it against the repo and find it wrong). A line
nobody can prove wrong is a line nobody can maintain.

## Direct and literal

Plain, literal language is an accessibility feature, not a stylistic preference: it keeps a document
readable for neurodivergent readers, non-native speakers, and anyone skimming under pressure — and
experts prefer it too
([NN/g](https://www.nngroup.com/articles/plain-language-experts/);
[W3C COGA](https://www.w3.org/TR/coga-usable/)).

- **State every claim positively, never as the negation of its opposite.** Litotes and
  negation-as-emphasis ("not optional", "no small task", a heading shaped "X is not Y") make the reader
  compute the assertion instead of reading it. Write "required", "a large task", "X becomes Z". Factual
  negation stays when the negation *is* the finding ("the endpoint does not support batch"). Double
  negatives are always out
  ([W3C COGA, Avoid Double Negatives](https://www.w3.org/TR/coga-usable/#avoid-double-negatives-or-nested-clauses-pattern)).
- **Literal over figurative.** Irony and sarcasm read as their surface meaning to part of every audience,
  and a committed document has no tone of voice to correct them
  ([W3C COGA, Use Literal Language](https://www.w3.org/TR/coga-usable/#use-literal-language-pattern)).
  One licensed exception: a light, pointed touch on a finding that is itself a reversal — a measurement
  contradicting its own documentation. The literal statement must still stand beside it, and the default
  count per document is zero.
- **Short sentences, one idea each, active voice.** Split anything past ~25 words with nested clauses.
- **Define or drop uncommon terms.** No invented vocabulary; an unavoidable coinage is defined at first
  use ([W3C COGA, Use Clear Words](https://www.w3.org/TR/coga-usable/#use-clear-words-pattern)).

## A map, not a narrative

One line per entry, pointing at the project's own source-of-truth document instead of restating it.
Duplicated detail drifts, and the duplicate is always the copy that goes stale. Never narrate history — why
a thing came to be belongs in an ADR or a log, not in the map a newcomer reads first.

## Budget

**Aim for 150 lines** in any always-on document, and treat the number as a correctness measure rather than
a cost measure. The always-on block passes through a relevance gate *as a whole*
([evidence](../../../project/research/context-file-practices.md)), so padding does not merely cost tokens — it
raises the chance the lines that mattered get discounted with it.

When the file is over budget, the fix is almost never compression. Ask what the content is:

| Symptom | Fix |
|---|---|
| A table restating what a generated file already contains | delete it; point at the generator's output |
| File-by-file or function-by-function description of the code | delete it; that is what reading the code is for |
| A multi-step procedure | move it to a skill, leave a one-line pointer |
| Rules that apply to one directory or file type | move to a path-scoped rule (`paths:`) |
| A rule a lint/type/test/hook could enforce | write the guard and delete the prose |
| Genuinely universal and still too long | this is the rare case where prose gets tightened |

**Moving content out beats reformatting it.** Measured on a real instruction block: converting a markdown
table to YAML saved ~9% of the block, because most of a table is the prose inside its cells and only about
a third is envelope. Moving the same content to an on-demand file and leaving a pointer saved ~35%. Format
is the weakest lever available and the only one that adds a second syntax to keep valid — so tables stay
markdown, and the answer to a long file is relocation.

## Diagrams

A diagram earns its place when the thing being described is a **flow with branches** — a state machine, a
review pipeline, a decision procedure — and prose would have to name the same node several times to
express it. It does not earn its place for a directory layout, a list, or anything with no branching.

Use ```mermaid fences; they render on GitHub and in most editors, and stay plain text in a diff. Keep the
diagram **beside** the prose rather than replacing it: research on procedural formats
([FlowBench, EMNLP 2024](https://arxiv.org/abs/2406.14884)) found flowcharts the best single format for a
model following a procedure, and combinations better than any format alone. The reader gets the shape from
the diagram and the detail from the text.

**A diagram is a duplicate like any other.** If the flow it draws also exists as a numbered list two lines
below, one of them will be wrong within a month. Draw it or write it — not both.

## Never leak private state

Nothing written into a committed file may carry a machine path, another repository's name, the folder this
one sits inside, a personal-memory slug, or a pointer to a private companion document. Put the actual fact
in the file instead. The link is one-directional: personal notes may point at a repository file; a
repository file never points back.

The same rule one level up: **never narrate the product's origin inside the product.** A skill that opens
with the private circumstances that produced it — "two repos in this workspace hand-rolled two license
schemes" — leaks nothing greppable and is still unreadable to anyone outside that workspace, stating as
this-product's-history what is a general failure mode. Describe the failure mode, not its instance.

That is the summary. The contract itself — what may cross, what the excluded half is written as instead,
which section of each artifact actually leaks, and which three shapes a guard catches — is the exposure
policy, `vibe-ops records norm --type classification --facet policy --name exposure --print`. It governs every record this plugin writes, not only the
documents this file covers, and it is applied **while writing**: a published document describing its own
private context cannot be fixed afterwards by editing the file.
