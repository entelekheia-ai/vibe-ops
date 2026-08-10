import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pairing from "../src/pairing/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-pairing-"));
}

test("a root AGENTS.md with no sibling CLAUDE.md fails, not warns", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  const outcome = await pairing.run({ repoRoot, pluginDir: repoRoot, files: ["AGENTS.md"], options: {} });
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level ?? "fail", "fail");
});

test("a nested AGENTS.md with no sibling CLAUDE.md warns, not fails", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "sub"), { recursive: true });
  await writeFile(path.join(repoRoot, "sub", "AGENTS.md"), "# map\n");
  const outcome = await pairing.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["sub/AGENTS.md"],
    options: {},
  });
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level, "warn");
});

test("a sibling CLAUDE.md that does not import @AGENTS.md still fails", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "Some Claude-specific note.\n");
  const outcome = await pairing.run({ repoRoot, pluginDir: repoRoot, files: ["AGENTS.md"], options: {} });
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /@AGENTS\.md/);
});

test("a correctly paired root file passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  const outcome = await pairing.run({ repoRoot, pluginDir: repoRoot, files: ["AGENTS.md"], options: {} });
  assert.deepEqual(outcome.findings, []);
});
