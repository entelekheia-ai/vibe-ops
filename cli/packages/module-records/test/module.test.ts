import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import records from "../src/index.ts";

test("records is a noun with verbs, like plan/task/log — and none of them is destructive", () => {
  // It was flat until 2026-08-12, with `census` and `handling` as booleans. Three flags of which exactly
  // one may be true is a union encoded as booleans, and the exclusivity lived in the order the `if`s were
  // written rather than in any type — `--census --handling` resolved silently to census. As verbs it
  // cannot be constructed, and the MCP schema is an enum with a summary each instead of three flags that
  // read as independent.
  assert.deepEqual(
    records.definition.commands?.map((c) => c.name),
    ["resolve", "census", "handling"],
  );
  assert.deepEqual(
    records.definition.commands?.filter((c) => c.destructive === true),
    [],
    "every verb here reads; nothing under records mutates anything",
  );
});

test("an unknown --type fails naming the valid set", async () => {
  const result = await records.run({
    repoRoot: "/does/not/matter",
    flags: { type: "wat" },
    command: "resolve",
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

test("resolve --type adr resolves the same way module-plan resolves plan — one library underneath both", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-records-module-"));
  const result = await records.run({
    repoRoot: repo,
    flags: { type: "adr" },
    command: "resolve",
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
