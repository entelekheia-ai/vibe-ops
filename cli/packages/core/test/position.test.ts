// project/tasks/003-the-inline-layer-gates.md, item 2: a layer's span, translated to the host
// document's own offsets, and a host offset turned into a 1-indexed line number. Both gates in that
// task depend on this, and neither can report a `GateFinding.line` without it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "../src/document.ts";
import { lineAt, walkLayersWithHostPositions } from "../src/position.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-position-"));
}

test("lineAt: line 1 for offset 0, and counts one \\n per line thereafter", () => {
  const text = "aaa\nbbb\nccc\n";
  assert.equal(lineAt(text, 0), 1);
  assert.equal(lineAt(text, 3), 1); // still before the first \n
  assert.equal(lineAt(text, 4), 2); // just past the first \n
  assert.equal(lineAt(text, 8), 3);
});

test("lineAt: an em-dash and an emoji do not shift the count — offsets are string indices, not bytes", () => {
  // "—" is one UTF-16 code unit; "🔥" is a surrogate pair (two). Both count as tree-sitter's own
  // startIndex does, so lineAt must agree with the same unit or the two would silently disagree once a
  // gate composed them (project/tasks/003-…, Surprises).
  const text = "Prose — with an em-dash 🔥 then\nsecond line\n";
  const secondLineStart = text.indexOf("second line");
  assert.equal(lineAt(text, secondLineStart), 2);
});

test("walkLayersWithHostPositions: a nested layer's host span accounts for both ancestors' starts", async () => {
  const repoRoot = await repo();
  const text = [
    "---",
    "title: fixture",
    "---",
    "",
    "````markdown",
    "[nested](target.md)",
    "````",
    "",
  ].join("\n");
  await writeFile(path.join(repoRoot, "f.md"), text);

  const store = createDocumentStore(repoRoot);
  const document = store.get("f.md");
  assert.ok(document.tree !== undefined);

  const positioned = walkLayersWithHostPositions(document.layers);

  const frontmatter = positioned.find((p) => p.layer.languageId === "source.yaml");
  assert.ok(frontmatter !== undefined);
  // The captured node is the whole `minus_metadata` block, delimiters included (markdown's own
  // injections.scm, the "yml"-tagged pattern) — its host span must slice back to exactly that.
  assert.equal(text.slice(frontmatter.hostStart, frontmatter.hostEnd), "---\ntitle: fixture\n---\n");
  assert.equal(frontmatter.hostStart, 0, "the frontmatter is the very first thing in the document");

  // The fenced ```markdown block is itself a layer; its own inline_link is a layer nested one level
  // further, and ITS host offset must account for both the fence's own parentStart and the outer
  // document's frontmatter having come before it — not just its immediate parent's.
  const fencedMarkdown = positioned.find((p) => p.layer.languageId === "text.markdown");
  assert.ok(fencedMarkdown !== undefined);
  assert.equal(text.slice(fencedMarkdown.hostStart, fencedMarkdown.hostEnd), "[nested](target.md)\n");

  const nestedInline = positioned.find(
    (p) => p.layer.languageId === "text.markdown_inline" && p.hostStart >= fencedMarkdown.hostStart && p.hostStart < fencedMarkdown.hostEnd,
  );
  assert.ok(nestedInline !== undefined, "the fence's own inline layer was not found among the flattened walk");
  const linkNode = nestedInline.layer.tree.rootNode.descendantsOfType("inline_link")[0];
  assert.ok(linkNode !== undefined);
  const hostOffset = nestedInline.hostStart + linkNode.startIndex;
  assert.equal(text.slice(hostOffset, hostOffset + linkNode.text.length), "[nested](target.md)");
});

test("end to end against a real file in this repository: cli/AGENTS.md's first link is on line 7", async () => {
  // Not a fixture — proving the whole chain (parse, resolve layers, walk to a host offset, look up a
  // line) against a file nobody hand-tuned for this test is what project/tasks/003-… recorded as
  // verified before the task was written; this is that proof, kept as a regression guard.
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const store = createDocumentStore(repoRoot);
  const document = store.get("cli/AGENTS.md");
  assert.ok(document.tree !== undefined, "cli/AGENTS.md did not parse");

  const positioned = walkLayersWithHostPositions(document.layers);
  const inlineLayers = positioned.filter((p) => p.layer.languageId === "text.markdown_inline");
  assert.ok(inlineLayers.length > 0, "no inline layer resolved for cli/AGENTS.md");

  let firstLinkHostOffset: number | undefined;
  for (const { layer, hostStart } of inlineLayers) {
    const linkNode = layer.tree.rootNode.descendantsOfType("inline_link")[0];
    if (linkNode === undefined) continue;
    const candidate = hostStart + linkNode.startIndex;
    if (firstLinkHostOffset === undefined || candidate < firstLinkHostOffset) firstLinkHostOffset = candidate;
  }
  assert.ok(firstLinkHostOffset !== undefined, "no inline_link found in cli/AGENTS.md");
  assert.equal(lineAt(document.text, firstLinkHostOffset), 7);
});
