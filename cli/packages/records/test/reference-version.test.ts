import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import { readReferenceVersion, routingPolicy } from "../src/reference-version.ts";

/** A repository laid out FLAT — the plugin surface is the root, which is what a target repo looks like. */
async function repoWithReference(body: string): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-reference-version-"));
  await mkdir(path.join(repoRoot, "references"), { recursive: true });
  await writeFile(path.join(repoRoot, "references", "knowledge-lifecycle.md"), body);
  return repoRoot;
}

const DECLARED = `---
vibe-ops-reference: knowledge-lifecycle@2
---

# Knowledge lifecycle
`;

test("reads the version a reference declares", async () => {
  const repoRoot = await repoWithReference(DECLARED);
  assert.equal(readReferenceVersion(repoRoot, "knowledge-lifecycle", repoRoot, createDocumentStore(repoRoot)), 2);
});

test("a reference declaring nothing is undefined — a plugin predating the scheme is not an error", async () => {
  const repoRoot = await repoWithReference("# Knowledge lifecycle\n");
  assert.equal(readReferenceVersion(repoRoot, "knowledge-lifecycle", repoRoot, createDocumentStore(repoRoot)), undefined);
});

test("a declaration naming a DIFFERENT document is not read as this one's", async () => {
  // The copied-reference case: keeping the source's token would report a version belonging to another
  // file, which is worse than no answer because it looks like one.
  const repoRoot = await repoWithReference("---\nvibe-ops-reference: exposure-contract@3\n---\n\n# x\n");
  assert.equal(readReferenceVersion(repoRoot, "knowledge-lifecycle", repoRoot, createDocumentStore(repoRoot)), undefined);
});

test("an absent file is undefined rather than a throw", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-reference-version-none-"));
  assert.equal(readReferenceVersion(repoRoot, "knowledge-lifecycle", repoRoot, createDocumentStore(repoRoot)), undefined);
});

test("routingPolicy names the one reference a closure actually applies", async () => {
  const repoRoot = await repoWithReference(DECLARED);
  assert.deepEqual(routingPolicy(repoRoot, repoRoot, createDocumentStore(repoRoot)), { "knowledge-lifecycle": 2 });
});
