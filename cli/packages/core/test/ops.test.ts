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

/**
 * A gate whose `run` reports a finding until its `fix` has run — a marker file on disk stands in for
 * "the thing this gate checks is now fixed", so re-running `run` after `fix` genuinely re-examines
 * state rather than the test asserting on a call count.
 */
async function writeMarkerGate(dir: string, id: string, marker: string): Promise<string> {
  const file = path.join(dir, `${id}.mjs`);
  await writeFile(
    file,
    `import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
export default {
  definition: { id: "${id}", summary: "fake", fixable: true },
  run: async (ctx) => {
    const at = path.join(ctx.repoRoot, "${marker}");
    return { findings: existsSync(at) ? [] : [{ rule: "${id}", evidence: "needs fixing" }] };
  },
  fix: async (ctx) => {
    writeFileSync(path.join(ctx.repoRoot, "${marker}"), "fixed\\n");
    return [{ file: "${marker}", action: "created marker" }];
  },
};
`,
  );
  return file;
}

function contextFor(
  repoRoot: string,
  config: VibeOpsConfig,
  flags: Record<string, string | boolean> = {},
  settings: unknown = undefined,
): {
  context: ModuleContext;
  logs: string[];
} {
  const logs: string[] = [];
  const context: ModuleContext = {
    repoRoot,
    flags,
    args: [],
    config,
    settings,
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

test("--file scopes to exactly one path, and does not require it to be tracked", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(dir, "seer", `{ findings: ctx.files.map((f) => ({ rule: "seer", file: f, evidence: f })) }`);
  await writeFile(path.join(dir, "elsewhere.md"), "should not be seen\n");
  await writeFile(path.join(dir, "only-this.md"), "never git-added — untracked on purpose\n");
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "seer.mjs") }],
  });
  const { context } = contextFor(dir, {}, { file: "only-this.md" });
  const result = await plugin.run(context);
  const { findings } = result.data as { findings: { file?: string }[] };
  assert.deepEqual(findings.map((f) => f.file), ["only-this.md"]);
});

test("--fix bare repairs every fixable gate the composition contains", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  const a = await writeMarkerGate(dir, "fixable-a", "a.marker");
  const b = await writeMarkerGate(dir, "fixable-b", "b.marker");
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: a }, { gate: b }],
  });
  const { context } = contextFor(dir, {}, { fix: "all" });
  const result = await plugin.run(context);
  const { findings, repaired } = result.data as { findings: unknown[]; repaired: { gate: string }[] };
  assert.equal(result.code, 0);
  assert.deepEqual(findings, []);
  assert.deepEqual(
    repaired.map((r) => r.gate).sort(),
    [a, b].sort(),
  );
});

test("--fix <label> repairs only that entry, leaving an unnamed fixable gate still failing", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  const a = await writeMarkerGate(dir, "fixable-a", "a.marker");
  const b = await writeMarkerGate(dir, "fixable-b", "b.marker");
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [
      { gate: a, label: "only-a" },
      { gate: b, label: "only-b" },
    ],
  });
  const { context } = contextFor(dir, {}, { fix: "only-a" });
  const result = await plugin.run(context);
  const { findings, repaired } = result.data as {
    findings: { gate: string }[];
    repaired: { gate: string }[];
  };
  assert.equal(result.code, 1, "only-b is still failing — the run must not report a false green");
  assert.deepEqual(repaired.map((r) => r.gate), ["only-a"]);
  assert.deepEqual(findings.map((f) => f.gate), ["only-b"]);
});

test("--fix naming a gate the composition does not contain fails before any gate runs", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  const a = await writeMarkerGate(dir, "fixable-a", "a.marker");
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: a, label: "only-a" }],
  });
  const { context } = contextFor(dir, {}, { fix: "nosuchgate" });
  await assert.rejects(() => plugin.run(context), /has no gate named "nosuchgate"/);
  await assert.rejects(() => readFile(path.join(dir, "a.marker")), "the named gate's fix must not have run either");
});

test("--fix naming a gate that is not fixable warns and repairs nothing", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-fixture-"));
  await writeFakeGate(dir, "budget", `{ findings: [{ rule: "budget", evidence: "over" }] }`);
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "budget.mjs"), label: "budget" }],
  });
  const { context, logs } = contextFor(dir, {}, { fix: "budget" });
  const result = await plugin.run(context);
  const { repaired } = result.data as { repaired: unknown[] };
  assert.deepEqual(repaired, []);
  assert.equal(result.code, 1, "the finding it could not fix must still be reported as failing");
  assert.ok(logs.some((line) => line.includes(`--fix named "budget", which is not fixable`)), logs.join("\n"));
});

// `level` — the repository's call, not the detector's.
//
// A gate declaring `warn` is declaring a DEFAULT. Before this existed, that default was final: a gate
// that warns because a migration is in flight had no way to hold the line once the migration finished,
// short of editing the gate that every other repository also loads.

/** A gate that raises two rules under one label, so per-rule targeting is actually observable. */
async function writeTwoRuleGate(dir: string, id: string): Promise<string> {
  return writeFakeGate(
    dir,
    id,
    `{ findings: [
        { rule: "soft", evidence: "a", level: "warn" },
        { rule: "hard", evidence: "b" }
      ], examined: 1 }`,
  );
}

async function runWithLevel(level: Record<string, "fail" | "warn"> | undefined) {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-level-"));
  await writeTwoRuleGate(dir, "watcher");
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "watcher.mjs"), label: "entry" }],
  });
  const { context, logs } = contextFor(dir, {}, { verbose: true }, level === undefined ? undefined : { level });
  const result = await plugin.run(context);
  return { result, logs };
}

test("with no config, a gate's declared level stands: warn does not fail the run", async () => {
  const { result, logs } = await runWithLevel(undefined);
  assert.equal(result.code, 1, "the un-declared finding still fails");
  assert.ok(logs.some((l) => l.startsWith("WARN  [soft]")), logs.join("\n"));
  assert.ok(logs.some((l) => l.startsWith("FAIL  [hard]")), logs.join("\n"));
});

test("level keyed by rule overrides what the gate declared", async () => {
  const { logs } = await runWithLevel({ soft: "fail" });
  assert.ok(logs.some((l) => l.startsWith("FAIL  [soft]")), logs.join("\n"));
});

test("level keyed by rule can also soften a finding the gate left at fail", async () => {
  const { result, logs } = await runWithLevel({ hard: "warn", soft: "warn" });
  assert.equal(result.code, 0, "nothing fails once both rules are warnings");
  assert.ok(logs.some((l) => l.startsWith("WARN  [hard]")), logs.join("\n"));
});

test("level keyed by the entry's label covers every rule it raises", async () => {
  const { result } = await runWithLevel({ entry: "warn" });
  assert.equal(result.code, 0);
});

test('level keyed by "*" covers every entry in the ops', async () => {
  const { result } = await runWithLevel({ "*": "warn" });
  assert.equal(result.code, 0);
});

test("most specific wins: rule beats label beats star", async () => {
  const { logs } = await runWithLevel({ "*": "warn", entry: "warn", hard: "fail" });
  assert.ok(logs.some((l) => l.startsWith("FAIL  [hard]")), logs.join("\n"));
  assert.ok(logs.some((l) => l.startsWith("WARN  [soft]")), logs.join("\n"));
});

test("an overridden level still never reaches the emitted observation", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ops-level-emit-"));
  await writeTwoRuleGate(dir, "watcher");
  const plugin = defineOps({
    id: "demo",
    version: "1",
    summary: "s",
    gates: [{ gate: path.join(dir, "watcher.mjs"), label: "entry", emits: true }],
  });
  const artifactDir = path.join(dir, "artifacts");
  const { context } = contextFor(dir, { artifactDir }, {}, { level: { soft: "fail" } });
  await plugin.run(context);
  const written = JSON.parse((await readFile(path.join(artifactDir, "demo.jsonl"), "utf8")).trim());
  assert.ok(!("level" in written), "a verdict must not travel with an observation");
  assert.ok(!("level" in (written.value as object)), "a verdict must not travel with an observation");
});
