// End-to-end: the real composition, against small fixture repos and against this repository's own
// checkout — the same shape ops-agents-md/test/ops.test.ts already uses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ops, { RESTATED_TYPE_ENTRIES } from "../src/index.ts";
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

test("--list composes every entry, in order: the record-header schemas, the template-version ones, then the rest", async () => {
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
      "template-version-research",
      "markdown-link",
      "breadcrumb",
      "fragment-parity",
    ],
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
  assert.ok(
    logs.some((line) => line.includes("SKIP  [template-version-research]")),
    "research is excluded by a stated reason, never by silence",
  );
});

// THE GUARD THAT MAKES THE DUPLICATION SAFE, and it is temporary by construction (Plan-030 Track 2).
// Each entry restates the `required` list its type's manifest already declares, because Track 3 has not
// yet derived these entries from the installed units. Until it does, a manifest edited without its entry
// — or the reverse — would diverge in silence: both files stay individually well-formed, and the gate
// keeps reporting against whichever list it was handed. Track 3 deletes the literals and this test in
// the same change.
//
// Asserted against the exported entries themselves rather than against `--list` output, which carries no
// options: a copy of the object could not prove anything about the object.
test("every entry's required list still agrees with the type unit it restates", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const { readFileSync } = await import("node:fs");
  const index = JSON.parse(readFileSync(path.join(repoRoot, "plugin", "types", "index.json"), "utf8")) as Record<
    string,
    { schema: { required: readonly string[] } }
  >;

  assert.ok(RESTATED_TYPE_ENTRIES.length > 0, "there are entries carrying a restated field list");
  for (const entry of RESTATED_TYPE_ENTRIES) {
    const type = entry.options?.["type"] as string | undefined;
    assert.ok(type !== undefined, `${entry.label} declares no options.type`);
    const declared = index[type]?.schema.required;
    assert.ok(declared !== undefined, `plugin/types/index.json has no entry for "${type}"`);
    assert.deepEqual(
      entry.options?.["required"],
      declared,
      `${entry.label} restates a field list that plugin/types/${type}/type.json no longer declares`,
    );
    assert.equal(entry.label, `${entry.gate}-${type}`, "label and rule must coincide — config keys on both");
  }
});
