import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import harness from "../src/index.ts";

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-module-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

function baseContext(overrides: Partial<Parameters<typeof harness.run>[0]> = {}): Parameters<typeof harness.run>[0] {
  return {
    repoRoot: "",
    flags: {},
    args: [],
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
    ...overrides,
  };
}

test("harness declares its verbs and needsSource, and the two that write are destructive", () => {
  assert.deepEqual(
    harness.definition.commands?.map((c) => c.name),
    // `resolve` waited on Plan-027 Track 1 rather than being written alongside the other four: adding a
    // fifth resolver while four had already diverged would have added the defect that plan removes.
    // `policy` joined in Plan-040 Track 1 — the harness's own policy prose (model, pair, ownership),
    // moved out of `plugin/references/` since `harness` is CLI-internal and has no `records norm` ladder.
    // `install` joined in Plan-040 Track 6 — the commit gate's four files, written by their own verb
    // because the harness is not a governance and its apparatus is not somebody's scaffold contribution.
    ["resolve", "shape", "status", "catalog", "audit", "policy", "install", "sync"],
  );
  assert.equal(harness.definition.needsSource, true);
  assert.deepEqual(
    harness.definition.commands?.filter((c) => c.destructive === true).map((c) => c.name),
    ["install", "sync"],
    "six verbs read and two write; a reading verb that asked for confirmation would teach people to skip it",
  );
});

test("shape reports a boring, workflow-less, remote-less repository accurately", async () => {
  const repoRoot = await gitRepo();
  const result = await harness.run(baseContext({ repoRoot, command: "shape" }));
  assert.equal(result.code, 0);
  const data = result.data as { hasRemote: boolean; workflowFiles: readonly string[] };
  assert.equal(data.hasRemote, false);
  assert.deepEqual(data.workflowFiles, []);
});

test("status: no sourceRoot resolved reports nothing to compare against, not an error", async () => {
  const repoRoot = await gitRepo();
  const result = await harness.run(baseContext({ repoRoot, command: "status" }));
  assert.equal(result.code, 0);
  assert.deepEqual((result.data as { behind: readonly unknown[] }).behind, []);
});

test("status: sourceRoot present but this clone was never promulgated to — silent, not zero", async () => {
  const repoRoot = await gitRepo();
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-source-"));
  const result = await harness.run(baseContext({ repoRoot, command: "status", sourceRoot }));
  assert.equal(result.code, 0);
  assert.match(result.summary, /never been promulgated to and holds no templates/);
});

test("audit dispatches to buildAudit and reports the shape", async () => {
  const repoRoot = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");
  const result = await harness.run(baseContext({ repoRoot, command: "audit" }));
  assert.equal(result.code, 0);
  const data = result.data as { guides: unknown; sensors: unknown; governance: unknown };
  assert.ok(Array.isArray(data.guides));
  assert.ok(Array.isArray(data.sensors));
  assert.ok(Array.isArray(data.governance));
});

test("catalog dispatches to buildCatalog and reports the shape", async () => {
  const repoRoot = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");
  const result = await harness.run(baseContext({ repoRoot, command: "catalog" }));
  assert.equal(result.code, 0);
  assert.ok(Array.isArray((result.data as { uncomposed: unknown }).uncomposed));
});

test("status: a type behind the installed norm is reported", async () => {
  const repoRoot = await gitRepo();
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-source-"));
  await mkdir(path.join(sourceRoot, "types"), { recursive: true });
  await writeFile(path.join(sourceRoot, "types", "index.json"), JSON.stringify({ plan: { version: 3 } }));
  const result = await harness.run(
    baseContext({ repoRoot, command: "status", sourceRoot, config: { harness: { applied: { plan: 2 } } } }),
  );
  assert.equal(result.code, 0);
  assert.deepEqual((result.data as { behind: readonly unknown[] }).behind, [
    { type: "plan", applied: 2, shipped: 3, source: "promulgated" },
  ]);
});

// The generator. These four cover the state `harness status` used to answer `behind: []` for: a repository
// holding templates that nobody promulgated, which is every repository whose baseline was scaffolded or
// copied rather than promulgated to. Measured 2026-09-26: three repositories in this workspace were in it.
test("status: a stale template with no promulgation receipt is reported against the norm", async () => {
  const repoRoot = await gitRepo();
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-source-"));
  await mkdir(path.join(sourceRoot, "types"), { recursive: true });
  await writeFile(path.join(sourceRoot, "types", "index.json"), JSON.stringify({ plan: { version: 3 } }));
  await mkdir(path.join(repoRoot, "project", "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "project", "templates", "plan.md"), "---\nvibe-ops-template: plan@1\n---\n");
  const result = await harness.run(baseContext({ repoRoot, command: "status", sourceRoot }));
  assert.equal(result.code, 0);
  assert.deepEqual((result.data as { behind: readonly unknown[] }).behind, [
    { type: "plan", applied: 1, shipped: 3, source: "template" },
  ]);
  assert.match(result.summary, /1 record type\(s\) behind/);
});

test("status: a template that declares no version is reported as undeclared, not as a version", async () => {
  const repoRoot = await gitRepo();
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-source-"));
  await mkdir(path.join(sourceRoot, "types"), { recursive: true });
  await writeFile(path.join(sourceRoot, "types", "index.json"), JSON.stringify({ plan: { version: 3 } }));
  await mkdir(path.join(repoRoot, "project", "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "project", "templates", "plan.md"), "# Plan\n\nno stamp here\n");
  const result = await harness.run(baseContext({ repoRoot, command: "status", sourceRoot }));
  assert.equal(result.code, 0);
  const data = result.data as { behind: readonly unknown[]; undeclared: readonly string[] };
  assert.deepEqual(data.behind, [], "an unstamped template is never resolved to a version");
  assert.deepEqual(data.undeclared, [{ type: "plan", token: undefined }]);
});

// A type with NO template file is what keeps this reading quiet in an unrelated repository — not the
// shipped-type filter, which in any environment where the governance packages activate covers all five.
// That filter is unit-tested in cli/test/harness-status.test.ts, where `shipped` is supplied directly.
test("status: a current template beside an unstamped one reports only the unstamped one", async () => {
  const repoRoot = await gitRepo();
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-source-"));
  await mkdir(path.join(sourceRoot, "types"), { recursive: true });
  await writeFile(path.join(sourceRoot, "types", "index.json"), JSON.stringify({ plan: { version: 3 } }));
  await mkdir(path.join(repoRoot, "project", "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "project", "templates", "plan.md"), "---\nvibe-ops-template: plan@3\n---\n");
  await writeFile(path.join(repoRoot, "project", "templates", "task.md"), "# Task\n\nno stamp\n");
  const result = await harness.run(baseContext({ repoRoot, command: "status", sourceRoot }));
  assert.equal(result.code, 0);
  const data = result.data as { behind: readonly unknown[]; undeclared: readonly string[] };
  assert.deepEqual(data.behind, [], "the current template is not behind");
  assert.deepEqual(data.undeclared, [{ type: "task", token: undefined }]);
});

test("status: a template on the pre-integer spelling is reported as declaring it, never as declaring nothing", async () => {
  const repoRoot = await gitRepo();
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-source-"));
  await mkdir(path.join(sourceRoot, "types"), { recursive: true });
  await writeFile(path.join(sourceRoot, "types", "index.json"), JSON.stringify({ plan: { version: 3 } }));
  await mkdir(path.join(repoRoot, "project", "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "project", "templates", "plan.md"), "---\nvibe-ops-template: plan@0.1\n---\n");
  const result = await harness.run(baseContext({ repoRoot, command: "status", sourceRoot }));
  const data = result.data as { behind: readonly unknown[]; undeclared: readonly { type: string; token?: string }[] };
  assert.deepEqual(data.behind, [], "0.1 has no successor this reader can compute, so it is not a jump");
  assert.deepEqual(data.undeclared, [{ type: "plan", token: "plan@0.1" }]);
});

test("status: the promulgation receipt wins over the template on disk", async () => {
  const repoRoot = await gitRepo();
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-source-"));
  await mkdir(path.join(sourceRoot, "types"), { recursive: true });
  await writeFile(path.join(sourceRoot, "types", "index.json"), JSON.stringify({ plan: { version: 3 } }));
  await mkdir(path.join(repoRoot, "project", "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "project", "templates", "plan.md"), "---\nvibe-ops-template: plan@3\n---\n");
  const result = await harness.run(
    baseContext({ repoRoot, command: "status", sourceRoot, config: { harness: { applied: { plan: 2 } } } }),
  );
  assert.deepEqual((result.data as { behind: readonly { source?: string }[] }).behind, [
    { type: "plan", applied: 2, shipped: 3, source: "promulgated" },
  ]);
});
