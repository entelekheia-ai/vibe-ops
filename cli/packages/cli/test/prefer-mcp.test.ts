// Through the real binary: the payload arrives on a real stdin and the answer has to be transport-clean
// JSON. Both branches are asserted — the one that speaks and, more importantly, every one that must not,
// since a nudge that fires on the wrong command is a tax paid on every Bash call in every repository.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bin.js");

async function repo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-prefer-"));
  spawnSync("git", ["-C", dir, "init", "-q"]);
  return dir;
}

function fire(cwd: string, command: string): { stdout: string; status: number } {
  const result = spawnSync("node", [BIN, "hook", "prefer-mcp"], {
    cwd,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd }),
    encoding: "utf8",
  });
  return { stdout: (result.stdout ?? "").trim(), status: result.status ?? -1 };
}

function context(cwd: string, command: string): string {
  const { stdout, status } = fire(cwd, command);
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string; permissionDecision?: string };
  };
  assert.equal(parsed.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(
    parsed.hookSpecificOutput.permissionDecision,
    undefined,
    "this hook never decides — task-guard is the one that refuses things on Bash",
  );
  return parsed.hookSpecificOutput.additionalContext;
}

test("a module with a verb is answered with the exact tool call", async () => {
  const text = context(await repo(), "vibe-ops plan status");
  assert.match(text, /`vibe-ops plan status` → the `plan` MCP tool with \{ command: "status" \}/);
});

test("a module with no verb is answered too", async () => {
  assert.match(context(await repo(), "vibe-ops check"), /`vibe-ops check` → the `check` MCP tool with \{\}/);
});

test("it reads through a compound command, which is the ordinary shape", async () => {
  const text = context(await repo(), "cd /somewhere && vibe-ops governance --verbose");
  assert.match(text, /`vibe-ops governance` → the `governance` MCP tool/);
});

test("a destructive verb is never nudged — MCP's confirm is weaker consent than the skill's preview", async () => {
  assert.equal(fire(await repo(), "vibe-ops task close project/tasks/001-x.md").stdout, "");
  assert.equal(fire(await repo(), "vibe-ops task close --dry-run project/tasks/001-x.md").stdout, "");
});

test("the hook surfaces are not modules and are never nudged toward a tool that does not exist", async () => {
  const dir = await repo();
  for (const command of ["vibe-ops hook plan-context", "vibe-ops mcp", "vibe-ops --help", "vibe-ops"]) {
    assert.equal(fire(dir, command).stdout, "", command);
  }
});

test("a command already asking for --json is left alone — that trade is already made", async () => {
  assert.equal(fire(await repo(), "vibe-ops plan resolve --json").stdout, "");
});

test("an unknown verb, an unknown module, and a command mentioning nothing at all are silent", async () => {
  const dir = await repo();
  assert.equal(fire(dir, "vibe-ops plan frobnicate").stdout, "");
  assert.equal(fire(dir, "vibe-ops not-a-module").stdout, "");
  assert.equal(fire(dir, "git status").stdout, "");
});

test("a malformed payload is silent and exits 0, never a hook failure", async () => {
  const result = spawnSync("node", [BIN, "hook", "prefer-mcp"], { input: "not json", encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.equal((result.stdout ?? "").trim(), "");
});
