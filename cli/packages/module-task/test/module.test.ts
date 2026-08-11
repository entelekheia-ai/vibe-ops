import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import task from "../src/index.ts";

const run = promisify(execFile);

test("task declares exactly one command today: resolve", () => {
  assert.deepEqual(
    task.definition.commands?.map((c) => c.name),
    ["resolve"],
  );
});

test("resolve reports the GitHub facts alongside the layout", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-task-module-"));
  await run("git", ["init", "-q"], { cwd: repo });
  const result = await task.run({
    repoRoot: repo,
    flags: {},
    args: [],
    command: "resolve",
    config: {},
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
  assert.equal(result.code, 0);
  const data = result.data as { task?: { ghAuth: string } };
  assert.ok(["ok", "no", "absent"].includes(data.task?.ghAuth ?? ""));
});
