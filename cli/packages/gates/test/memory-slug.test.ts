import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import memorySlug from "../src/memory-slug/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-memory-slug-"));
}

// documents added once here rather than in every call site below — see project/tasks/001-…, item 4.
function ctx(repoRoot: string, files: readonly string[]): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: {}, documents: createDocumentStore(repoRoot) };
}

// The decoys are the point of this fixture: a real slug beside two shapes that must NOT count — a
// TOML array-of-tables inside a fence, and the same bracket shape quoted as inline code. A fixture
// with only the real slug would pass whether or not the gate tells them apart.
const FIXTURE = [
  "# decoys",
  "```toml",
  "[[language]]",
  'name = "description"',
  "```",
  "inline `[[also_not_a_link]]` quoted as code",
  "a real one: see [[project_something]]",
  "",
].join("\n");

test("exactly one hit — the real slug — and neither decoy counts", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "decoys.md"), FIXTURE);
  const outcome = await memorySlug.run(ctx(repoRoot, ["decoys.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /project_something/);
  assert.equal(outcome.findings[0]!.line, 7);
});

test("a clean file passes and is counted as examined", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n\nno links here.\n");
  const outcome = await memorySlug.run(ctx(repoRoot, ["AGENTS.md"]));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

// A shipped template's population exclusion is no longer this gate's concern — the gate examines
// whatever population it is handed, and excluding `**/templates/**` is the composing ops's job via
// the `ignore` config key (see cli/packages/core/src/ops.ts and ops-agents-md's own test for the
// ops-level assertion). A gate that filtered its own population by a repository-specific rule is
// exactly the divergence project/tasks/004-the-governance-ops.md found and removed.
test("a file under templates/ is examined like any other — the gate itself no longer filters it", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "skills", "demo", "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "skills", "demo", "templates", "demo.md"), "see [[project_x]]\n");
  const outcome = await memorySlug.run(ctx(repoRoot, ["skills/demo/templates/demo.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.examined, 1);
});
