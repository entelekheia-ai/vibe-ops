import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import configModule from "../src/index.ts";
import type { ModuleContext } from "@entelekheia/vibe-ops-core";
import { loadConfig, MANAGED_FILENAME } from "@entelekheia/vibe-ops-core";

async function gitDir(dir: string): Promise<void> {
  await mkdir(path.join(dir, ".git"));
}

async function fixtureRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-config-module-"));
  await gitDir(dir);
  await writeFile(
    path.join(dir, "vibeops.config.mjs"),
    `export default { types: { task: "@acme/governance-task" }, settings: { governance: { level: "fail" } } };`,
  );
  await writeFile(
    path.join(dir, MANAGED_FILENAME),
    JSON.stringify({ types: { plan: "@acme/governance-plan" }, harness: { applied: { plan: 3 } } }, undefined, 2) + "\n",
  );
  return dir;
}

const logs: string[] = [];
async function ctx(repoRoot: string, command: string, args: readonly string[] = [], flags: Record<string, string | boolean> = {}): Promise<ModuleContext> {
  const { config } = await loadConfig(repoRoot);
  return {
    repoRoot,
    flags,
    args,
    command,
    config,
    settings: undefined,
    surface: "cli",
    log: (m) => logs.push(m),
    warn: (m) => logs.push(m),
  };
}

test("config get returns the effective value, its origin, and nothing shadowed when only one layer sets it", async () => {
  const repo = await fixtureRepo();
  const result = await configModule.run(await ctx(repo, "get", ["types.plan"]));
  assert.equal(result.code, 0);
  const data = result.data as { value: unknown; origin?: string; shadowedBy: readonly string[] };
  assert.equal(data.value, "@acme/governance-plan");
  assert.match(data.origin ?? "", /^managed:.*vibeops\.config\.json$/);
  assert.deepEqual(data.shadowedBy, []);
});

test("config get exits 1 and names the key when nothing sets it", async () => {
  const repo = await fixtureRepo();
  const result = await configModule.run(await ctx(repo, "get", ["types.nope"]));
  assert.equal(result.code, 1);
  assert.match(result.summary, /types\.nope/);
});

test("config get on harness.applied only ever attributes to the managed layer", async () => {
  const repo = await fixtureRepo();
  // A declared copy of harness.applied must never win attribution — RFC-0004 §3 strips it at load.
  await writeFile(path.join(repo, "vibeops.config.mjs"), `export default { harness: { applied: { plan: 1 } } };`);
  const result = await configModule.run(await ctx(repo, "get", ["harness.applied"]));
  assert.equal(result.code, 0);
  const data = result.data as { origin?: string };
  assert.match(data.origin ?? "", /^managed:/);
});

test("config list derives keys from the loaded config, not a hardcoded list", async () => {
  const repo = await fixtureRepo();
  const result = await configModule.run(await ctx(repo, "list"));
  assert.equal(result.code, 0);
  const { keys } = result.data as { keys: readonly { key: string }[] };
  const names = keys.map((k) => k.key);
  assert.ok(names.includes("types.plan"));
  assert.ok(names.includes("types.task"));
  assert.ok(names.includes("settings.governance"));
  assert.ok(names.includes("harness.applied"));
});

test("config list names only keys something set — never a field merge left undefined", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-config-one-key-"));
  spawnSync("git", ["-C", repo, "init", "-q"]);
  await writeFile(path.join(repo, "vibeops.config.json"), JSON.stringify({ types: { task: "@acme/x" } }));
  const result = await configModule.run(await ctx(repo, "list"));
  assert.equal(result.code, 0);
  const { keys } = result.data as { keys: readonly { key: string }[] };
  assert.deepEqual(keys.map((k) => k.key), ["types.task"], "exactly the one key the file sets; no harness/ownership/modules ghosts");
});

test("config list --show-origin names the file behind every effective key", async () => {
  const repo = await fixtureRepo();
  const result = await configModule.run(await ctx(repo, "list", [], { "show-origin": true }));
  const { keys } = result.data as { keys: readonly { key: string; origin?: string }[] };
  const plan = keys.find((k) => k.key === "types.plan");
  const task = keys.find((k) => k.key === "types.task");
  assert.match(plan?.origin ?? "", /managed:/);
  assert.match(task?.origin ?? "", /declared:/);
});

test("config set writes a types binding, prints the managed file, and reports no shadow", async () => {
  const repo = await fixtureRepo();
  const result = await configModule.run(await ctx(repo, "set", ["types.log", "@acme/governance-log"]));
  assert.equal(result.code, 0);
  assert.match(result.summary, /^written managed:/);
  const onDisk = JSON.parse(await readFile(path.join(repo, MANAGED_FILENAME), "utf8"));
  assert.equal(onDisk.types.log, "@acme/governance-log");
});

test("config set on the same binding is a no-op reported as already bound", async () => {
  const repo = await fixtureRepo();
  const result = await configModule.run(await ctx(repo, "set", ["types.plan", "@acme/governance-plan"]));
  assert.equal(result.code, 0);
  assert.match(result.summary, /already bound/);
});

test("config set refuses a key outside types.<name>, naming the owning verb", async () => {
  const repo = await fixtureRepo();
  const ownership = await configModule.run(await ctx(repo, "set", ["ownership", "x"]));
  assert.notEqual(ownership.code, 0);
  assert.match(ownership.summary, /ownership set/);
  const harness = await configModule.run(await ctx(repo, "set", ["harness.applied", "x"]));
  assert.notEqual(harness.code, 0);
  assert.match(harness.summary, /harness sync/);
  const settings = await configModule.run(await ctx(repo, "set", ["settings.governance", "x"]));
  assert.notEqual(settings.code, 0);
});

test("config set relays R1 when the toplevel declared layer already holds the name", async () => {
  const repo = await fixtureRepo();
  const result = await configModule.run(await ctx(repo, "set", ["types.task", "@acme/other-task"]));
  assert.notEqual(result.code, 0);
  assert.match(result.summary, /already declared/);
});

test("config unset removes a types binding, and refuses when there is nothing to remove", async () => {
  const repo = await fixtureRepo();
  const nothing = await configModule.run(await ctx(repo, "unset", ["types.nope"]));
  assert.notEqual(nothing.code, 0);
  assert.match(nothing.summary, /nothing to remove/);

  const removed = await configModule.run(await ctx(repo, "unset", ["types.plan"]));
  assert.equal(removed.code, 0);
  const onDisk = JSON.parse(await readFile(path.join(repo, MANAGED_FILENAME), "utf8"));
  assert.equal(onDisk.types?.plan, undefined);
});
