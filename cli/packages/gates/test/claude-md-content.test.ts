import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import gate from "../src/claude-md-content/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-claude-md-content-"));
}

// documents added once here rather than in every call site below — see project/tasks/001-…, item 4.
function ctx(repoRoot: string, files: readonly string[]): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: {}, documents: createDocumentStore(repoRoot) };
}

test("exactly @AGENTS.md passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  const outcome = await gate.run(ctx(repoRoot, ["CLAUDE.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("the import plus blank lines and an HTML comment still passes", async () => {
  const repoRoot = await repo();
  await writeFile(
    repoRoot + "/CLAUDE.md",
    "@AGENTS.md\n\n<!-- Copyright (c) 2026 Someone -->\n\n",
  );
  const outcome = await gate.run(ctx(repoRoot, ["CLAUDE.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("real prose beyond the import warns, never fails", async () => {
  const repoRoot = await repo();
  await writeFile(
    path.join(repoRoot, "CLAUDE.md"),
    "@AGENTS.md\n\nAlso: never suggest removing the license header check.\n",
  );
  const outcome = await gate.run(ctx(repoRoot, ["CLAUDE.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level, "warn");
  assert.equal(outcome.findings[0]!.rule, "claude-md-carries-content");
});

test("a comment hiding real content outside it still warns — only the comment ITSELF is stripped", async () => {
  const repoRoot = await repo();
  await writeFile(
    path.join(repoRoot, "CLAUDE.md"),
    "@AGENTS.md\n<!-- fine -->\nBut also this line, which is not inside any comment.\n",
  );
  const outcome = await gate.run(ctx(repoRoot, ["CLAUDE.md"]));
  assert.equal(outcome.findings.length, 1);
});

test("only the files handed in are examined — a nested CLAUDE.md with real content is never read when it is not in scope", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "sub"), { recursive: true });
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  await writeFile(path.join(repoRoot, "sub", "CLAUDE.md"), "@AGENTS.md\n\nunreviewed prose\n");
  const outcome = await gate.run(ctx(repoRoot, ["CLAUDE.md"]));
  assert.deepEqual(outcome.findings, []);
});
