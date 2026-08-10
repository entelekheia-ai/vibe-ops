// Plan-010's stated acceptance for Track 2: a fixture whose fenced block is in a language with no
// installed grammar reports `uncovered` for that span while the rest of the document reports normally.
// One fixture, every branch: yaml frontmatter (tier b, "yml" not matched by yaml's own regex), a fenced
// block in an installed language (the dynamic fence route, tier a), a fenced block in a language with no
// grammar (uncovered), and enough prose to force the inline hand-off (tier c, "markdown_inline") — whose
// own inline HTML tags recurse one level further and come back uncovered too, proving recursion actually
// ran rather than merely resolving depth 1. See project/tasks/002-the-injection-resolver.md, item 7.
//
// A table cell is added on top for Track 3's supplement query (project/tasks/003-…, item 1): the
// grammar's own injections.scm never hands a pipe_table_cell to the inline grammar, so a link written
// inside one is proof the supplement — not the declared query — is what delivered it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "../src/document.ts";
import type { Layer, UncoveredLayer } from "../src/injections.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-injections-"));
}

const FIXTURE = [
  "---",
  "title: fixture",
  "tags:",
  "  - one",
  "  - two",
  "---",
  "",
  "Some prose with <span>inline html</span> to force the inline hand-off.",
  "",
  "```markdown",
  "# nested",
  "inner text",
  "```",
  "",
  "```rust",
  "fn main() {}",
  "```",
  "",
  "| Field | Value |",
  "| --- | --- |",
  "| link | [table link](target.md) |",
  "",
].join("\n");

function find(layers: readonly Layer[], languageId: string): Layer | undefined {
  return layers.find((l) => l.languageId === languageId);
}

function findByOrigin(layers: readonly Layer[], languageId: string, origin: Layer["origin"]): Layer | undefined {
  return layers.find((l) => l.languageId === languageId && l.origin === origin);
}

function findUncovered(layers: readonly UncoveredLayer[], language: string): UncoveredLayer | undefined {
  return layers.find((l) => l.language === language);
}

test("Injections: frontmatter, an installed fence, an uncovered fence, and a recursed inline layer", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "fixture.md"), FIXTURE);

  const store = createDocumentStore(repoRoot);
  const document = store.get("fixture.md");

  assert.equal(document.uncovered, undefined, "the top-level markdown parse itself must not fail");
  assert.ok(document.tree !== undefined);

  // Frontmatter: "yml", not "yaml" — yaml's own injection-regex ("^yaml$") does not match "yml", so this
  // resolves only via the fileTypes tier (b). Proves tier b is load-bearing, not merely present.
  const frontmatter = find(document.layers, "source.yaml");
  assert.ok(frontmatter !== undefined, "frontmatter did not resolve to the yaml grammar");
  assert.equal(frontmatter.parentStart, 0);
  assert.equal(frontmatter.tree.rootNode.hasError, false);
  assert.equal(frontmatter.layers.length, 0, "yaml declares no injections of its own");

  // The dynamic fenced-block route: the fence's language comes from a captured node, not `#set!`, and
  // resolves via the regex tier (a) — markdown's own `injection-regex` is `^(markdown|md)$`.
  const fencedMarkdown = find(document.layers, "text.markdown");
  assert.ok(fencedMarkdown !== undefined, "the ```markdown fence did not resolve back to markdown");
  assert.equal(fencedMarkdown.tree.rootNode.type, "document", "recursion did not actually reparse the fence's content");
  assert.equal(fencedMarkdown.tree.rootNode.hasError, false);

  // A fenced block naming a language nothing here installs: recorded, not dropped.
  const rust = findUncovered(document.uncoveredLayers, "rust");
  assert.ok(rust !== undefined, "the ```rust fence should be uncovered, not silently absent");
  assert.equal(rust.reason, "no-grammar");

  // The inline hand-off: resolves only via the name tier (c) — markdown_inline has no file type and no
  // injection-regex of its own, only `markdown.inline.name === "markdown_inline"`. Delivered by the
  // grammar's OWN injections.scm — origin must be "declared", not the supplement.
  const inline = findByOrigin(document.layers, "text.markdown_inline", "declared");
  assert.ok(inline !== undefined, "the paragraph's inline content did not resolve to markdown_inline");
  assert.equal(inline.tree.rootNode.type, "inline");

  // The table cells: the grammar's own injections.scm names only `inline`, never `pipe_table_cell` —
  // every one of these layers exists ONLY because of this workspace's own supplement
  // (queries/injections/text.markdown.scm), one per cell (both header cells and the two data cells).
  // Their origin proves which query delivered them, and one of their parsed trees proves the link inside
  // the "link" cell actually resolved to an `inline_link`, not loose punctuation.
  const tableCells = document.layers.filter((l) => l.languageId === "text.markdown_inline" && l.origin === "supplemental");
  assert.ok(tableCells.length >= 4, `expected at least 4 supplemental table-cell layers, got ${tableCells.length}`);
  const cellWithLink = tableCells.find((l) => l.tree.rootNode.descendantsOfType("inline_link").length > 0);
  assert.ok(cellWithLink !== undefined, "no supplemental table-cell layer contained an inline_link");

  // Recursion, proven: the inline layer's own injections.scm names html for its <span> tags, and no
  // html grammar is installed here — those come back as this layer's OWN uncoveredLayers, one level
  // deeper than the document's. If recursion had stopped at depth 1, this array would be empty.
  assert.equal(inline.layers.length, 0, "no html grammar is installed — nothing should resolve");
  assert.equal(inline.uncoveredLayers.length, 2, "both the opening and closing <span> tags should be uncovered");
  for (const html of inline.uncoveredLayers) {
    assert.equal(html.language, "html");
    assert.equal(html.reason, "no-grammar");
  }
});
