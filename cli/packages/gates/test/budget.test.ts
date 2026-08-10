import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import budget from "../src/budget/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-budget-"));
}

test("no AGENTS.md at the repository root fails", async () => {
  const repoRoot = await repo();
  const outcome = await budget.run({ repoRoot, pluginDir: repoRoot, files: [], options: {} });
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /no AGENTS\.md/);
});

test("under the default budget passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "one\ntwo\nthree\n");
  const outcome = await budget.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["AGENTS.md"],
    options: {},
  });
  assert.deepEqual(outcome.findings, []);
});

test("over the default budget fails, naming the count", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), `${"line\n".repeat(200)}`);
  const outcome = await budget.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["AGENTS.md"],
    options: {},
  });
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /200 lines, over the 150-line budget/);
});

test("options.max overrides the default", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), `${"line\n".repeat(10)}`);
  const outcome = await budget.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["AGENTS.md"],
    options: { max: 5 },
  });
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /over the 5-line budget/);
});
