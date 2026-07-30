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

## A map, not a narrative

One line per entry, pointing at the project's own source-of-truth document instead of restating it.
Duplicated detail drifts, and the duplicate is always the copy that goes stale. Never narrate history — why
a thing came to be belongs in an ADR or a log, not in the map a newcomer reads first.

## Budget

**Aim for 150 lines** in any always-on document, and treat the number as a correctness measure rather than
a cost measure. The always-on block passes through a relevance gate *as a whole*
([evidence](../project/research/context-file-practices.md)), so padding does not merely cost tokens — it
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

Nothing written into a committed file may reference personal-memory slugs (`[[…]]`, `feedback_…`,
`project_…`), a parent workspace, a sibling repository, machine paths, or anything private. Put the actual
fact in the file. The link is one-directional: personal notes may point at a repository file; a repository
file never points back.

This includes **negative** checks — a validation command that spells out private names in order to grep for
them has already leaked them. Keep the pattern in the validator script, not in the prose.
