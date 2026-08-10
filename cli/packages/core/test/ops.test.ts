import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineOps } from "../src/ops.ts";
import type { ModuleContext } from "../src/context.ts";
import type { VibeOpsConfig } from "../src/config.ts";

/** A gate written to disk so defineOps's dynamic-import resolution has something real to load. */
async function writeFakeGate(dir: string, id: string, body: string): Promise<string> {
  const file = path.join(dir, `${id}.mjs`);
  await writeFile(
    file,
    `export default { definition: { id: "${id}", summary: "fake" }, run: async (ctx) => (${body}) };\n`,
  );
  return file;
}

function contextFor(repoRoot: string, config: VibeOpsConfig, flags: Record<string, string | boolean> = {}): {
  context: ModuleContext;
  logs: string[];
} {
  const logs: string[] = [];
  const context: ModuleContext = {
    repoRoot,
    flags,
    args: [],
    config,
    settings: undefined,
    surface: "cli",
    log: (message) => logs.push(message),
    warn: (message) => logs.push(`warning: ${message}`),
  };
  return { context, logs };
}

test("an ops composing no gates is rejected at define time — it would report a vacuous pass", () => {
  assert.throws(
    () => defineOps({ id: "empty", version: "1", summary: "s", gates: [] }),
    /composes no gates/,
  );
});

test("an ops naming an unresolvable gate fails before any gate runs", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-ops-"));
  const plugin = defineOps({
    id: "broken",
    version: "1",
    summary: "s",
    gates: [{ gate: "/nowhere/does-not-exist.mjs" }],
  });
  const { context, logs } = contextFor(repoRoot, {});
  await assert.rejects(() => plugin.run(context), /cannot load gate/);
  assert.deepEqual(logs, [], "no gate should have reported anything before the composition failed to load");
});

test("an entry declaring emits with a non-bare gate name must carry a label", () => {
  assert.throws(
    () =>
      defineOps({
        id: "x",
        version: "1",
        summary: "s",
        gates: [{ gate: "./local/gate.ts", emits: true }],
      }),
    /label/,
  );
});

test("two emitting entries cannot record under the same id", () => {
  assert.throws(
    () =>
      defineOps({
        id: "x",
        version: "1",
        summary: "s",
        gates: [
          { gate: "a", emits: true },
          { gate: "a", emits: true },
        ],
      }),
    /would record two different entries under "a"/,
  );
});

test("a finding is reported FAIL, and the run exits non-zero", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(
    dir,
    "always-fails",
    `{ findings: [{ rule: "always-fails", file: "x.md", evidence: "boom" }] }`,
  );
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "always-fails.mjs") }],
  });
  const { context, logs } = contextFor(dir, {});
  const result = await plugin.run(context);
  assert.equal(result.code, 1);
  assert.ok(logs.some((line) => line.includes("FAIL  [always-fails]")), logs.join("\n"));
});

test("--audit reports the same findings but always exits 0", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(dir, "always-fails", `{ findings: [{ rule: "always-fails", evidence: "boom" }] }`);
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "always-fails.mjs") }],
  });
  const { context } = contextFor(dir, {}, { audit: true });
  const result = await plugin.run(context);
  assert.equal(result.code, 0);
});

test("emission is doubly opt-in: no artifactDir means no file is written even when the entry emits", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(dir, "watcher", `{ findings: [], examined: 5 }`);
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "watcher.mjs"), emits: true, label: "watcher" }],
  });
  const artifactDir = path.join(dir, "artifacts");
  const { context } = contextFor(dir, {} /* no artifactDir */);
  await plugin.run(context);
  await assert.rejects(() => readFile(path.join(artifactDir, "demo.jsonl")));
});

test("zero examined writes nothing — a population of zero is not a reading", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(dir, "watcher", `{ findings: [], examined: 0 }`);
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "watcher.mjs"), emits: true, label: "watcher" }],
  });
  const artifactDir = path.join(dir, "artifacts");
  const { context } = contextFor(dir, { artifactDir });
  await plugin.run(context);
  await assert.rejects(() => readFile(path.join(artifactDir, "demo.jsonl")));
});

test("a non-zero population is recorded, and the record carries no verdict field", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(
    dir,
    "watcher",
    `{ findings: [{ rule: "watcher", evidence: "seen", level: "warn" }], examined: 3 }`,
  );
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "watcher.mjs"), emits: true, label: "watcher" }],
  });
  const artifactDir = path.join(dir, "artifacts");
  const { context } = contextFor(dir, { artifactDir });
  await plugin.run(context);
  const written = JSON.parse((await readFile(path.join(artifactDir, "demo.jsonl"), "utf8")).trim());
  assert.equal(written.id, "watcher");
  assert.equal(written.tags[0], "ops:demo");
  for (const forbidden of ["severity", "score", "pass", "verdict", "level"]) {
    assert.ok(!(forbidden in written.value), `an emitted observation must not carry a ${forbidden}`);
    assert.ok(!(forbidden in written), `an emitted observation must not carry a ${forbidden}`);
  }
});

test("--list prints every composed gate without running any of them", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(dir, "never-run", `{ findings: [{ rule: "never-run", evidence: "should not appear" }] }`);
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "never-run.mjs") }],
  });
  const { context, logs } = contextFor(dir, {}, { list: true });
  const result = await plugin.run(context);
  assert.equal(result.code, 0);
  // The array is the report. Its length is the count, so nothing states the count separately.
  const { gates } = result.data as { gates: { label: string; emits: boolean }[] };
  assert.equal(gates.length, 1);
  assert.equal(gates[0]!.label, path.join(dir, "never-run.mjs"));
  assert.equal(gates[0]!.emits, false);
  assert.ok(!logs.some((line) => line.includes("FAIL")));
});

test("a run returns every finding structured, not only in the log lines", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(dir, "noisy", `{ findings: [{ rule: "noisy", file: "a.md", line: 3, evidence: "bad" }] }`);
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "noisy.mjs") }],
  });
  const { context } = contextFor(dir, {}, {});
  const result = await plugin.run(context);
  const { findings } = result.data as { findings: Record<string, unknown>[] };
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0], {
    gate: path.join(dir, "noisy.mjs"),
    rule: "noisy",
    file: "a.md",
    line: 3,
    evidence: "bad",
    level: "fail",
  });
});

test("under MCP the report is in data, not in text a client will discard", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(dir, "noisy", `{ findings: [{ rule: "noisy", evidence: "bad" }] }`);
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "noisy.mjs") }],
  });
  const { context, logs } = contextFor(dir, {}, {});
  const mcp: ModuleContext = { ...context, surface: "mcp" };
  const result = await plugin.run(mcp);
  assert.equal(logs.length, 0, "printing under mcp duplicates what structuredContent already carries");
  assert.equal((result.data as { findings: unknown[] }).findings.length, 1);
});
