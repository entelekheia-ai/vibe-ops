import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { hasRemote, hooksPath, workflowFiles, churnByTopLevel } from "../src/shape.ts";

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-shape-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.email", "test@example.com"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.name", "test"]);
  return repoRoot;
}

async function commit(repoRoot: string, file: string, content: string): Promise<void> {
  const target = path.join(repoRoot, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  spawnSync("git", ["-C", repoRoot, "add", file]);
  spawnSync("git", ["-C", repoRoot, "commit", "-q", "-m", `add ${file}`]);
}

test("hasRemote: false for a fresh git init, true once one is added", async () => {
  const repoRoot = await gitRepo();
  assert.equal(hasRemote(repoRoot), false);
  spawnSync("git", ["-C", repoRoot, "remote", "add", "origin", "https://example.com/repo.git"]);
  assert.equal(hasRemote(repoRoot), true);
});

test("hooksPath: falls back to .git/hooks when core.hooksPath is unset", async () => {
  const repoRoot = await gitRepo();
  assert.equal(hooksPath(repoRoot), ".git/hooks");
  spawnSync("git", ["-C", repoRoot, "config", "core.hooksPath", ".githooks"]);
  assert.equal(hooksPath(repoRoot), ".githooks");
});

test("workflowFiles: a repository with .github/workflows entirely absent reports empty, not a swallowed error", async () => {
  const repoRoot = await gitRepo();
  assert.deepEqual(workflowFiles(repoRoot), [], "no .github/ at all — still a clean empty list");
});

test("workflowFiles: only .yml/.yaml files are counted, sorted", async () => {
  const repoRoot = await gitRepo();
  await commit(repoRoot, ".github/workflows/b.yml", "name: b\n");
  await commit(repoRoot, ".github/workflows/a.yaml", "name: a\n");
  await commit(repoRoot, ".github/workflows/README.md", "not a workflow\n");
  assert.deepEqual(workflowFiles(repoRoot), ["a.yaml", "b.yml"]);
});

test("churnByTopLevel: counts commits touching each top-level directory, most-touched first", async () => {
  const repoRoot = await gitRepo();
  await commit(repoRoot, "src/a.ts", "1");
  await commit(repoRoot, "src/b.ts", "2");
  await commit(repoRoot, "docs/readme.md", "3");
  const churn = churnByTopLevel(repoRoot);
  assert.deepEqual(churn, [
    { topLevel: "src", commits: 2 },
    { topLevel: "docs", commits: 1 },
  ]);
});

test("churnByTopLevel: a file sitting at the repository root is its own top-level entry", async () => {
  const repoRoot = await gitRepo();
  await commit(repoRoot, "README.md", "1");
  assert.deepEqual(churnByTopLevel(repoRoot), [{ topLevel: "README.md", commits: 1 }]);
});
