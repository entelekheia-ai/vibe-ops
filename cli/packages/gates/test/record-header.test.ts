import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import recordHeader from "../src/record-header/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-record-header-"));
}

function ctx(repoRoot: string, files: readonly string[], schema: string): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: { schema }, documents: createDocumentStore(repoRoot) };
}

const ADR_HEADER = ["# ADR-0001: A title", "", "| Field | Value |", "|---|---|", "| Status | Accepted |", "| Date | 2026-08-10 |", "| Deciders | Someone |", "", "## Context", "", "body.", ""].join("\n");

test("a header table declaring every required field passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "0001-a.md"), ADR_HEADER);
  const outcome = await recordHeader.run(ctx(repoRoot, ["0001-a.md"], "adr"));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("a header table missing a required field fails, naming it", async () => {
  const repoRoot = await repo();
  const content = ["# ADR-0002: A title", "", "| Field | Value |", "|---|---|", "| Status | Accepted |", "| Date | 2026-08-10 |", "", "## Context", ""].join("\n");
  await writeFile(path.join(repoRoot, "0002-a.md"), content);
  const outcome = await recordHeader.run(ctx(repoRoot, ["0002-a.md"], "adr"));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /Deciders/);
});

test("no table at all before the first level-2 heading fails, not silently passes", async () => {
  const repoRoot = await repo();
  const content = ["# A title", "", "no table here.", "", "## Context", "", "body.", ""].join("\n");
  await writeFile(path.join(repoRoot, "0003-a.md"), content);
  const outcome = await recordHeader.run(ctx(repoRoot, ["0003-a.md"], "adr"));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /no header table/);
});

// The discriminator this gate exists for: a content table AFTER the first level-2 heading must never
// be mistaken for the header table just because it is "the first pipe_table" in the document.
test("a content table after the first level-2 heading is not mistaken for the header table", async () => {
  const repoRoot = await repo();
  const content = [
    "# A title",
    "",
    "intro, no header table.",
    "",
    "## Measurements",
    "",
    "| Field | Value |",
    "|---|---|",
    "| x | 1 |",
    "",
  ].join("\n");
  await writeFile(path.join(repoRoot, "0004-a.md"), content);
  const outcome = await recordHeader.run(ctx(repoRoot, ["0004-a.md"], "adr"));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /no header table/);
});

test("plan/rfc share required fields; task additionally requires Issue", async () => {
  const repoRoot = await repo();
  const withoutIssue = ["# Plan", "", "| Field | Value |", "|---|---|", "| Status | Planned |", "| Created | 2026-08-10 |", "| Author | Someone |", "", "## Context", ""].join("\n");
  await writeFile(path.join(repoRoot, "plan.md"), withoutIssue);
  await writeFile(path.join(repoRoot, "task.md"), withoutIssue);

  const planOutcome = await recordHeader.run(ctx(repoRoot, ["plan.md"], "plan"));
  assert.deepEqual(planOutcome.findings, []);

  const rfcOutcome = await recordHeader.run(ctx(repoRoot, ["plan.md"], "rfc"));
  assert.deepEqual(rfcOutcome.findings, []);

  const taskOutcome = await recordHeader.run(ctx(repoRoot, ["task.md"], "task"));
  assert.equal(taskOutcome.findings.length, 1);
  assert.match(taskOutcome.findings[0]!.evidence, /Issue/);
});

test("against this repository's own real records — every adr, plan and rfc passes", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const { readdirSync } = await import("node:fs");
  const adrFiles = readdirSync(path.join(repoRoot, "project", "adr")).filter((f) => f.endsWith(".md")).map((f) => `project/adr/${f}`);
  const planFiles = readdirSync(path.join(repoRoot, "project", "plans")).filter((f) => f.endsWith(".md")).map((f) => `project/plans/${f}`);

  const adrOutcome = await recordHeader.run(ctx(repoRoot, adrFiles, "adr"));
  assert.deepEqual(adrOutcome.findings, [], JSON.stringify(adrOutcome.findings));

  const planOutcome = await recordHeader.run(ctx(repoRoot, planFiles, "plan"));
  assert.deepEqual(planOutcome.findings, [], JSON.stringify(planOutcome.findings));
});
