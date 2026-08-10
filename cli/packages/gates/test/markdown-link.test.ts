import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import markdownLink from "../src/markdown-link/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-markdown-link-"));
}

function ctx(repoRoot: string, files: readonly string[]): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: {}, documents: createDocumentStore(repoRoot) };
}

test("an absolute path in a link fails, naming the target and the line", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), "line one\n\n[bad](/etc/passwd)\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "links");
  assert.equal(outcome.findings[0]!.line, 3);
  assert.match(outcome.findings[0]!.evidence, /absolute path/);
});

test("a link that climbs above the repository root fails as OUTSIDE, not as a normal miss", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "sub"), { recursive: true });
  await writeFile(path.join(repoRoot, "sub", "f.md"), "[climb](../../outside.md)\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["sub/f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /outside the repository/);
});

test("a relative link to a file that does not exist fails, naming the target", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), "[missing](nowhere.md)\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /does not resolve: nowhere\.md/);
});

test("a link inside a code span is not a finding — code_span has no link_destination child", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), "See `[fake](nowhere.md)` here.\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("external links, anchors, mailto, and an unexpanded template variable are all skipped", async () => {
  const repoRoot = await repo();
  const text = [
    "[ext](http://example.com/nowhere)",
    "[anchor](#nowhere)",
    "[mail](mailto:nobody@example.com)",
    "[var](${FOO}/nowhere.md)",
    "",
  ].join("\n");
  await writeFile(path.join(repoRoot, "f.md"), text);
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("a link that resolves — including one anchored with #fragment — passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "target.md"), "# target\n");
  await writeFile(path.join(repoRoot, "f.md"), "[good](target.md#section) and [also good](./target.md)\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("a link written only inside a table cell is still found — the supplement, not the declared query, delivers it", async () => {
  const repoRoot = await repo();
  const text = ["| Field | Value |", "| --- | --- |", "| link | [missing](nowhere.md) |", ""].join("\n");
  await writeFile(path.join(repoRoot, "f.md"), text);
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.line, 3);
  assert.match(outcome.findings[0]!.evidence, /does not resolve: nowhere\.md/);
});

test("an image's link_destination is checked the same way a link's is", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), '![missing](nowhere.png "title")\n');
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /does not resolve: nowhere\.png/);
});

test("a shortcut link ([text] with no destination) is never collected — no finding, no crash", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), "See [shortcut] for details.\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("a file the model could not parse is not examined, and produces no crash", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.unknown"), "irrelevant\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.unknown"]));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 0);
});
