import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import configShadow from "../src/config-shadow/index.ts";

async function repo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-config-shadow-"));
  await mkdir(path.join(dir, ".git"));
  return dir;
}

function ctx(repoRoot: string): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files: [], options: {}, documents: createDocumentStore(repoRoot) };
}

test("no managed layer is skipped, not passed", async () => {
  const dir = await repo();
  const outcome = await configShadow.run(ctx(dir));
  assert.deepEqual(outcome.findings, []);
  assert.match(outcome.skipped ?? "", /no managed layer/);
});

test("a managed key with no declared counterpart passes clean", async () => {
  const dir = await repo();
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { artifactDir: "x" };`);
  await writeFile(path.join(dir, "vibeops.config.json"), JSON.stringify({ types: { plan: "@acme/governance-plan" } }));
  const outcome = await configShadow.run(ctx(dir));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("types.<name> set in both the declared and managed layer at the same toplevel is a shadow", async () => {
  const dir = await repo();
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { types: { plan: "@acme/governance-plan" } };`);
  await writeFile(path.join(dir, "vibeops.config.json"), JSON.stringify({ types: { plan: "@acme/governance-plan" } }));
  const outcome = await configShadow.run(ctx(dir));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /types\.plan/);
});

test("an identical ownership match in both layers is a shadow", async () => {
  const dir = await repo();
  await writeFile(
    path.join(dir, "vibeops.config.mjs"),
    `export default { ownership: [{ match: "docs/**", class: "seed", reason: "hand-written" }] };`,
  );
  await writeFile(
    path.join(dir, "vibeops.config.json"),
    JSON.stringify({ ownership: [{ match: "docs/**", class: "norm", reason: "promulgated" }] }),
  );
  const outcome = await configShadow.run(ctx(dir));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /ownership match "docs\/\*\*"/);
});

test("harness.applied set in the declared layer too is a shadow, whole", async () => {
  const dir = await repo();
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { harness: { applied: { plan: 1 } } };`);
  await writeFile(path.join(dir, "vibeops.config.json"), JSON.stringify({ harness: { applied: { plan: 3 } } }));
  const outcome = await configShadow.run(ctx(dir));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /harness\.applied/);
});
