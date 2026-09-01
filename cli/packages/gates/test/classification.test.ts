// Every shape `classification` serves, each proven finding and not finding.
//
// One block per composed check. Together they are the claim that one gate covers all of them: a private
// name from a list that is never committed, a machine path, an attribution inside a shipped template, and
// a pointer to a note nobody else holds.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import classification from "../src/classification/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-classification-"));
}

function ctx(repoRoot: string, options: Record<string, unknown>, files: readonly string[]): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options, documents: createDocumentStore(repoRoot) };
}

test("a level outside the vocabulary is refused", async () => {
  const repoRoot = await repo();
  await assert.rejects(() => classification.run(ctx(repoRoot, { level: "restricted", forbid: ["x"] }, [])), /options\.level/);
});

test("public forbids nothing, so declaring a rule at that level is a usage error", async () => {
  const repoRoot = await repo();
  await assert.rejects(() => classification.run(ctx(repoRoot, { level: "public", forbid: ["x"] }, [])), /keeps nothing out/);
});

test("no pattern declared is skipped, never a clean sweep", async () => {
  const repoRoot = await repo();
  const outcome = await classification.run(ctx(repoRoot, { level: "internal", forbid: [] }, ["a.md"]));
  assert.equal(outcome.examined, 0);
  assert.match(outcome.skipped ?? "", /no pattern to look for/);
});

test("an empty population is skipped — zero examined is not a reading", async () => {
  const repoRoot = await repo();
  const outcome = await classification.run(ctx(repoRoot, { level: "internal", forbid: ["x"] }, []));
  assert.equal(outcome.examined, 0);
  assert.match(outcome.skipped ?? "", /zero examined is not a reading/);
});

// ── private-name: the list is handed in by path, and the finding may not quote it ───────────────────

test("a list that is named and not there throws, rather than reporting nothing found", async () => {
  const repoRoot = await repo();
  await assert.rejects(
    () => classification.run(ctx(repoRoot, { level: "secret", forbidFrom: "denylist.tsv" }, ["a.md"])),
    /must not report as nothing forbidden appearing/,
  );
});

test("secret: an occurrence is located but never quoted", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "denylist.tsv"), "client\tAcmeCorp\n");
  await writeFile(path.join(repoRoot, "a.md"), "# Doc\n\nWe built this for AcmeCorp last year.\n");

  const outcome = await classification.run(
    ctx(repoRoot, { level: "secret", forbidFrom: "denylist.tsv", subject: "a private name" }, ["a.md"]),
  );
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.line, 3);
  assert.doesNotMatch(outcome.findings[0]!.evidence, /AcmeCorp/, "quoting it would write the name into this output");
  assert.match(outcome.findings[0]!.evidence, /client/, "the label says which entry, which is safe to name");
});

test("secret: a document carrying nothing from the list reports nothing", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "denylist.tsv"), "client\tAcmeCorp\n");
  await writeFile(path.join(repoRoot, "a.md"), "# Doc\n\nNothing sensitive here.\n");
  const outcome = await classification.run(ctx(repoRoot, { level: "secret", forbidFrom: "denylist.tsv" }, ["a.md"]));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

// ── file paths, attributions, note pointers: the match is quoted ───────────────────────────────────

// The pattern reaches to the end of the path, not one character past the prefix: the evidence quotes the
// match, so a pattern that stops early names something nobody can act on.
const FILE_PATH = {
  level: "confidential",
  forbid: ["(?:/Users/|/home/|[Cc]:[\\\\/]+Users[\\\\/]+)[A-Za-z0-9][^\\s\"'`)]*"],
  rule: "file-path",
  subject: "an absolute path from someone's machine",
};

test("confidential: the matched path is quoted, and the rest of the line is not", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plan.md"), "Run:\n\n    node /Users/someone/checkout/bin.js\n");
  const outcome = await classification.run(ctx(repoRoot, FILE_PATH, ["plan.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /\/Users\/someone/);
  assert.equal(outcome.findings[0]!.rule, "file-path");
});

test("a repository-relative path is not a finding", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plan.md"), "Run:\n\n    node cli/packages/cli/dist/bin.js\n");
  const outcome = await classification.run(ctx(repoRoot, FILE_PATH, ["plan.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("an allowed line is not a finding — the announcement a rename obliges", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "plan.md"), "The old form was /Users/<name>/ and is now repository-relative.\n");
  const outcome = await classification.run(ctx(repoRoot, { ...FILE_PATH, allow: ["<name>"] }, ["plan.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("a literal year in a shipped template is an attribution the target did not make", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "t.md"), "<!--\n Copyright (c) 2026 Someone\n-->\n\n# Template\n");
  const outcome = await classification.run(
    ctx(repoRoot, { level: "confidential", forbid: ["Copyright \\(c\\) [0-9]{4}"], subject: "an attribution" }, ["t.md"]),
  );
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.line, 2);
});

test("a placeholder year in that same template is not", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "t.md"), "<!--\n Copyright (c) YYYY <owner>\n-->\n\n# Template\n");
  const outcome = await classification.run(
    ctx(repoRoot, { level: "confidential", forbid: ["Copyright \\(c\\) [0-9]{4}"], subject: "an attribution" }, ["t.md"]),
  );
  assert.deepEqual(outcome.findings, []);
});

test("internal: a pointer to a note nobody else holds is reported with its line", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# Map\n\nSee [[project_something]] for the rest.\n");
  const outcome = await classification.run(
    ctx(repoRoot, { level: "internal", forbid: ["\\[\\[[a-z0-9_]+\\]\\]"], subject: "a private note pointer" }, ["AGENTS.md"]),
  );
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.line, 3);
  assert.match(outcome.findings[0]!.evidence, /project_something/);
});

test("every occurrence is reported, not only the first in a file", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "a.md"), "/Users/one/x\nfine\n/home/two/y\n");
  const outcome = await classification.run(ctx(repoRoot, FILE_PATH, ["a.md"]));
  assert.equal(outcome.findings.length, 2);
  assert.deepEqual(outcome.findings.map((finding) => finding.line), [1, 3]);
});
