import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expandPluginToken, filterByGlobs, resolvePluginDir } from "../src/files.ts";

test("resolvePluginDir finds plugin/ when it carries a manifest", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  await mkdir(path.join(repoRoot, "plugin", ".claude-plugin"), { recursive: true });
  await writeFile(path.join(repoRoot, "plugin", ".claude-plugin", "plugin.json"), "{}");
  assert.equal(resolvePluginDir(repoRoot), path.join(repoRoot, "plugin"));
});

test("resolvePluginDir falls back to the repository root in a flat layout", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  assert.equal(resolvePluginDir(repoRoot), repoRoot);
});

test("<plugin>/ expands to plugin/ in a nested layout and to nothing in a flat one", () => {
  const nested = "/repo";
  assert.equal(
    expandPluginToken("<plugin>/skills/*/SKILL.md", nested, path.join(nested, "plugin")),
    "plugin/skills/*/SKILL.md",
  );
  assert.equal(expandPluginToken("<plugin>/skills/*/SKILL.md", nested, nested), "skills/*/SKILL.md");
});

test("a pattern with no <plugin>/ token is returned unchanged", () => {
  assert.equal(expandPluginToken("AGENTS.md", "/repo", "/repo/plugin"), "AGENTS.md");
});

test("filterByGlobs matches AGENTS.md against both a bare pattern and **/AGENTS.md", () => {
  const files = ["AGENTS.md", "cli/AGENTS.md", "README.md"];
  assert.deepEqual(filterByGlobs(files, ["**/AGENTS.md"]), ["AGENTS.md", "cli/AGENTS.md"]);
  assert.deepEqual(filterByGlobs(files, ["AGENTS.md"]), ["AGENTS.md"]);
});
