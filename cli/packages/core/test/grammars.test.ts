// Plan-010's stated acceptance for this track: a test that fails when the runtime is moved off its
// pin — see project/tasks/001-the-document-model-and-its-sensor.md, item 5. Three tests: every
// declared grammar loads and parses; the callback form clears the 32,767-byte string-form ceiling; and
// extension resolution does what the registry says it does, including the "no grammar" case.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Parser from "tree-sitter";
import { allGrammars, grammarForExtension } from "../src/grammars.ts";
import { createDocumentStore } from "../src/document.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-grammars-"));
}

// One snippet and expected root type per scope this workspace declares. Deliberately not derived
// generically — a grammar this test does not know how to exercise should fail loudly (see below)
// rather than be silently skipped, the same "no reading over zero" discipline harness-pair.md states
// for a gate's `examined`.
const SNIPPETS: Readonly<Record<string, { readonly text: string; readonly rootType: string }>> = {
  "text.markdown": { text: "# Heading\n\nSome *text* with a [link](https://example.com).\n", rootType: "document" },
  "text.markdown_inline": { text: "Some *text* with a [link](https://example.com).", rootType: "inline" },
  "source.yaml": { text: "title: fixture\ntags:\n  - one\n  - two\n", rootType: "stream" },
};

test("Load: every declared grammar parses its snippet with zero ERROR nodes", () => {
  const grammars = allGrammars();
  assert.ok(grammars.length > 0, "the registry declared no grammars — grammars.ts resolved nothing");

  for (const grammar of grammars) {
    const spec = SNIPPETS[grammar.scope];
    assert.ok(spec !== undefined, `no snippet declared for scope "${grammar.scope}" — add one to SNIPPETS`);

    const parser = new Parser();
    parser.setLanguage(grammar.language);
    const tree = parser.parse(spec.text);

    assert.equal(tree.rootNode.type, spec.rootType, `scope "${grammar.scope}" produced the wrong root type`);
    assert.equal(tree.rootNode.hasError, false, `scope "${grammar.scope}" produced at least one ERROR node`);
  }
});

test("The ceiling: a fixture over 32,767 bytes parses with no ERROR, via the callback form", async () => {
  // Content, not padding: repeated valid markdown so the parser has real structure to get wrong, not
  // one long inert line. Each repetition is a heading plus a paragraph — comfortably past the
  // 32,767-byte ceiling the string form of Parser#parse throws on.
  const unit = "## Section\n\nSome text with a [link](https://example.com) and `code`.\n\n";
  const repeats = Math.ceil(40_000 / unit.length);
  const text = unit.repeat(repeats);
  assert.ok(text.length > 32_767, "fixture did not actually exceed the ceiling — test is not testing anything");

  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "big.md"), text);

  const store = createDocumentStore(repoRoot);
  const document = store.get("big.md");

  assert.equal(document.uncovered, undefined);
  assert.ok(document.tree !== undefined, "no tree — the callback form regressed to the string form");
  assert.equal(document.tree.rootNode.hasError, false);
  assert.equal(document.text.length, text.length);
});

test("Resolution: .md resolves to a grammar; an unknown extension does not, and says why", async () => {
  assert.equal(grammarForExtension("md")?.scope, "text.markdown");
  assert.equal(grammarForExtension("xyz"), undefined);

  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "known.md"), "# hi\n");
  await writeFile(path.join(repoRoot, "unknown.xyz"), "whatever this is\n");

  const store = createDocumentStore(repoRoot);

  const known = store.get("known.md");
  assert.ok(known.tree !== undefined);
  assert.equal(known.uncovered, undefined);

  const unknown = store.get("unknown.xyz");
  assert.equal(unknown.tree, undefined);
  assert.ok(unknown.uncovered !== undefined && unknown.uncovered.length > 0);
  assert.equal(unknown.text, "whatever this is\n");
});
