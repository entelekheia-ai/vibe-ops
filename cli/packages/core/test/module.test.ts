import { test } from "node:test";
import assert from "node:assert/strict";
import { defineModule } from "../src/module.ts";
import { createEmitter } from "../src/emit.ts";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ok = async () => ({ code: 0, summary: "ok" });

test("a module id must be lowercase and hyphenated", () => {
  assert.throws(() => defineModule({ id: "Check", version: "1", summary: "x" }, ok), /lowercase/);
  assert.throws(() => defineModule({ id: "9lives", version: "1", summary: "x" }, ok), /lowercase/);
  assert.doesNotThrow(() => defineModule({ id: "plan-end", version: "1", summary: "x" }, ok));
});

test("a module with no summary is rejected — it would be invisible in --help and in MCP", () => {
  assert.throws(() => defineModule({ id: "x", version: "1", summary: "  " }, ok), /summary/);
});

test("a module declaring an empty commands array is rejected — omit the field instead", () => {
  assert.throws(() => defineModule({ id: "x", version: "1", summary: "s", commands: [] }, ok), /empty commands/);
});

// Plan-027 Track 1 added `required` and `choices` so a flag's domain and its necessity are declared
// rather than re-checked inside each verb that reads it — `records` carried the same `--type` conditional
// twice, byte-identical. A declaration that contradicts itself must therefore fail at load, where every
// surface sees it, and not at the one call that happens to exercise the contradiction.
test("a flag declaring choices it cannot have is rejected at load, not at the call that hits it", () => {
  const withFlag = (flag: Parameters<typeof defineModule>[0]["flags"]) =>
    defineModule({ id: "x", version: "1", summary: "s", flags: flag }, ok);

  assert.throws(
    () => withFlag([{ name: "loud", type: "boolean", description: "d", choices: ["yes", "no"] }]),
    /already closed/,
    "a boolean's domain is closed by its type; a choices list on one is two answers to one question",
  );
  assert.throws(
    () => withFlag([{ name: "type", type: "string", description: "d", choices: [] }]),
    /unreachable/,
  );
  assert.throws(
    () => withFlag([{ name: "type", type: "string", description: "d", required: true, default: "adr" }]),
    /satisfies it for free/,
    "a default makes the flag always present, so declaring it required asserts nothing",
  );
  assert.doesNotThrow(() =>
    withFlag([{ name: "type", type: "string", description: "d", required: true, choices: ["adr", "rfc"] }]),
  );
});

test("a verb's own flags are checked the same way the module's are", () => {
  assert.throws(
    () =>
      defineModule(
        {
          id: "x",
          version: "1",
          summary: "s",
          commands: [{ name: "resolve", summary: "a", flags: [{ name: "t", type: "boolean", description: "d", choices: ["a"] }] }],
        },
        ok,
      ),
    /command "resolve" declares choices/,
  );
});

test("a duplicated command name is rejected", () => {
  assert.throws(
    () =>
      defineModule(
        {
          id: "x",
          version: "1",
          summary: "s",
          commands: [
            { name: "status", summary: "a" },
            { name: "status", summary: "b" },
          ],
        },
        ok,
      ),
    /command "status" twice/,
  );
});

test("a command name must be lowercase and hyphenated, same as a module id", () => {
  assert.throws(
    () => defineModule({ id: "x", version: "1", summary: "s", commands: [{ name: "Status", summary: "a" }] }, ok),
    /lowercase/,
  );
});

test("a command with no summary is rejected", () => {
  assert.throws(
    () => defineModule({ id: "x", version: "1", summary: "s", commands: [{ name: "status", summary: "  " }] }, ok),
    /no summary/,
  );
});

test("a duplicated flag within one command is rejected", () => {
  assert.throws(
    () =>
      defineModule(
        {
          id: "x",
          version: "1",
          summary: "s",
          commands: [
            {
              name: "close",
              summary: "a",
              flags: [
                { name: "fix", type: "boolean", description: "d" },
                { name: "fix", type: "string", description: "d" },
              ],
            },
          ],
        },
        ok,
      ),
    /declares --fix twice/,
  );
});

test("a well-formed commands array is accepted", () => {
  assert.doesNotThrow(() =>
    defineModule(
      {
        id: "plan",
        version: "1",
        summary: "s",
        commands: [
          { name: "resolve", summary: "resolves the layout" },
          { name: "close", summary: "closes it", destructive: true },
        ],
      },
      ok,
    ),
  );
});

test("a duplicated flag is rejected", () => {
  assert.throws(
    () =>
      defineModule(
        {
          id: "x",
          version: "1",
          summary: "s",
          flags: [
            { name: "a", type: "boolean", description: "d" },
            { name: "a", type: "string", description: "d" },
          ],
        },
        ok,
      ),
    /twice/,
  );
});

test("emitting an id the module does not declare throws instead of being recorded", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-emit-"));
  const emit = createEmitter({
    artifactDir: dir,
    moduleId: "m",
    moduleVersion: "1",
    repoRoot: "/repo",
    declared: ["known"],
    now: () => "2026-01-01T00:00:00.000Z",
  });
  await assert.rejects(
    () => emit({ id: "unknown", tool: "g@1", examined: 1, unit: "file", counts: {}, moment: "sweep" }),
    /does not declare/,
  );
});

test("an observation records what was seen and carries no verdict field", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-emit2-"));
  const emit = createEmitter({
    artifactDir: dir,
    moduleId: "m",
    moduleVersion: "1",
    repoRoot: "/tmp/repo",
    declared: ["count"],
    now: () => "2026-01-01T00:00:00.000Z",
  });
  await emit({
    id: "count",
    tool: "budget@1",
    examined: 3,
    unit: "file",
    counts: { "over-budget": 2 },
    moment: "sweep",
  });
  const lines = (await readFile(path.join(dir, "m.count.jsonl"), "utf8")).trim().split("\n");
  const header = JSON.parse(lines[0]!);
  assert.equal(header.kind, "gate", "the receiving side refuses an artifact that does not open with one");
  assert.equal(header.producer, "count");
  assert.equal(header.tool, "budget@1", "the instrument is the gate, with its own version");
  assert.equal(header.composition, "m@1");
  assert.equal(header.population.examined, 3);
  assert.deepEqual(JSON.parse(lines[1]!), { kind: "finding", rule: "over-budget", count: 2 });
  for (const forbidden of ["severity", "score", "pass", "verdict", "level"]) {
    assert.ok(!(forbidden in header), `a producer must not record a ${forbidden}`);
  }
});

test("a rule that found nothing has no line at all — absence is how zero is written", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-emit3-"));
  const emit = createEmitter({
    artifactDir: dir,
    moduleId: "m",
    moduleVersion: "1",
    repoRoot: "/tmp/repo",
    declared: ["count"],
    now: () => "2026-01-01T00:00:00.000Z",
  });
  await emit({
    id: "count",
    tool: "budget@1",
    examined: 9,
    unit: "file",
    counts: { "over-budget": 0 },
    moment: "sweep",
  });
  const lines = (await readFile(path.join(dir, "m.count.jsonl"), "utf8")).trim().split("\n");
  assert.equal(lines.length, 1, "a clean reading is a header and nothing else");
  assert.equal(JSON.parse(lines[0]!).population.examined, 9, "and examined is what says it looked");
});
