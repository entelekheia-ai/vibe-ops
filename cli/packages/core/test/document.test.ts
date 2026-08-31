// The document store's key is USUALLY repository-relative and sometimes absolute, and conflating the
// two is not hypothetical: it is Plan-035 Track 3's defect. `<template:<type>>` expands to the
// activated governance package's own template — outside repoRoot by construction — whenever the
// repository holds no copy of its own, and `path.join` glued that absolute path onto the target's root.
// The gate then reported "nothing to compare these records against" over a file that was right there.
//
// Invisible in vibe-ops itself, which keeps its own template copies and never reaches that branch;
// five SKIPs in every repository that does not. That asymmetry is why this test lives here rather than
// being left to the ops suites — they run against a checkout where the bug cannot appear.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "../src/document.ts";

test("a repository-relative key reads from inside the repository", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-doc-"));
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# inside\n");
  const document = createDocumentStore(repoRoot).get("AGENTS.md");
  assert.equal(document.text, "# inside\n");
  assert.equal(document.uncovered, undefined);
});

test("an absolute key reads that path, never repoRoot joined onto it", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-doc-"));
  const elsewhere = await mkdtemp(path.join(tmpdir(), "vibeops-norm-"));
  const template = path.join(elsewhere, "plan.md");
  await writeFile(template, "---\nvibe-ops-template: plan@3\n---\n\n# Plan\n");
  const document = createDocumentStore(repoRoot).get(template);
  assert.match(document.text, /plan@3/, "joining would have produced <repoRoot>/<abs> and read nothing");
  assert.equal(document.uncovered, undefined, "an unreadable file returns a Document carrying the reason");
});

test("an unreadable key still returns a Document, naming why — one bad file may not end a run", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-doc-"));
  const document = createDocumentStore(repoRoot).get("never-written.md");
  assert.equal(document.text, "");
  assert.match(document.uncovered ?? "", /cannot read file/);
});
