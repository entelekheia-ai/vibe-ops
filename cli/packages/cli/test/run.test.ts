import { test } from "node:test";
import assert from "node:assert/strict";
import { defineModule } from "@entelekheia/vibe-ops-core";
import { runModule, resolveSourceRoot } from "../src/run.ts";

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
  async (context) => ({
    code: 0,
    summary: context.command ?? "(no command)",
    data: { command: context.command, flags: context.flags },
  }),
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
    summary: "flat ran",
    data: { command: context.command },
  }));
  const result = await runModule({ ...baseOptions({ plugin: flat }), command: undefined });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, { command: undefined });
});

// `repoFromFirstArg` — the declaration that lets `vibe-ops check <path>` mean what it says. Before it,
// the positional was accepted and silently ignored: `check .` was right by accident because the working
// directory is what it keyed off, and `check ../other-repo` checked the wrong repository while reporting
// success. The two assertions below are the halves that were wrong together.

const repoScoped = defineModule(
  { id: "repo-scoped", version: "0.0.1", summary: "a throwaway module whose subject is a repository", repoFromFirstArg: true },
  async (context) => ({ code: 0, summary: "ran", data: { repoRoot: context.repoRoot, args: context.args } }),
);

const fileScoped = defineModule(
  { id: "file-scoped", version: "0.0.1", summary: "a throwaway module whose positionals are file paths" },
  async (context) => ({ code: 0, summary: "ran", data: { repoRoot: context.repoRoot, args: context.args } }),
);

test("a module declaring repoFromFirstArg has its first positional resolved into repoRoot, and consumed", async () => {
  const here = await runModule(baseOptions({ plugin: repoScoped, args: ["."] }));
  const bare = await runModule(baseOptions({ plugin: repoScoped, args: [] }));
  const withArg = here.data as { repoRoot: string; args: readonly string[] };
  const withoutArg = bare.data as { repoRoot: string; args: readonly string[] };

  assert.equal(withArg.repoRoot, withoutArg.repoRoot, "`.` resolves to the same repository as no argument at all");
  assert.deepEqual(withArg.args, [], "the argument is consumed, so the module never interprets it a second time");
});

test("a module NOT declaring repoFromFirstArg keeps its positionals — a dossier path must never be read as a repository", async () => {
  const result = await runModule(baseOptions({ plugin: fileScoped, args: ["project/tasks/whatever.md"] }));
  const data = result.data as { args: readonly string[] };
  assert.deepEqual(data.args, ["project/tasks/whatever.md"]);
});

// `resolveSourceRoot` — most-intentional wins: declared config, then the flag on this invocation, then
// the environment variable the hook wiring already provides. Each tier must win over every tier below it
// on its own, independent of whichever lower tiers also happen to be present.

test("resolveSourceRoot: config beats flag beats env — highest tier present wins regardless of the others", () => {
  const env = { CLAUDE_PLUGIN_ROOT: "/env/root" };
  assert.equal(resolveSourceRoot({ harness: { source: "/config/root" } }, "/flag/root", env), "/config/root");
  assert.equal(resolveSourceRoot({}, "/flag/root", env), "/flag/root");
  assert.equal(resolveSourceRoot({}, undefined, env), "/env/root");
  assert.equal(resolveSourceRoot({}, undefined, {}), undefined, "no tier resolves — undefined, not a guess");
});

const sourceAware = defineModule(
  { id: "source-aware", version: "0.0.1", summary: "a throwaway module that reads sourceRoot", needsSource: true },
  async (context) => ({ code: 0, summary: "ran", data: { sourceRoot: context.sourceRoot } }),
);

const sourceBlind = defineModule(
  { id: "source-blind", version: "0.0.1", summary: "a throwaway module that never declared needsSource" },
  async (context) => ({ code: 0, summary: "ran", data: { sourceRoot: context.sourceRoot } }),
);

test("runModule resolves sourceRoot onto context only for a needsSource module, from the --source flag", async () => {
  const result = await runModule(baseOptions({ plugin: sourceAware, flags: { source: "/flag/root" } }));
  assert.deepEqual(result.data, { sourceRoot: "/flag/root" });
});

test("runModule leaves sourceRoot undefined for a module that did not declare needsSource, even with --source passed", async () => {
  const result = await runModule(baseOptions({ plugin: sourceBlind, flags: { source: "/flag/root" } }));
  assert.deepEqual(result.data, { sourceRoot: undefined });
});
