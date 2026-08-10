import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, searchPath, settingsFor } from "../src/config.ts";

test("searchPath walks from the start directory up to the root and includes home", () => {
  const dirs = searchPath("/a/b/c", "/home/someone");
  assert.equal(dirs[0], "/a/b/c");
  assert.ok(dirs.includes("/a"));
  assert.ok(dirs.includes("/"));
  assert.ok(dirs.includes("/home/someone"), "the home directory must be reachable even when off the path");
});

test("home is not duplicated when it already lies on the upward path", () => {
  const dirs = searchPath("/home/someone/repo", "/home/someone");
  assert.equal(dirs.filter((d) => d === "/home/someone").length, 1);
});

test("the nearer file wins per key, and settings merge one level deep", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-home-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });

  await writeFile(
    path.join(home, "vibeops.config.mjs"),
    `export default { artifactDir: "home-dir", modules: ["a"], settings: { check: { from: "home" }, other: { keep: true } } };`,
  );
  await writeFile(
    path.join(repo, "vibeops.config.mjs"),
    `export default { artifactDir: "repo-dir", settings: { check: { from: "repo" } } };`,
  );

  const { config, sources } = await loadConfig(repo, home);

  assert.equal(config.artifactDir, "repo-dir", "the nearer file wins");
  assert.deepEqual(config.modules, ["a"], "a key the nearer file omits falls through to the further one");
  assert.deepEqual(settingsFor(config, "check"), { from: "repo" });
  assert.deepEqual(settingsFor(config, "other"), { keep: true }, "another module's settings survive the override");
  assert.equal(sources.length, 2);
});

test("a config file without a default export is rejected rather than silently ignored", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-bad-"));
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export const config = {};`);
  await assert.rejects(() => loadConfig(dir, dir), /no default export/);
});

test("no config anywhere is not an error", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-empty-"));
  const { config, sources } = await loadConfig(dir, dir);
  assert.deepEqual(sources, []);
  assert.equal(config.artifactDir, undefined);
});
