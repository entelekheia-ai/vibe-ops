import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import plan from "../src/index.ts";

const run = promisify(execFile);

async function scratchRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-plan-module-"));
  await run("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("plan declares exactly one command today: resolve", () => {
  assert.deepEqual(
    plan.definition.commands?.map((c) => c.name),
    ["resolve"],
  );
});

test("resolve returns the resolved record as data, and logs KEY=value lines by default", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const lines: string[] = [];
  const result = await plan.run({
    repoRoot: repo,
    flags: {},
    args: [],
    command: "resolve",
    config: {},
    settings: undefined,
    surface: "cli",
    log: (message) => lines.push(message),
    warn: () => {},
  });
  assert.equal(result.code, 0);
  assert.ok(lines.some((line) => line.startsWith("DIR=project/plans")));
  assert.equal((result.data as { type: string }).type, "plan");
});

test("--json suppresses the KEY=value lines but still returns the structured data", async () => {
  const repo = await scratchRepo();
  const lines: string[] = [];
  const result = await plan.run({
    repoRoot: repo,
    flags: { json: true },
    args: [],
    command: "resolve",
    config: {},
    settings: undefined,
    surface: "cli",
    log: (message) => lines.push(message),
    warn: () => {},
  });
  assert.equal(lines.length, 0);
  assert.equal(result.code, 0);
  assert.notEqual(result.data, undefined);
});

test("a declared records config error is reported as a summary, not thrown out of run()", async () => {
  const result = await plan.run({
    repoRoot: "/does/not/matter",
    flags: {},
    args: [],
    command: "resolve",
    config: { records: { templates: { plan: "nowhere.md" } } },
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /records\.templates\.plan/);
});
