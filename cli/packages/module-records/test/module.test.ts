import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import records from "../src/index.ts";

test("records is a flat module — no commands declared, unlike plan/task/log", () => {
  assert.equal(records.definition.commands, undefined);
});

test("an unknown --type fails naming the valid set", async () => {
  const result = await records.run({
    repoRoot: "/does/not/matter",
    flags: { type: "wat" },
    args: [],
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /adr, rfc, plan, task/);
});

test("--type adr resolves the same way module-plan resolves plan — one library underneath both", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-records-module-"));
  const result = await records.run({
    repoRoot: repo,
    flags: { type: "adr" },
    args: [],
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
  assert.equal(result.code, 0);
  assert.equal((result.data as { type: string }).type, "adr");
});
