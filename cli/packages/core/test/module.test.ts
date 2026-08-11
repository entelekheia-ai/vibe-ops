import { test } from "node:test";
import assert from "node:assert/strict";
import { defineModule } from "../src/module.ts";
import { createEmitter } from "../src/emit.ts";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ok = async () => ({ code: 0 });

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
  await assert.rejects(() => emit({ id: "unknown", value: 1 }), /does not declare/);
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
  await emit({ id: "count", value: 3, subject: "AGENTS.md" });
  const written = JSON.parse((await readFile(path.join(dir, "m.jsonl"), "utf8")).trim());
  assert.equal(written.id, "count");
  assert.equal(written.value, 3);
  assert.equal(written.producer, "m@1");
  for (const forbidden of ["severity", "score", "pass", "verdict"]) {
    assert.ok(!(forbidden in written), `a producer must not record a ${forbidden}`);
  }
});
