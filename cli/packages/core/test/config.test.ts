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

test("records merges one level deep per sub-key, same as settings", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-home-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });

  await writeFile(
    path.join(home, "vibeops.config.mjs"),
    `export default { records: { dirs: { adr: "home-adr" }, templates: { adr: "home-adr.md" } } };`,
  );
  await writeFile(
    path.join(repo, "vibeops.config.mjs"),
    `export default { records: { dirs: { plan: "repo-plan" } } };`,
  );

  const { config } = await loadConfig(repo, home);
  assert.deepEqual(config.records, {
    dirs: { adr: "home-adr", plan: "repo-plan" },
    templates: { adr: "home-adr.md" },
  });
});

test("records is undefined when neither file declares it — no empty object appears from nowhere", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-norecords-"));
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { artifactDir: "x" };`);
  const { config } = await loadConfig(dir, dir);
  assert.equal(config.records, undefined);
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

test("the local file layers over the committed one in the same directory rather than replacing it", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-local-"));
  await writeFile(
    path.join(dir, "vibeops.config.mjs"),
    `export default { artifactDir: "committed", modules: ["a", "b"], settings: { check: { from: "committed" }, other: { keep: true } } };`,
  );
  await writeFile(
    path.join(dir, "vibeops.config.local.mjs"),
    `export default { artifactDir: "local", settings: { check: { from: "local" } } };`,
  );

  const { config, sources } = await loadConfig(dir, dir);

  assert.equal(config.artifactDir, "local", "the local file wins per key");
  assert.deepEqual(config.modules, ["a", "b"], "a key the local file omits falls through to the committed one");
  assert.deepEqual(settingsFor(config, "check"), { from: "local" });
  assert.deepEqual(settingsFor(config, "other"), { keep: true }, "another module's settings survive");
  assert.equal(sources.length, 2, "both files contributed, so both are reported");
  assert.ok(sources[0].endsWith("vibeops.config.local.mjs"), "sources is nearest-first, local before committed");
});

test("a nearer committed file beats a farther local one — the directory walk outranks the pair", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-home-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });

  await writeFile(path.join(home, "vibeops.config.local.mjs"), `export default { artifactDir: "home-local" };`);
  await writeFile(path.join(repo, "vibeops.config.mjs"), `export default { artifactDir: "repo-committed" };`);

  const { config } = await loadConfig(repo, home);

  assert.equal(
    config.artifactDir,
    "repo-committed",
    "a stale personal file in home must not govern a repository that declared its own",
  );
});

test("the committed file still loads alone when no local file exists", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-nolocal-"));
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { artifactDir: "committed" };`);
  const { config, sources } = await loadConfig(dir, dir);
  assert.equal(config.artifactDir, "committed");
  assert.equal(sources.length, 1);
});

test("harness.applied is carried through the cascade, and nearest wins whole", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-harness-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });

  await writeFile(
    path.join(home, "vibeops.config.local.mjs"),
    `export default { harness: { applied: { plan: 1, task: 1, adr: 1 } } };`,
  );
  await writeFile(
    path.join(repo, "vibeops.config.local.mjs"),
    `export default { harness: { applied: { plan: 3 } } };`,
  );

  const { config } = await loadConfig(repo, home);

  assert.deepEqual(
    config.harness?.applied,
    { plan: 3 },
    "a map is a fact about one working tree — a farther one must not fill in the types it omits",
  );
});

test("harness is undefined when nothing declares it, and absence is not zero", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-noharness-"));
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { artifactDir: "x" };`);
  const { config } = await loadConfig(dir, dir);
  assert.equal(config.harness, undefined);
});
