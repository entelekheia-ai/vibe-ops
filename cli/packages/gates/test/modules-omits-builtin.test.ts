import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import gate from "../src/modules-omits-builtin/index.ts";
import { BUILTIN_MODULES } from "@entelekheia/vibe-ops-core";

async function repo(config?: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "vibeops-modules-gate-"));
  if (config !== undefined) await writeFile(path.join(root, "vibeops.config.mjs"), config);
  return root;
}

const run = (repoRoot: string) => gate.run({ repoRoot, files: [], options: {} } as never);

test("a declared list that omits built-ins names each missing noun", async () => {
  const root = await repo('export default { modules: ["check", "plan"] };\n');
  const result = await run(root);
  assert.ok("findings" in result);
  const named = result.findings.map((f) => f.evidence.match(/built-in "([^"]+)"/)![1]);
  assert.deepEqual(named.sort(), BUILTIN_MODULES.filter((n) => n !== "check" && n !== "plan").sort());
  assert.equal(result.examined, BUILTIN_MODULES.length);
});

test("a complete list, and no list at all, produce no finding", async () => {
  const complete = await repo(`export default { modules: ${JSON.stringify([...BUILTIN_MODULES])} };\n`);
  const full = await run(complete);
  assert.ok("findings" in full);
  assert.deepEqual(full.findings, []);

  const none = await run(await repo());
  assert.ok("skipped" in none, "no list means every built-in is exposed — nothing to examine");
});
