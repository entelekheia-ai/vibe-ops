import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import bridge from "../src/bridge/index.ts";

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-bridge-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

function gitAdd(repoRoot: string): void {
  spawnSync("git", ["-C", repoRoot, "add", "-A"]);
}

// documents added once here rather than in every call site below — see project/tasks/001-…, item 4.
function ctx(repoRoot: string, files: readonly string[] = []): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: {}, documents: createDocumentStore(repoRoot) };
}

test("no .claude/ directory is skipped, not passed", async () => {
  const repoRoot = await gitRepo();
  const outcome = await bridge.run(ctx(repoRoot));
  assert.deepEqual(outcome.findings, []);
  assert.match(outcome.skipped ?? "", /nothing to bridge/);
});

test("a regular file where .claude/rules/ needs a symlink fails", async () => {
  const repoRoot = await gitRepo();
  await mkdir(path.join(repoRoot, ".claude", "rules"), { recursive: true });
  await writeFile(path.join(repoRoot, ".claude", "rules", "x.md"), "not a symlink\n");
  gitAdd(repoRoot);
  const outcome = await bridge.run(ctx(repoRoot));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /regular file/);
});

test("a symlink whose target does not exist fails", async () => {
  const repoRoot = await gitRepo();
  await mkdir(path.join(repoRoot, ".agents", "rules"), { recursive: true });
  await mkdir(path.join(repoRoot, ".claude", "rules"), { recursive: true });
  await symlink("../../.agents/rules/gone.md", path.join(repoRoot, ".claude", "rules", "gone.md"));
  gitAdd(repoRoot);
  const outcome = await bridge.run(ctx(repoRoot));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /target does not exist/);
});

test("a resolving relative symlink passes, and is counted as examined", async () => {
  const repoRoot = await gitRepo();
  await mkdir(path.join(repoRoot, ".agents", "rules"), { recursive: true });
  await mkdir(path.join(repoRoot, ".claude", "rules"), { recursive: true });
  await writeFile(path.join(repoRoot, ".agents", "rules", "x.md"), "---\ndescription: d\n---\n");
  await symlink("../../.agents/rules/x.md", path.join(repoRoot, ".claude", "rules", "x.md"));
  gitAdd(repoRoot);
  const outcome = await bridge.run(ctx(repoRoot));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});
