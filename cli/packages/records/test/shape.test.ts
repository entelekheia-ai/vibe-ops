import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { Document } from "@entelekheia/vibe-ops-core";
import { entriesUnder, sectionHeadings } from "../src/shape.ts";

/** `text` as a real parsed `Document` — these readers walk the block tree, not raw lines. */
async function documentOf(text: string): Promise<Document> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-shape-"));
  await writeFile(path.join(dir, "x.md"), text);
  return createDocumentStore(dir).get("x.md");
}

test("sectionHeadings: collects H2 and H3 in document order, and never a heading inside a fence", async () => {
  const document = await documentOf(
    [
      "# Title",
      "## Summary",
      "### A detail",
      "```markdown",
      "## Not a section — this is a template being quoted",
      "```",
      "## Tracks",
    ].join("\n"),
  );

  assert.deepEqual(sectionHeadings(document), [
    { level: 2, text: "Summary" },
    { level: 3, text: "A detail" },
    { level: 2, text: "Tracks" },
  ]);
});

test("entriesUnder: a missing section is undefined, an empty one is 0 — they are different states", async () => {
  const empty = await documentOf(["## Surprises & Discoveries", "", "## Next"].join("\n"));
  const absent = await documentOf(["## Summary", "", "text"].join("\n"));

  assert.equal(entriesUnder(empty, "Surprises"), 0, "the section exists and holds nothing");
  assert.equal(entriesUnder(absent, "Surprises"), undefined, "the record carries no such section at all");
});

test("entriesUnder: matches by prefix, because this section is spelled both ways across real records", async () => {
  const short = await documentOf(["## Surprises", "- Observation: one"].join("\n"));
  const long = await documentOf(["## Surprises & Discoveries", "- Observation: one"].join("\n"));

  assert.equal(entriesUnder(short, "Surprises"), 1);
  assert.equal(entriesUnder(long, "Surprises"), 1);
});

test("entriesUnder: counts only what stands under that section, stopping at the next H2", async () => {
  const document = await documentOf(
    ["## Surprises", "- Observation: one", "- Observation: two", "## Decision Log", "- Decision: unrelated"].join("\n"),
  );

  assert.equal(entriesUnder(document, "Surprises"), 2);
  assert.equal(entriesUnder(document, "Decision Log"), 1);
});
