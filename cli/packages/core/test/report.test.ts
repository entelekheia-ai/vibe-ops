// The report shape is recognised, never registered: the terminal draws a block for whatever `data` passes
// `readReport`. So the guard has two ways to fail silently — narrowing until a producer's payload falls
// through to the summary line, or widening until a noun's payload is drawn as an empty report. One test
// per side.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isReport, readReport } from "../src/report.ts";
import type { OpsFinding, OpsPopulation, OpsRepair, OpsSkip } from "../src/ops.ts";

// Typed against the producer's own exports, so a change to what `runOps` returns breaks this file at
// typecheck rather than leaving it asserting a shape nothing produces any more.
const opsData = {
  findings: [
    { gate: "memory-slugs", rule: "slug", file: "docs/guide.md", line: 14, evidence: "names a memory slug", level: "fail" },
    { gate: "template-version-behind", rule: "behind", evidence: "declares plan@0.1", level: "warn" },
  ] satisfies OpsFinding[],
  skipped: [{ gate: "config-shadow", reason: "no managed layer" }] satisfies OpsSkip[],
  repaired: [] satisfies OpsRepair[],
  population: [{ gate: "memory-slugs", examined: 40, ignored: 1 }] satisfies OpsPopulation[],
};

// What `check` returns: the ops' findings re-keyed to `check`, the shell half's parsed alongside, and
// fields of its own the report ignores.
const checkData = {
  findings: [{ level: "warn", check: "template-version-behind", evidence: "project/plans/008.md:1: declares plan@0.1" }],
  skipped: [{ check: "file-path", reason: "this repository IS the private layer" }],
  undeclared: [],
  untracked: [],
  ops: [{ id: "governance", code: 0, gates: 12 }],
};

test("readReport accepts what runOps returns, and normalises gate to id", () => {
  const report = readReport(opsData);
  assert.ok(report);
  assert.deepEqual(report.findings[0], {
    id: "memory-slugs",
    level: "fail",
    evidence: "names a memory slug",
    file: "docs/guide.md",
    line: 14,
  });
  assert.deepEqual(report.skipped, [{ id: "config-shadow", reason: "no managed layer" }]);
});

test("readReport accepts what check returns, and normalises check to id", () => {
  const report = readReport(checkData);
  assert.ok(report);
  assert.deepEqual(report.findings, [
    { id: "template-version-behind", level: "warn", evidence: "project/plans/008.md:1: declares plan@0.1" },
  ]);
  assert.equal(report.skipped[0]!.id, "file-path");
});

test("a clean run is a report", () => {
  assert.deepEqual(readReport({ findings: [], skipped: [] }), { findings: [], skipped: [] });
});

test("the nouns' payloads are not reports", () => {
  // One of each shape the nouns return today: config get, ownership list, records resolve.
  assert.equal(isReport({ key: "check.disabled", value: {}, origin: "vibeops.config.ts", shadowedBy: [] }), false);
  assert.equal(isReport({ paths: [], conflicts: [], refusedNarrowings: [] }), false);
  assert.equal(isReport({ type: "adr", dir: "project/adr", next: "0023" }), false);
  assert.equal(isReport(undefined), false);
  assert.equal(isReport([]), false);
});

test("one malformed entry rejects the whole payload rather than dropping the entry", () => {
  assert.equal(isReport({ findings: [{ check: "x", level: "error", evidence: "e" }], skipped: [] }), false);
  assert.equal(isReport({ findings: [{ level: "fail", evidence: "no id" }], skipped: [] }), false);
  assert.equal(isReport({ findings: [], skipped: [{ check: "x" }] }), false);
  assert.equal(isReport({ findings: [{ gate: "g", level: "fail", evidence: "e", line: "14" }], skipped: [] }), false);
  // findings without skipped is half a report, and half is not one
  assert.equal(isReport({ findings: [] }), false);
});
