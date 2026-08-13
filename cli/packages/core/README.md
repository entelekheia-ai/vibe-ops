# @entelekheia/vibe-ops-core

The contract every [vibe-ops](../../README.md) module implements, plus the two things a module must not
each solve its own way: where configuration comes from, and how an observation is recorded.

## `defineModule(definition, run)`

Returns the `{ definition, run }` pair the CLI and the MCP server both load. The `definition` is read by
every surface — `--help`, flag parsing, the MCP tool schema — so a module describes itself once.

```ts
import { defineModule } from "@entelekheia/vibe-ops-core";

export default defineModule(
  { id: "thing", version: "0.1.0", summary: "One line", flags: [] },
  async (context) => ({ code: 0, summary: "what happened" }),
);
```

Validated at definition time, because each of these fails silently otherwise: an id that is not lowercase
and hyphenated, an empty `summary` (invisible in `--help` and in MCP), a flag declared twice.

## `loadConfig(start)`

Finds `vibeops.config.ts` from `start` upward to the home directory, nearest key winning, `settings`
merged one level deep so one repo's override does not discard another module's settings. A file with no
default export is an error, never a silent skip.

## `createEmitter(options)`

Appends JSONL observations. **A producer records what was observed and never scores, ranks or grades it** —
there is no `severity`, `pass` or `score` field, deliberately, because thresholds belong to the consuming
product. Emitting an id the module does not declare throws, so the definition and the code cannot
disagree in silence.

## `defineGate(definition, run, fix?)` and `defineOps(definition)`

A **gate** is one detector and nothing else — it does not know which repository it is in, which paths it
was handed, or whether anything downstream records what it finds. An **ops** is a named composition of
gates over declared paths that decides which of them emit, and it *is* a module, so dispatch, MCP and the
config cascade learn no second concept. The split is [RFC-0001](../../../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md);
what each one owns is in [`cli/AGENTS.md`](../../AGENTS.md#gates-and-ops) and is not repeated here.

Two agreements are enforced at definition time rather than discovered at runtime: `fixable: true` and a
`fix()` argument must both be present or both absent, and an ops entry declaring `emits` on a gate whose
id is not knowable before it loads must carry a `label`.

**Population is configuration, never gate code** ([ADR-0011](../../../project/adr/0011-population-belongs-to-configuration-not-a-gate.md)).
`defineOps` reads `ignore` and `disabled` from the ops's own `settings` slice and applies them itself, so
a gate must never filter its own files by a repository-specific rule.

## The document model

`GateRunContext.documents` is a lazy, per-run store: three gates over the same file parse it once, and a
run that never calls `.get()` (`--list`, `--help`) parses nothing. A gate reads structure from it instead
of opening the file and writing its own regular expression.

```ts
const document = documents.get(file);
if (document.tree === undefined) continue;   // no grammar, or unreadable — see below
examined++;
```

**`tree === undefined` is not an error and must not be counted.** It means no grammar covers the
extension, or the file could not be read; `document.uncovered` names which. A file that was never parsed
must stay out of `examined`, because "nothing examined" and "nothing wrong" are indistinguishable in a
record and only the second is a reading.

### Two places to look, and they are not interchangeable

A markdown document is parsed by two grammars, and which one holds what a gate wants decides how it is
reached:

| What you want | Where it is | How to reach it |
|---|---|---|
| A heading, a table, a fenced block | the **block** tree | `document.tree.rootNode` |
| A link, an image, a code span, emphasis | an **inline** layer | `walkLayersWithHostPositions(document.layers)`, filtered to `layer.languageId === "text.markdown_inline"` |

Inline content is reached through layers rather than the block tree because markdown's block-to-inline
hand-off **is itself an injection** — the same mechanism that delivers a YAML frontmatter block or a
fenced block in another language. A gate that walks only `document.tree.rootNode` looking for an
`inline_link` finds nothing and reports clean.

**Some layers come from a supplementary query, not from the grammar.** Markdown's own `injections.scm`
hands over a paragraph's content but never a table cell's, so `queries/injections/text.markdown.scm`
supplements it — without that, anything written inside a table cell reaches no inline layer at all.
`Layer.origin` distinguishes `"declared"` from `"supplemental"`; usually it does not matter and both
should be walked. Why it is a separate query rather than a patched grammar:
[ADR-0010](../../../project/adr/0010-supplement-injection-queries-not-a-branch-per-grammar-gap.md).

### Telling prose from code without walking node types

`proseText(document)` returns `document.text` with everything **except** inline prose blanked to spaces —
a fenced block, frontmatter, an HTML block, and, within what remains, the interior of every inline
`code_span`. The result is the **same length** as `document.text`, so a match index against it is a valid
argument to `lineAt(document.text, index)` directly, with no offset arithmetic at the call site.

It exists because walking node types is not enough to tell prose from code: `[[a-slug]]` inside a code
span never becomes a `text` node under the inline grammar at all — it parses as
`(shortcut_link (link_text))`, and that node's own `.text` is `[a-slug]`, one bracket pair, so a pattern
written against plain text matches it whether or not the surrounding syntax was code. Masking the source
string first and matching the mask sidesteps the question. A fenced code block needs no separate handling
for the same reason `hostEnd` needs none: markdown never injects one as a `text.markdown_inline` layer, so
it is never copied into the buffer to begin with.

Use it for "does this document's real prose say X", never for "does this document exist and parse" — a
gate reading structure (a link, a header table, a frontmatter key) still reads the layer or the block tree
directly, per the table above.

### Positions: always `lineAt`, never `startPosition.row`

```ts
const line = lineAt(document.text, hostStart + node.startIndex);
```

**A node's `startPosition.row` inside an injected layer is relative to that layer, not to the file.**
Measured against `cli/AGENTS.md`'s first link: `startPosition.row + 1` gives **1**, the true line is
**7**. The wrong answer is a plausible line number rather than a crash, so it fails silently and a reader
is sent to the wrong place.

`hostStart` comes from `walkLayersWithHostPositions`, which accumulates each ancestor's offset on the way
down. Offsets compose by **plain addition** because `startIndex` is a JavaScript string index — the same
unit `text.slice` uses — not a UTF-8 byte offset. Verified against a fixture carrying an em-dash and an
emoji: `startIndex` 39, `text.indexOf` 39, byte offset 43. Reading a node from the block tree needs no
`hostStart` (it is already host-absolute), but `lineAt(document.text, node.startIndex)` is still the
correct call, and keeping one idiom for both is why every gate uses it.

### Editing: splice a node's own span, and its span includes its padding

Rewriting through the tree means replacing `[node.startIndex, node.endIndex)` rather than substituting
over the text — which is what keeps an edit from catching a second thing that merely looks the same on
that line.

**A node's span often includes surrounding whitespace, and you have to look rather than assume.** Measured
on `| Status | Shipped |`: the `pipe_table_cell` node's text is `"Shipped "`, trailing space and all, so
splicing `" ${value} "` produces `|  Shipped |`. Carry the original padding over instead — it is also what
keeps a table someone aligned by hand aligned, and keeps the diff to the thing that changed.

Apply splices **back to front** when there is more than one, so an earlier replacement cannot invalidate a
later offset.

### A named language with no grammar is uncovered, never clean

`document.uncoveredLayers` (and `Layer.uncoveredLayers`, one level in) carries every region whose language
was named but had no installed grammar, or that hit the recursion depth bound. Markdown's inline grammar
injects `html` and `latex`, neither installed here, so this is populated on ordinary documents. A gate
whose correctness depends on having read a region must consult it rather than treating absence as
absence-of-problems.
