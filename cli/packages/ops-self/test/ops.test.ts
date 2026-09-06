// End-to-end: the real composition, against this repository's own checkout under its own config, and
// against the fixture each entry declares — the same shape ops-governance/test/ops.test.ts uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import ops, { UNSTATED_DESTINATION_NOTES } from "../src/index.ts";
import { createDocumentStore, loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext, VibeOpsConfig } from "@entelekheia/vibe-ops-core";

function contextFor(
  repoRoot: string,
  config: VibeOpsConfig,
  flags: Record<string, string | boolean> = {},
): { context: ModuleContext; logs: string[] } {
  const logs: string[] = [];
  return {
    logs,
    context: {
      repoRoot,
      flags,
      args: [],
      config,
      settings: settingsFor(config, "self"),
      surface: "cli",
      log: (message) => logs.push(message),
      warn: (message) => logs.push(`warning: ${message}`),
    },
  };
}

const REPO = path.resolve(import.meta.dirname, "..", "..", "..", "..");

test("--list composes the entries this ops owns", async () => {
  const { context } = contextFor(REPO, {}, { list: true });
  const result = await ops.run(context);
  const data = result.data as { gates: readonly { label: string }[] };
  // Four entries since Plan-032 Track 5 added the three config-cascade gates beside
  // `unstated-destination` — each with its own fixture, asserted below by the self-test entry.
  assert.deepEqual(data.gates.map((gate) => gate.label), [
    "unstated-destination",
    "config-shadow",
    "config-managed-committed",
    "config-state-leftover",
  ]);
});

// The remaining entry reads the migration notes as its SUBJECT rather than as an authority, so the
// population question that split this package out is now asserted in ops-mirror's test, beside the entry
// it belongs to.
test("against this repository's own checkout, under its own config — nothing fails", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  assert.ok(
    logs.some((line) => line.includes("ok    [unstated-destination]") && line.includes("examined")),
    logs.join("\n"),
  );
});

test("the notes are examined, not swept past — zero examined is not a reading", async () => {
  const { config } = await loadConfig(REPO);
  const { context } = contextFor(REPO, config, {});
  const result = await ops.run(context);
  const data = result.data as { population: readonly { gate: string; examined: number }[] };
  const notes = data.population.find((entry) => entry.gate === "unstated-destination");
  assert.ok((notes?.examined ?? 0) > 0, JSON.stringify(data.population));
});

test("every entry that declares a fixture still fires on it", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { "self-test": true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  const data = result.data as { cases: readonly { label: string; fired: boolean; skipped?: string }[] };
  const covered = data.cases.filter((one) => one.skipped === undefined);
  assert.ok(covered.length > 0, "this ops must carry at least one fixture");
  assert.ok(covered.every((one) => one.fired), JSON.stringify(data.cases));
});

// The fixture runner asserts only that the expected rule fired, which a gate firing on every
// `**dropped**` row would also satisfy. This asserts the other direction on the same two notes: exactly
// one finding, and it names the note that states no destination — the decoy, which drops a section and
// routes it, must stay silent. Observed red before green: with the violating note's body replaced by the
// decoy's, this assertion fails on the count.
test("unstated-destination fires on the note that states no destination, and not on the one that does", async () => {
  const gate = (await import("@entelekheia/vibe-ops-gates/unstated-destination")).default;

  const root = await mkdtemp(path.join(tmpdir(), "vibeops-unstated-"));
  const repoRoot = await import("node:fs/promises").then((fs) => fs.realpath(root));
  for (const [name, body] of Object.entries(UNSTATED_DESTINATION_NOTES)) {
    await mkdir(path.dirname(path.join(repoRoot, name)), { recursive: true });
    await writeFile(path.join(repoRoot, name), body);
  }
  const outcome = await gate.run({
    repoRoot,
    pluginDir: repoRoot,
    files: Object.keys(UNSTATED_DESTINATION_NOTES),
    options: {},
    documents: createDocumentStore(repoRoot),
  });

  assert.equal(outcome.findings.length, 1, JSON.stringify(outcome.findings));
  assert.match(outcome.findings[0]!.file!, /plan-0\.1-to-0\.2\.md$/);
  assert.match(outcome.findings[0]!.evidence, /never mentions it outside the shape table/);
  assert.equal(outcome.examined, 2);
});
