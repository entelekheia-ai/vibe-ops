import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import disabledDeclared from "../src/disabled-declared/index.ts";

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-disabled-declared-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

function ctx(repoRoot: string): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files: [], options: {}, documents: createDocumentStore(repoRoot) };
}

test("no config at all is skipped, not passed", async () => {
  const repoRoot = await gitRepo();
  const outcome = await disabledDeclared.run(ctx(repoRoot));
  assert.deepEqual(outcome.findings, []);
  assert.match(outcome.skipped ?? "", /no settings.*disabled entries/);
});

test("a disabled entry carrying a real reason string passes", async () => {
  const repoRoot = await gitRepo();
  await writeFile(
    path.join(repoRoot, "vibeops.config.mjs"),
    `export default { settings: { governance: { disabled: { "template-version-research": "research has no template" } } } };`,
  );
  const outcome = await disabledDeclared.run(ctx(repoRoot));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("a disabled entry set to a boolean is flagged", async () => {
  const repoRoot = await gitRepo();
  await writeFile(
    path.join(repoRoot, "vibeops.config.mjs"),
    `export default { settings: { governance: { disabled: { "some-check": true } } } };`,
  );
  const outcome = await disabledDeclared.run(ctx(repoRoot));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /must be a non-empty reason string/);
});

test("a disabled entry set to an empty string is flagged, same as a boolean", async () => {
  const repoRoot = await gitRepo();
  await writeFile(
    path.join(repoRoot, "vibeops.config.mjs"),
    `export default { settings: { self: { disabled: { "some-check": "" } } } };`,
  );
  const outcome = await disabledDeclared.run(ctx(repoRoot));
  assert.equal(outcome.findings.length, 1);
});

test("multiple ops each with their own disabled entries are all examined", async () => {
  const repoRoot = await gitRepo();
  await writeFile(
    path.join(repoRoot, "vibeops.config.mjs"),
    `export default { settings: {
      governance: { disabled: { a: "reason a" } },
      self: { disabled: { b: false } },
    } };`,
  );
  const outcome = await disabledDeclared.run(ctx(repoRoot));
  assert.equal(outcome.examined, 2);
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /settings\.self\.disabled\.b/);
});
