// Through the real binary, like hook.test.ts and for the same reason: the payload arrives on a real
// stdin and the reply has to be transport-clean JSON, which unit-calling the function would not prove.
//
// The silence assertions are the load-bearing ones here. This surface runs at the start of every session
// in every repository the operator opens, so "says nothing" is its normal and overwhelmingly most common
// outcome — a regression that makes it speak is invisible to every other test in this repository and is
// the failure the whole design is shaped to avoid.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { behindEntries, formatBehind } from "../src/harness-status.ts";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bin.js");

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-harness-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

/** A plugin directory shipping the versions given, in the `types/index.json` layout `shippedVersion()`
 *  now reads (Plan-030 Track 1). */
async function pluginDir(versions: Readonly<Record<string, number>>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-plugin-"));
  await mkdir(path.join(dir, "types"), { recursive: true });
  const index: Record<string, { version: number }> = {};
  for (const [type, version] of Object.entries(versions)) index[type] = { version };
  await writeFile(path.join(dir, "types", "index.json"), JSON.stringify(index));
  return dir;
}

function run(repoRoot: string, argv: readonly string[]): { stdout: string; status: number } {
  const result = spawnSync("node", [BIN, "hook", "harness-status", ...argv], {
    cwd: repoRoot,
    input: JSON.stringify({ cwd: repoRoot }),
    encoding: "utf8",
  });
  return { stdout: result.stdout ?? "", status: result.status ?? -1 };
}

test("a repository whose applied map matches what is installed produces no output at all", async () => {
  const repoRoot = await gitRepo();
  const plugin = await pluginDir({ plan: 3, task: 3 });
  await writeFile(
    path.join(repoRoot, "vibeops.config.json"),
    JSON.stringify({ harness: { applied: { plan: 3, task: 3 } } }),
  );

  const { stdout, status } = run(repoRoot, ["--plugin", plugin]);

  assert.equal(status, 0);
  assert.equal(stdout, "", "silence is the normal outcome and must stay byte-empty");
});

test("a repository with no applied map at all is silent — absence is not version zero", async () => {
  const repoRoot = await gitRepo();
  const plugin = await pluginDir({ plan: 3, task: 3 });

  const { stdout, status } = run(repoRoot, ["--plugin", plugin]);

  assert.equal(status, 0);
  assert.equal(stdout, "", "every unrelated repository the operator opens is in this state");
});

test("a repository behind on one type says so, once, and names the migration command", async () => {
  const repoRoot = await gitRepo();
  const plugin = await pluginDir({ plan: 3, task: 3 });
  await writeFile(
    path.join(repoRoot, "vibeops.config.json"),
    JSON.stringify({ harness: { applied: { plan: 2, task: 3 } } }),
  );

  const { stdout, status } = run(repoRoot, ["--plugin", plugin]);

  assert.equal(status, 0);
  const lines = stdout.trim().split("\n").filter((l) => l !== "");
  assert.equal(lines.length, 1, stdout);
  const parsed = JSON.parse(lines[0]!);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(parsed.hookSpecificOutput.additionalContext, /plan@2/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /plan@3/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /vibe-ops:migrate/);
  assert.doesNotMatch(parsed.hookSpecificOutput.additionalContext, /task/, "a type that is current is not mentioned");
});

test("no --plugin, an unreadable plugin directory, and a malformed payload all fail open and silent", async () => {
  const repoRoot = await gitRepo();
  await writeFile(
    path.join(repoRoot, "vibeops.config.json"),
    // Since Plan-033 the CLI carries its norm in the bundled governance packages, so "no --plugin" is a
    // SERVED case, not silence — this fixture unbinds every type so the hook's fail-open half is what
    // is being measured, not the packages the test process happens to have installed.
    JSON.stringify({ harness: { applied: { plan: 1 } }, types: { adr: "@x/none", rfc: "@x/none", plan: "@x/none", task: "@x/none", log: "@x/none" } }),
  );

  assert.equal(run(repoRoot, []).stdout, "", "no --plugin and no activatable package: nothing to compare against");
  assert.equal(run(repoRoot, ["--plugin", path.join(repoRoot, "nope")]).stdout, "", "unreadable plugin dir");

  const malformed = spawnSync("node", [BIN, "hook", "harness-status", "--plugin", repoRoot], {
    cwd: repoRoot,
    input: "not json",
    encoding: "utf8",
  });
  assert.equal(malformed.status, 0, "an advisory hook must never be why a session fails to start");
  assert.equal(malformed.stdout ?? "", "");
});

test("behindEntries ignores a type the repository never had promulgated, and one the plugin does not ship", () => {
  assert.deepEqual(behindEntries({ plan: 1 }, { plan: 3 }), [{ type: "plan", applied: 1, shipped: 3 }]);
  assert.deepEqual(behindEntries({ plan: 3 }, { plan: 3, task: 9 }), [], "a type absent from applied is not news");
  assert.deepEqual(behindEntries({ task: 1 }, { plan: 3 }), [], "a type the plugin does not ship cannot be behind");
  assert.deepEqual(behindEntries(undefined, { plan: 3 }), [], "no map at all is silence, not zero");
});

test("a repository AHEAD of the installed plugin is not reported", () => {
  assert.deepEqual(
    behindEntries({ plan: 4 }, { plan: 3 }),
    [],
    "an operator running an older plugin than the repository was promulgated with is not behind, and telling them to migrate would be wrong",
  );
});

test("the message names every behind type and repairs nothing", () => {
  const text = formatBehind([
    { type: "plan", applied: 1, shipped: 3 },
    { type: "task", applied: 2, shipped: 3 },
  ]);
  assert.match(text, /plan@1/);
  assert.match(text, /task@2/);
  assert.match(text, /Nothing has been changed/);
});
