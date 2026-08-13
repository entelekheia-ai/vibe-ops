import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import pairing from "../src/pairing/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-pairing-"));
}

// documents added once here rather than in every call site below — see project/tasks/001-…, item 4.
function ctx(repoRoot: string, files: readonly string[]): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: {}, documents: createDocumentStore(repoRoot) };
}

test("a root AGENTS.md with no sibling CLAUDE.md fails, not warns", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  const outcome = await pairing.run(ctx(repoRoot, ["AGENTS.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level ?? "fail", "fail");
});

test("a nested AGENTS.md with no sibling CLAUDE.md fails too — depth no longer decides the level, whether the sibling exists does", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "sub"), { recursive: true });
  await writeFile(path.join(repoRoot, "sub", "AGENTS.md"), "# map\n");
  const outcome = await pairing.run(ctx(repoRoot, ["sub/AGENTS.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level ?? "fail", "fail");
});

test("a sibling CLAUDE.md that exists but does not import @AGENTS.md warns, not fails — the tool cannot repair someone else's file, so a hard failure would be a dead end", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "Some Claude-specific note.\n");
  const outcome = await pairing.run(ctx(repoRoot, ["AGENTS.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level, "warn");
  assert.match(outcome.findings[0]!.evidence, /does not link back/);
});

test("a correctly paired root file passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  const outcome = await pairing.run(ctx(repoRoot, ["AGENTS.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("fix() creates the missing sibling, containing exactly @AGENTS.md", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  const context = ctx(repoRoot, ["AGENTS.md"]);
  const outcome = await pairing.run(context);
  const fixes = await pairing.fix!(context, outcome.findings);
  assert.deepEqual(fixes, [{ file: "CLAUDE.md", action: "created, containing @AGENTS.md" }]);
  assert.equal(await readFile(path.join(repoRoot, "CLAUDE.md"), "utf8"), "@AGENTS.md\n");

  const after = await pairing.run(context);
  assert.deepEqual(after.findings, []);
});

// Plan-013 Track 3: `content.includes("@AGENTS.md")` used to read this as importing, because the string
// is present — just not as an import. `proseText` masks the fenced example out before the test runs.
test("a CLAUDE.md whose only mention of @AGENTS.md is inside a code span does not count as importing it", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "See `@AGENTS.md` for an example of the convention.\n");
  const outcome = await pairing.run(ctx(repoRoot, ["AGENTS.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level, "warn");
  assert.match(outcome.findings[0]!.evidence, /does not link back/);
});

test("a CLAUDE.md whose only mention of @AGENTS.md is inside a fenced example does not count as importing it", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(
    path.join(repoRoot, "CLAUDE.md"),
    ["A nested repo's CLAUDE.md looks like:", "", "```", "@AGENTS.md", "```", ""].join("\n"),
  );
  const outcome = await pairing.run(ctx(repoRoot, ["AGENTS.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.level, "warn");
});

test("fix() never touches a CLAUDE.md that exists but does not import — that finding is unrepairable on purpose", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "Some Claude-specific note.\n");
  const context = ctx(repoRoot, ["AGENTS.md"]);
  const outcome = await pairing.run(context);
  const fixes = await pairing.fix!(context, outcome.findings);
  assert.deepEqual(fixes, []);
  assert.equal(await readFile(path.join(repoRoot, "CLAUDE.md"), "utf8"), "Some Claude-specific note.\n");
});
