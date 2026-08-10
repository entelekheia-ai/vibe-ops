// Through the real binary, not the runHook() function directly — the payload arrives on a real
// stdin and the response must be real, transport-clean JSON, which is exactly what unit-calling the
// function with a hand-built payload object would not exercise.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bin.js");

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-hook-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

function runHookBin(repoRoot: string, payload: unknown, argv: readonly string[]): { stdout: string; status: number } {
  const result = spawnSync("node", [BIN, "hook", "agents-md", ...argv], {
    cwd: repoRoot,
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return { stdout: result.stdout ?? "", status: result.status ?? -1 };
}

test("a payload naming a freshly written AGENTS.md fixes its missing sibling and reports exactly one JSON line", async () => {
  const repoRoot = await gitRepo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");

  const { stdout, status } = runHookBin(
    repoRoot,
    { tool_name: "Write", tool_input: { file_path: path.join(repoRoot, "AGENTS.md") } },
    ["--fix", "pairing"],
  );

  assert.equal(status, 0);
  const lines = stdout.trim().split("\n").filter((l) => l !== "");
  assert.equal(lines.length, 1, stdout);
  const parsed = JSON.parse(lines[0]!);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(parsed.hookSpecificOutput.additionalContext, /CLAUDE\.md/);

  assert.equal(await readFile(path.join(repoRoot, "CLAUDE.md"), "utf8"), "@AGENTS.md\n");
});

test("a payload naming an unrelated file produces no output at all", async () => {
  const repoRoot = await gitRepo();
  await writeFile(path.join(repoRoot, "README.md"), "hello\n");

  const { stdout, status } = runHookBin(
    repoRoot,
    { tool_name: "Write", tool_input: { file_path: path.join(repoRoot, "README.md") } },
    ["--fix", "pairing"],
  );

  assert.equal(status, 0);
  assert.equal(stdout, "");
});

test("a clean AGENTS.md that is already correctly paired stays silent", async () => {
  const repoRoot = await gitRepo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");

  const { stdout, status } = runHookBin(
    repoRoot,
    { tool_name: "Edit", tool_input: { file_path: path.join(repoRoot, "AGENTS.md") } },
    ["--fix", "pairing"],
  );

  assert.equal(status, 0);
  assert.equal(stdout, "");
});
