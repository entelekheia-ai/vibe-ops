import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import log from "../src/index.ts";

test("log declares exactly one command today: resolve", () => {
  assert.deepEqual(
    log.definition.commands?.map((c) => c.name),
    ["resolve"],
  );
});

test("resolve reports no directory when project/log does not exist", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-log-module-"));
  const result = await log.run({
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
  assert.equal((result.data as { dir?: string }).dir, undefined);
});

test("resolve finds project/log when it exists", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-log-module-"));
  await mkdir(path.join(repo, "project", "log"), { recursive: true });
  const result = await log.run({
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
  assert.equal((result.data as { dir?: string }).dir, "project/log");
});
