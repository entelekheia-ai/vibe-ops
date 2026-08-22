// End-to-end: the real composition, against small fixture repos and against this repository's own
// checkout — the same shape ops-agents-md/test/ops.test.ts already uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ops from "../src/index.ts";
import { loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-governance-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.email", "test@example.com"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.name", "test"]);
  return repoRoot;
}

function gitAdd(repoRoot: string): void {
  spawnSync("git", ["-C", repoRoot, "add", "-A"]);
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
    settings: settingsFor(config, "governance"),
    surface: "cli",
    log: (message) => logs.push(message),
    warn: (message) => logs.push(`warning: ${message}`),
  };
  return { context, logs };
}

// The per-type entries here are DERIVED from the activated governances (Plan-034) — an empty config
// activates the five shipped defaults, so this order is the derivation's own: carrier groups sorted by
// name (table, then frontmatter), the order the hand-written list had. `template-version-research` is
// gone by design: no governance package serves research, so nothing derives it — the one declared
// output difference of Plan-034.
test("--list composes every entry, in order: the derived record schemas, the derived template-versions, then the static rest", async () => {
  const repoRoot = await gitRepo();
  gitAdd(repoRoot);
  const { context } = contextFor(repoRoot, {}, { list: true });
  const result = await ops.run(context);
  const data = result.data as { gates: readonly { label: string }[] };
  assert.deepEqual(
    data.gates.map((g) => g.label),
    [
      "record-header-adr",
      "record-header-plan",
      "record-header-rfc",
      "record-header-task",
      "record-frontmatter-log",
      "template-version-adr",
      "template-version-plan",
      "template-version-rfc",
      "template-version-task",
      "template-version-log",
      "markdown-link",
      "breadcrumb",
      "fragment-parity",
    ],
  );
});

// Plan-034's acceptance: a repository binding a sixth governance package sees its entries appear with
// zero edits to this ops. The "package" is the smallest activation object core accepts — root plus a
// parsed unit — bound by an absolute path, which parseBinding passes to import() verbatim.
test("a governance package bound in config derives its entries with no edit to this ops", async () => {
  const repoRoot = await gitRepo();
  gitAdd(repoRoot);
  const pkg = await mkdtemp(path.join(tmpdir(), "vibeops-governance-note-"));
  await mkdir(path.join(pkg, "templates"), { recursive: true });
  await writeFile(path.join(pkg, "templates", "note.md"), "---\nvibe-ops-template: note@1\n---\n\n# Note\n");
  await writeFile(
    path.join(pkg, "index.mjs"),
    `export default { root: ${JSON.stringify(pkg)}, unit: { type: "note", template: "./templates/note.md", ` +
      `authoring: "./authoring.md", migrations: "./migrations", ` +
      `schema: { carrier: "table", required: ["Status"] }, numbered: false, pad: 0, depth: 1, dirs: ["project/note"] } };`,
  );

  const config = { types: { note: path.join(pkg, "index.mjs") } } as VibeOpsConfig;
  const { context } = contextFor(repoRoot, config, { list: true });
  const result = await ops.run(context);
  const labels = (result.data as { gates: readonly { label: string }[] }).gates.map((g) => g.label);
  assert.ok(labels.includes("record-header-note"), labels.join(", "));
  assert.ok(labels.includes("template-version-note"), labels.join(", "));
});

// The other half of the derivation contract: a binding whose package does not resolve is a statement
// in the run's own report — the channel a disabled entry uses — never a silent gap in the entry list.
test("a bound type whose package does not resolve is a skip naming the package, never a silent gap", async () => {
  const repoRoot = await gitRepo();
  gitAdd(repoRoot);
  const config = { types: { plan: "@entelekheia/governance-does-not-exist" } } as VibeOpsConfig;
  const { context } = contextFor(repoRoot, config, {});
  const result = await ops.run(context);
  const skipped = (result.data as { skipped: readonly { gate: string; reason: string }[] }).skipped;
  const planSkips = skipped.filter((s) => s.gate.endsWith("-plan"));
  assert.equal(planSkips.length, 2, JSON.stringify(skipped));
  for (const skip of planSkips) assert.match(skip.reason, /@entelekheia\/governance-does-not-exist/);
});

test("an adr missing a required field fails record-header-adr, naming the field", async () => {
  const repoRoot = await gitRepo();
  await mkdir(path.join(repoRoot, "project", "adr"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "project", "adr", "0001-x.md"),
    ["# ADR-0001: X", "", "| Field | Value |", "|---|---|", "| Status | Accepted |", "", "## Context", ""].join("\n"),
  );
  gitAdd(repoRoot);

  const { context, logs } = contextFor(repoRoot, {}, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 1);
  assert.ok(logs.some((line) => line.includes("FAIL  [record-header-adr]") && line.includes("Date")), logs.join("\n"));
});

// The fixture is FLAT — no plugin/ directory — on purpose. `template-version` is handed
// `<plugin>/templates/adr.md`, which expands to the repository root here and to `plugin/` in a repo
// shaped like this one. Hardcoding either layout makes the pair unreachable in the other, and a flat
// fixture is the only thing that catches it.
test("a clean repository with correctly-shaped records passes every entry", async () => {
  const repoRoot = await gitRepo();
  await mkdir(path.join(repoRoot, "project", "adr"), { recursive: true });
  await mkdir(path.join(repoRoot, "templates"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "templates", "adr.md"),
    ["---", "vibe-ops-template: adr@2", "---", "", "# ADR-NNNN: Title", ""].join("\n"),
  );
  await writeFile(
    path.join(repoRoot, "project", "adr", "0001-x.md"),
    ["---", "vibe-ops-template: adr@2", "---", "", "# ADR-0001: X", "", "| Field | Value |", "|---|---|", "| Status | Accepted |", "| Date | 2026-08-10 |", "| Deciders | Someone |", "", "## Context", "", "body.", ""].join("\n"),
  );
  gitAdd(repoRoot);

  const { context, logs } = contextFor(repoRoot, {}, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  assert.ok(!logs.some((line) => line.includes("FAIL")), logs.join("\n"));
});

test("a record declaring no version fails the run, rather than being read as the oldest shape", async () => {
  const repoRoot = await gitRepo();
  await mkdir(path.join(repoRoot, "project", "adr"), { recursive: true });
  await mkdir(path.join(repoRoot, "templates"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "templates", "adr.md"),
    ["---", "vibe-ops-template: adr@2", "---", "", "# ADR-NNNN: Title", ""].join("\n"),
  );
  await writeFile(
    path.join(repoRoot, "project", "adr", "0001-x.md"),
    ["# ADR-0001: X", "", "| Field | Value |", "|---|---|", "| Status | Accepted |", "| Date | 2026-08-10 |", "| Deciders | Someone |", "", "## Context", "", "body.", ""].join("\n"),
  );
  gitAdd(repoRoot);

  const { context, logs } = contextFor(repoRoot, {}, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 1);
  assert.ok(logs.some((line) => line.startsWith("FAIL  [template-version-undeclared]")), logs.join("\n"));
});

// This one loads the repository's REAL vibeops.config.ts rather than a copy of its settings written out
// here. The copy is what this test used to carry, and it is the same duplication the ops's own `ignore`
// exists to remove: an exclusion declared in two places drifts, and the copy is always the stale one.
// Adding a `disabled` entry to the real config is what surfaced it — the test went red while the tree
// was correct.
test("against this repository's own checkout, under its own config — nothing fails", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const { config } = await loadConfig(repoRoot);
  const { context, logs } = contextFor(repoRoot, config, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  assert.ok(logs.some((line) => line.includes("ok    [markdown-link]") && line.includes("ignored")), logs.join("\n"));
});

// Warnings are not failures, and this repository has real ones: every plan still at plan@0.1 is behind
// and says so. Asserted rather than left implicit, because "0 failed" alone would also be true of a run
// that had stopped looking.
test("against this repository's own checkout — records behind their template warn, and do not fail", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const { config } = await loadConfig(repoRoot);
  const { context, logs } = contextFor(repoRoot, config, { verbose: true });
  await ops.run(context);
  assert.ok(
    logs.some((line) => line.startsWith("WARN  [template-version-behind]")),
    "expected at least one record behind its template, reported as a warning",
  );
});

// The guard that held the hand-written `required` literals to each type's own manifest lived here
// until Plan-034 derived the entries from the activated governances — the literals and the guard were
// deleted together, superseded by the derivation itself: an entry computed from the manifest cannot
// disagree with it.
