import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import configStateLeftover from "../src/config-state-leftover/index.ts";

async function repo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-config-state-leftover-"));
  await mkdir(path.join(dir, ".git"));
  return dir;
}

function ctx(repoRoot: string): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files: [], options: {}, documents: createDocumentStore(repoRoot) };
}

test("no leftover state file is skipped, not passed", async () => {
  const dir = await repo();
  const outcome = await configStateLeftover.run(ctx(dir));
  assert.deepEqual(outcome.findings, []);
  assert.match(outcome.skipped ?? "", /no vibeops\.config\.local\.json/);
});

test("a leftover vibeops.config.local.json at the toplevel is flagged", async () => {
  const dir = await repo();
  await writeFile(path.join(dir, "vibeops.config.local.json"), JSON.stringify({ harness: { applied: { plan: 3 } } }));
  const outcome = await configStateLeftover.run(ctx(dir));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /harness sync/);
});
