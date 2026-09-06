import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import runnerProvenance from "../src/runner-provenance/index.ts";

// The gate checks a path relative to repoRoot's PARENT (`../vibe-ops`), so repoRoot must sit inside a
// workspace exclusive to this test — nesting it directly under the shared OS tmpdir made every test's
// `repoRoot/..` the same directory, and a sibling written by one test leaked into every other test's
// "no sibling" reading (caught by the suite going flaky under full-repo `npm test`, not in isolation).
async function gitRepo(): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "vibeops-runner-provenance-"));
  const repoRoot = path.join(workspace, "repo");
  await mkdir(repoRoot, { recursive: true });
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

function ctx(repoRoot: string): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files: [], options: {}, documents: createDocumentStore(repoRoot) };
}

async function writeSnapshot(repoRoot: string): Promise<void> {
  const p = path.join(repoRoot, "scripts", "check-agents-md.sh");
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, "#!/bin/sh\necho snapshot\n");
  await chmod(p, 0o755);
}

async function writeSibling(repoRoot: string): Promise<void> {
  // repoRoot is itself inside a temp dir; the sibling lives at ../vibe-ops relative to repoRoot.
  const p = path.join(repoRoot, "..", "vibe-ops", "cli", "packages", "module-check", "sh", "check-agents-md.sh");
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, "#!/bin/sh\necho sibling\n");
  await chmod(p, 0o755);
}

test("no scripts/check-agents-md.sh snapshot at all is skipped, not passed", async () => {
  const repoRoot = await gitRepo();
  const outcome = await runnerProvenance.run(ctx(repoRoot));
  assert.deepEqual(outcome.findings, []);
  assert.match(outcome.skipped ?? "", /nothing to check provenance for/);
});

test("a snapshot with no live sibling to shadow is the shape it exists for — no finding", async () => {
  const repoRoot = await gitRepo();
  await writeSnapshot(repoRoot);
  const outcome = await runnerProvenance.run(ctx(repoRoot));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("a snapshot that outranks a live sibling checkout is flagged", async () => {
  const repoRoot = await gitRepo();
  await writeSnapshot(repoRoot);
  await writeSibling(repoRoot);
  const outcome = await runnerProvenance.run(ctx(repoRoot));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /outranks the live sibling checkout/);
  assert.equal(outcome.examined, 1);
});

test("in the runner's own repository — where ../vibe-ops is the repository itself — the snapshot has no sibling, and the gate skips", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "vibeops-runner-provenance-self-"));
  const repoRoot = path.join(workspace, "vibe-ops");
  await mkdir(repoRoot, { recursive: true });
  await writeSnapshot(repoRoot);
  const own = path.join(repoRoot, "cli", "packages", "module-check", "sh", "check-agents-md.sh");
  await mkdir(path.dirname(own), { recursive: true });
  await writeFile(own, "#!/bin/sh\necho source\n");

  const result = await runnerProvenance.run(ctx(repoRoot));
  assert.ok("skipped" in result, JSON.stringify(result));
  assert.match(result.skipped, /own source/);
});
