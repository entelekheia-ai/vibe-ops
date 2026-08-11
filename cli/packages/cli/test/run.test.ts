import { test } from "node:test";
import assert from "node:assert/strict";
import { defineModule } from "@entelekheia/vibe-ops-core";
import { runModule } from "../src/run.ts";

const twoVerbs = defineModule(
  {
    id: "probe",
    version: "0.0.1",
    summary: "a throwaway two-verb module, for exercising command dispatch",
    commands: [
      { name: "hello", summary: "says hello" },
      { name: "loud", summary: "shouts", flags: [{ name: "shout", type: "boolean", description: "extra bang" }] },
    ],
  },
  async (context) => ({ code: 0, summary: context.command, data: { command: context.command, flags: context.flags } }),
);

function baseOptions(overrides: Partial<Parameters<typeof runModule>[0]> = {}) {
  return {
    plugin: twoVerbs,
    flags: {},
    args: [],
    cwd: process.cwd(),
    surface: "cli" as const,
    sink: () => {},
    ...overrides,
  };
}

test("a command-declaring module with no command given fails naming the valid set — this is the authoritative check MCP relies on, not just the terminal's own", async () => {
  const result = await runModule(baseOptions());
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /needs a command: hello, loud/);
});

test("an unknown command fails naming the valid set", async () => {
  const result = await runModule(baseOptions({ command: "wat" }));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /has no command "wat" — valid: hello, loud/);
});

test("a valid command reaches the module's context", async () => {
  const result = await runModule(baseOptions({ command: "hello" }));
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, { command: "hello", flags: {} });
});

test("a second valid command reaches the module's context with its own flags", async () => {
  const result = await runModule(baseOptions({ command: "loud", flags: { shout: true } }));
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, { command: "loud", flags: { shout: true } });
});

test("a module with no commands declared never runs the command guard — today's flat shape is untouched", async () => {
  const flat = defineModule({ id: "flat", version: "1", summary: "s" }, async (context) => ({
    code: 0,
    data: { command: context.command },
  }));
  const result = await runModule({ ...baseOptions({ plugin: flat }), command: undefined });
  assert.equal(result.code, 0);
  assert.equal(result.data.command, undefined);
});
