import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import breadcrumb from "../src/breadcrumb/index.ts";

// A real commit, not a fixture sha — `git cat-file -e <sha>^{commit}` needs an object that actually
// exists, and the config is scoped to this one throwaway repo, never the caller's own.
async function gitRepoWithOneCommit(): Promise<{ repoRoot: string; sha: string }> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-breadcrumb-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.email", "test@example.com"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.name", "test"]);
  await writeFile(path.join(repoRoot, "committed.md"), "# committed\n");
  spawnSync("git", ["-C", repoRoot, "add", "-A"]);
  spawnSync("git", ["-C", repoRoot, "commit", "-q", "-m", "one"]);
  const sha = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  return { repoRoot, sha };
}

function ctx(repoRoot: string, files: readonly string[]): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: {}, documents: createDocumentStore(repoRoot) };
}

test("a valid breadcrumb pointing at a file removed after the referenced commit produces no finding", async () => {
  const { repoRoot, sha } = await gitRepoWithOneCommit();
  await rm(path.join(repoRoot, "committed.md"));
  await writeFile(path.join(repoRoot, "f.md"), `See \`git show ${sha}:committed.md\` for detail.\n`);
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("a breadcrumb whose commit does not resolve in this repository fails", async () => {
  const { repoRoot } = await gitRepoWithOneCommit();
  const bogusSha = "0".repeat(40);
  await writeFile(path.join(repoRoot, "f.md"), `\`git show ${bogusSha}:committed.md\`\n`);
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level ?? "fail", "fail");
  assert.match(outcome.findings[0]!.evidence, /commit does not resolve/);
});

test("a breadcrumb whose path did not exist at that commit fails", async () => {
  const { repoRoot, sha } = await gitRepoWithOneCommit();
  await writeFile(path.join(repoRoot, "f.md"), `\`git show ${sha}:never-existed.md\`\n`);
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level ?? "fail", "fail");
  assert.match(outcome.findings[0]!.evidence, /did not exist at that commit/);
});

test("a breadcrumb whose file is still in the working tree warns, not fails", async () => {
  const { repoRoot, sha } = await gitRepoWithOneCommit();
  // committed.md is still on disk — the breadcrumb is valid but its whole reason to exist (naming a
  // deletion) does not hold.
  await writeFile(path.join(repoRoot, "f.md"), `\`git show ${sha}:committed.md\`\n`);
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level, "warn");
  assert.match(outcome.findings[0]!.evidence, /still in the working tree/);
});

test("a malformed breadcrumb (short sha) fails, and is distinguished from an unresolved commit", async () => {
  const { repoRoot } = await gitRepoWithOneCommit();
  await writeFile(path.join(repoRoot, "f.md"), "`git show abc123:committed.md`\n");
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level ?? "fail", "fail");
  assert.match(outcome.findings[0]!.evidence, /malformed/);
});

test("a documentation placeholder (git show <sha>:<path>) is not flagged malformed — it is teaching the form, not attempting it", async () => {
  const { repoRoot } = await gitRepoWithOneCommit();
  await writeFile(path.join(repoRoot, "f.md"), "The convention is `git show <sha>:<path>`.\n");
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("the bare prefix, with no colon and no sha, is not flagged malformed — it mentions the command, it does not use it", async () => {
  const { repoRoot } = await gitRepoWithOneCommit();
  await writeFile(path.join(repoRoot, "f.md"), "the fix worked by requiring `git show ` to be followed by a colon.\n");
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("a code span with no 'git show ' prefix is not a breadcrumb and produces no finding", async () => {
  const { repoRoot } = await gitRepoWithOneCommit();
  await writeFile(path.join(repoRoot, "f.md"), "Run `npm test` first.\n");
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("a valid breadcrumb inside a table cell is still found — via the same supplement markdown-link relies on", async () => {
  const { repoRoot, sha } = await gitRepoWithOneCommit();
  await rm(path.join(repoRoot, "committed.md"));
  const text = ["| Breadcrumb |", "| --- |", `| \`git show ${sha}:committed.md\` |`, ""].join("\n");
  await writeFile(path.join(repoRoot, "f.md"), text);
  const outcome = await breadcrumb.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("the gate declares no fixable and exposes no fix() — the reference form is out of scope for repair", () => {
  assert.equal(breadcrumb.definition.fixable, undefined);
  assert.equal(breadcrumb.fix, undefined);
});
