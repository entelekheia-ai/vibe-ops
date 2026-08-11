import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import task from "../src/index.ts";

const run = promisify(execFile);

test("task declares resolve, close and guard — and only close is destructive", () => {
  assert.deepEqual(
    task.definition.commands?.map((c) => c.name),
    ["resolve", "close", "guard"],
  );
  assert.deepEqual(
    task.definition.commands?.filter((c) => c.destructive === true).map((c) => c.name),
    ["close"],
    "resolve and guard read; only close deletes files and posts to an issue",
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
