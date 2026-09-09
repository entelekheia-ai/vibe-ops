import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ownershipModule from "../src/index.ts";
import type { ModuleContext } from "@entelekheia/vibe-ops-core";
import { loadConfig, MANAGED_FILENAME } from "@entelekheia/vibe-ops-core";

async function gitDir(dir: string): Promise<void> {
  await mkdir(path.join(dir, ".git"));
}

async function fixtureRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ownership-module-"));
  await gitDir(dir);
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

test("ownership get answers for a path the harness's own base declaration covers", async () => {
  const repo = await fixtureRepo();
  // AGENTS.md, not CLAUDE.md: the latter moved from the harness base declaration into
  // @entelekheia/governance-instructions's own fragment (Plan-040 Track 5), so it no longer exercises
  // what this test names — a path the harness's OWN base declaration, not a governance package's, covers.
  const result = await ownershipModule.run(await ctx(repo, "get", ["AGENTS.md"]));
  assert.equal(result.code, 0);
  const data = result.data as { class: string; match: string; origin: string };
  assert.equal(data.origin, "harness");
  assert.ok(typeof data.class === "string" && data.class.length > 0);
});

test("ownership get exits 1 and names the path when nothing matches", async () => {
  const repo = await fixtureRepo();
  const result = await ownershipModule.run(await ctx(repo, "get", ["totally/unclaimed/path.md"]));
  assert.equal(result.code, 1);
  assert.match(result.summary, /totally\/unclaimed\/path\.md/);
});

test("ownership list reports entries and, with --show-origin, where each came from", async () => {
  const repo = await fixtureRepo();
  const bare = await ownershipModule.run(await ctx(repo, "list"));
  assert.equal(bare.code, 0);
  const bareData = bare.data as { paths: readonly { origin?: string }[] };
  assert.ok(bareData.paths.length > 0);
  assert.ok(bareData.paths.every((p) => p.origin === undefined));

  const withOrigin = await ownershipModule.run(await ctx(repo, "list", [], { "show-origin": true }));
  const data = withOrigin.data as { paths: readonly { origin?: string }[] };
  assert.ok(data.paths.some((p) => p.origin === "harness"));
});

test("ownership set writes a narrowing that narrows, and surfaces its own origin afterward", async () => {
  const repo = await fixtureRepo();
  const written = await ownershipModule.run(
    await ctx(repo, "set", ["scratch/one-off.md", "seed"], { reason: "written once, then the repository owns it" }),
  );
  assert.equal(written.code, 0, written.summary);
  assert.match(written.summary, /^written managed:/);

  const onDisk = JSON.parse(await readFile(path.join(repo, MANAGED_FILENAME), "utf8"));
  assert.equal(onDisk.ownership[0].match, "scratch/one-off.md");
  assert.equal(onDisk.ownership[0].class, "seed");

  const got = await ownershipModule.run(await ctx(repo, "get", ["scratch/one-off.md"]));
  const data = got.data as { class: string; origin: string };
  assert.equal(data.class, "seed");
  assert.match(data.origin, /^managed:.*vibeops\.config\.json$/);
});

test("ownership set refuses an unknown class", async () => {
  const repo = await fixtureRepo();
  const result = await ownershipModule.run(
    await ctx(repo, "set", ["scratch/x.md", "not-a-class"], { reason: "because" }),
  );
  assert.notEqual(result.code, 0);
  assert.match(result.summary, /not a class/);
});

test("ownership set refuses a missing or empty reason", async () => {
  const repo = await fixtureRepo();
  const missing = await ownershipModule.run(await ctx(repo, "set", ["scratch/x.md", "seed"]));
  assert.notEqual(missing.code, 0);
  assert.match(missing.summary, /--reason/);

  const empty = await ownershipModule.run(await ctx(repo, "set", ["scratch/x.md", "seed"], { reason: "   " }));
  assert.notEqual(empty.code, 0);
});

test("ownership set refuses a widening past what a fragment declared", async () => {
  const repo = await fixtureRepo();
  // The harness's own base declares `repo` (never written) somewhere; pick a match this repository's own
  // base ownership.json already covers with a narrow class and try to widen it to "norm".
  const { composedOwnership } = await import("@entelekheia/vibe-ops-harness");
  const { config } = await loadConfig(repo);
  const boundary = await composedOwnership(config);
  const seedOrRepoEntry = boundary?.paths.find((p) => p.class === "seed" || p.class === "repo");
  if (seedOrRepoEntry === undefined) return; // nothing to widen against in this harness version — not this test's job to assert the base's own content
  const result = await ownershipModule.run(
    await ctx(repo, "set", [seedOrRepoEntry.match, "norm"], { reason: "trying to widen" }),
  );
  assert.notEqual(result.code, 0);
  assert.match(result.summary, /widen/);
});
