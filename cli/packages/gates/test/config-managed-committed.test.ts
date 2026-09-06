import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import configManagedCommitted from "../src/config-managed-committed/index.ts";

async function gitRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-config-managed-committed-"));
  spawnSync("git", ["-C", dir, "init", "-q"]);
  spawnSync("git", ["-C", dir, "config", "user.email", "t@example.invalid"]);
  spawnSync("git", ["-C", dir, "config", "user.name", "T"]);
  return dir;
}

function ctx(repoRoot: string): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files: [], options: {}, documents: createDocumentStore(repoRoot) };
}

test("no vibeops.config.json at all is skipped, not passed", async () => {
  const dir = await gitRepo();
  const outcome = await configManagedCommitted.run(ctx(dir));
  assert.deepEqual(outcome.findings, []);
  assert.match(outcome.skipped ?? "", /no vibeops\.config\.json/);
});

test("a tracked managed file passes", async () => {
  const dir = await gitRepo();
  await writeFile(path.join(dir, "vibeops.config.json"), "{}\n");
  spawnSync("git", ["-C", dir, "add", "vibeops.config.json"]);
  spawnSync("git", ["-C", dir, "commit", "-q", "-m", "seed"]);
  const outcome = await configManagedCommitted.run(ctx(dir));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("an untracked managed file is flagged", async () => {
  const dir = await gitRepo();
  await writeFile(path.join(dir, "vibeops.config.json"), "{}\n");
  const outcome = await configManagedCommitted.run(ctx(dir));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /not tracked/);
});

test("a gitignored managed file names the ignoring rule", async () => {
  const dir = await gitRepo();
  await writeFile(path.join(dir, ".gitignore"), "vibeops.config.json\n");
  await writeFile(path.join(dir, "vibeops.config.json"), "{}\n");
  const outcome = await configManagedCommitted.run(ctx(dir));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /\.gitignore/);
});
