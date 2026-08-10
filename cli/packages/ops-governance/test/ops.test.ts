// End-to-end: the real composition, against small fixture repos and against this repository's own
// checkout — the same shape ops-agents-md/test/ops.test.ts already uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ops from "../src/index.ts";
import { settingsFor } from "@entelekheia/vibe-ops-core";
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

test("--list composes seven entries: four record-header schemas, markdown-link, breadcrumb, fragment-parity", async () => {
  const repoRoot = await gitRepo();
  gitAdd(repoRoot);
  const { context } = contextFor(repoRoot, {}, { list: true });
  const result = await ops.run(context);
  const data = result.data as { gates: readonly { label: string }[] };
  assert.deepEqual(
    data.gates.map((g) => g.label),
    ["record-header-adr", "record-header-plan", "record-header-rfc", "record-header-task", "markdown-link", "breadcrumb", "fragment-parity"],
  );
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

test("a clean repository with correctly-shaped records passes all seven entries", async () => {
  const repoRoot = await gitRepo();
  await mkdir(path.join(repoRoot, "project", "adr"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "project", "adr", "0001-x.md"),
    ["# ADR-0001: X", "", "| Field | Value |", "|---|---|", "| Status | Accepted |", "| Date | 2026-08-10 |", "| Deciders | Someone |", "", "## Context", "", "body.", ""].join("\n"),
  );
  gitAdd(repoRoot);

  const { context, logs } = contextFor(repoRoot, {}, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0);
  assert.ok(!logs.some((line) => line.includes("FAIL")), logs.join("\n"));
});

test("against this repository's own checkout — a clean run, with population reported", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const { context, logs } = contextFor(
    repoRoot,
    { settings: { governance: { ignore: { "*": ["**/templates/**"] } } } },
    { verbose: true },
  );
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  assert.ok(logs.some((line) => line.includes("ok    [markdown-link]") && line.includes("ignored")), logs.join("\n"));
});
