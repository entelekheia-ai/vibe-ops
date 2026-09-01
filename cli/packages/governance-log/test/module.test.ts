import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import log from "../src/index.ts";

test("log declares its four verbs, and none of them is destructive", () => {
  assert.deepEqual(
    log.definition.commands?.map((c) => c.name),
    ["resolve", "index", "sweep", "lint"],
  );
  // `index` rewrites a generated file and `sweep` only reports: retirement is deletion plus a tombstone,
  // and both are the skill's judgement, never this module's.
  assert.deepEqual(
    log.definition.commands?.filter((c) => c.destructive === true),
    [],
  );
});

// Plan-027 Track 1: `log resolve` printed its one line from a string literal inside this module, which
// made two places decide how a resolved location prints. It now goes through the same `formatResolved`
// every numbered type uses. The assertion that matters is the pair: the `DIR=` line is spelled exactly as
// the shared formatter spells it, AND nothing about numbering follows it — `log` has no number by design,
// so six `(none)` lines would be a worse answer than one line.
test("resolve prints through the shared formatter, and stops where numbering starts", async () => {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-log-module-"));
  await mkdir(path.join(repo, "project", "log"), { recursive: true });
  const lines: string[] = [];
  const result = await log.run({
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
  assert.deepEqual(lines, ["DIR=project/log"]);
  for (const key of ["TPL=", "TPL_VERSION=", "AUTHORITY=", "PAD=", "EXISTING=", "NEXT="]) {
    assert.ok(!lines.join("\n").includes(key), `${key} is about numbering, which log deliberately has none of`);
  }
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
