# How to write a gate that reads document structure

A gate is one detector: it finds one kind of wrong and knows nothing else. This walks a new one from empty
folder to composed and running, and names the four traps that fail *silently* — a wrong answer that looks
plausible, rather than a crash.

The API is [`cli/packages/core/README.md`](../../cli/packages/core/README.md#the-document-model); the
reasoning is [the document model](../explanation/the-document-model.md). Neither is repeated here.

## 1. Name the failure, not the check

The gate id and its findings' `rule` name **what goes wrong** — `unresolved-link`, `machine-path` — never
the tool that catches it. Two tests: could an unrelated second check witness the same thing (then the name
is at the right level), and does the name survive replacing the implementation (`markdown-lint` does not).

## 2. Create the folder

One folder per gate under [`cli/packages/gates/src/`](../../cli/packages/gates/src/), holding an
`index.ts` that default-exports `defineGate`. There is no registry to add it to — a bare name resolves to
`@entelekheia/vibe-ops-gates/<name>` by convention.

```ts
import { defineGate, lineAt, walkLayersWithHostPositions } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";

export default defineGate(
  {
    id: "my-gate",
    summary: "One line, shown by --list",
    defaultPaths: ["**/*.md"],   // a default, never a constraint — an ops may override it
  },
  async ({ files, documents }) => {
    const findings: GateFinding[] = [];
    let examined = 0;
    // …
    return { findings, examined };
  },
);
```

Declare `fixable: true` and pass a `fix()` third argument **together or not at all** — `defineGate` throws
on either alone, because a gate that declares repair capability nothing backs, or writes a `fix()` nothing
calls, is wrong in a way no test would notice.

## 3. Read the document

```ts
for (const file of files) {
  const document = documents.get(file);
  if (document.tree === undefined) continue;   // trap 1
  examined++;
  // …
}
```

Then reach for what you need — and **the two places are not interchangeable**:

```ts
// Block structure: a heading, a table, a fenced block.
const tables = document.tree.rootNode.descendantsOfType("pipe_table");

// Inline structure: a link, an image, a code span.
for (const { layer, hostStart } of walkLayersWithHostPositions(document.layers)) {
  if (layer.languageId !== "text.markdown_inline") continue;
  for (const node of layer.tree.rootNode.descendantsOfType("inline_link")) {
    const line = lineAt(document.text, hostStart + node.startIndex);   // trap 3
    findings.push({ rule: "my-gate", file, line, evidence: `…${node.text}` });
  }
}
```

## 4. Test it against a fixture *and* against this repository

A fixture proves each failure mode fires in isolation; the real corpus proves the gate survives content
nobody designed for it. Both matter, and the second is where every false positive so far has been found —
a fixture only contains what its author already thought of.

Assert against the real checkout the way
[`record-header.test.ts`](../../cli/packages/gates/test/record-header.test.ts) does, and **do not
pre-filter the file list by hand**. A probe that filters what the gate does not is how two gates shipped
with 14 false findings between them: the harness produced the clean result, not the gate.

## 5. Compose it

A gate does nothing until an ops names it. Add an entry to the relevant `cli/packages/ops-*/src/index.ts`,
and if the gate takes `options`, pass them there:

```ts
{ gate: "my-gate", paths: ["project/**/*.md"], emits: true }
```

**Emit only what recurs.** A structural property — a file has a sibling or it does not — stays fixed once
corrected, and a series of zeros about it is one nobody reads. A behavioural, recurrent property is worth
a reading.

If one gate is composed under several entries, give each a `label` — and make the finding's `rule`
distinguish them too (`record-header-adr`, not a bare `record-header`). The `ok` and `SKIP` lines print the
label, but the `FAIL` line prints `rule`, so four entries sharing one `rule` produce four identical and
unattributable failures.

## The four silent traps

| # | Trap | What it looks like | What to do |
|---|---|---|---|
| 1 | Counting an unparsed file | A file with no grammar, or unreadable, inflates `examined` and reports clean | `if (document.tree === undefined) continue;` **before** `examined++`; `document.uncovered` names why |
| 2 | Looking for inline nodes in the block tree | `descendantsOfType("inline_link")` on `document.tree.rootNode` returns `[]` — no error, no finding, green | Walk `document.layers`, filtered to `text.markdown_inline` |
| 3 | `startPosition.row` inside a layer | Layer-relative. Measured on this repo's first `cli/AGENTS.md` link: it reports **line 1**; the truth is **line 7** | `lineAt(document.text, hostStart + node.startIndex)` |
| 4 | Filtering the file list inside the gate | Works, then silently diverges from every other gate that forgot the same rule | Population is an ops's `ignore`/`disabled` config, never gate code |

Trap 4 is the one with a decision behind it
([ADR-0011](../../project/adr/0011-population-belongs-to-configuration-not-a-gate.md)): a gate that filters
its own files has taken back an opinion the split forbids it, and the rule then exists in as many copies as
there are gates that remembered it.

## Verify

```bash
npm run build
npm test
node cli/packages/cli/dist/bin.js <ops> --list      # the gate appears, with its paths
node cli/packages/cli/dist/bin.js <ops> --verbose   # examined > 0, and ignored is visible
```

`examined: 0` is not a pass — it means the paths matched nothing, and a gate that examined nothing has not
reported that nothing is wrong.
