// defineGate's define-time rejections. Each one exists because the failure it prevents is silent: a
// malformed definition that loads produces a gate that runs and reports something plausible, and the
// disagreement between what a gate declares and what it does surfaces nowhere else.

import { test } from "node:test";
import assert from "node:assert/strict";
import { defineGate } from "../src/gate.ts";

const run = async () => ({ findings: [] });

test("a well-formed definition is accepted", () => {
  const gate = defineGate({ id: "thing", version: 1, summary: "one line" }, run);
  assert.equal(gate.definition.id, "thing");
  assert.equal(gate.definition.version, 1);
});

test("an id that is not lowercase-hyphenated is rejected", () => {
  assert.throws(() => defineGate({ id: "Thing", version: 1, summary: "s" }, run), /lowercase/);
});

test("an empty summary is rejected — it would be invisible in --list", () => {
  assert.throws(() => defineGate({ id: "thing", version: 1, summary: "  " }, run), /no summary/);
});

// The version is required so that it is present in the artifact that needed it. An optional one is
// absent exactly there, and by then the reading it would have qualified is already recorded.
test("a missing version is rejected at define time", () => {
  assert.throws(
    () => defineGate({ id: "thing", summary: "s" } as never, run),
    /must declare version as a whole number from 1/,
  );
});

test("version zero is rejected — the count of shapes starts at one", () => {
  assert.throws(() => defineGate({ id: "thing", version: 0, summary: "s" }, run), /whole number from 1/);
});

test("a non-integer version is rejected — two versions must not be orderable by fractions", () => {
  assert.throws(() => defineGate({ id: "thing", version: 1.5, summary: "s" }, run), /whole number from 1/);
});

test("fixable and fix() must be declared together, in both directions", () => {
  assert.throws(
    () => defineGate({ id: "thing", version: 1, summary: "s", fixable: true }, run),
    /declares fixable: true but defineGate was given no fix/,
  );
  assert.throws(
    () => defineGate({ id: "thing", version: 1, summary: "s" }, run, async () => []),
    /given a fix\(\) but does not declare fixable: true/,
  );
});

// loadGate is the boundary that matters for a gate this repository did not write: nothing obliges a
// third-party gate to have called defineGate, so the definition is re-checked where it enters.
test("loadGate rejects a gate that never called defineGate and carries no version", async () => {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = (await import("node:path")).default;
  const { loadGate } = await import("../src/gate.ts");

  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-loadgate-"));
  const file = path.join(dir, "rogue.mjs");
  await writeFile(
    file,
    'export default { definition: { id: "rogue", summary: "hand-rolled" }, run: async () => ({ findings: [] }) };\n',
  );
  await assert.rejects(() => loadGate(file), /must declare version as a whole number from 1/);
});
