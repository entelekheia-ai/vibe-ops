// The default `vibe-ops check` output no longer repeats the composition preamble. `--verbose` still does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext } from "@entelekheia/vibe-ops-core";
import check from "../src/index.ts";

const repoRoot = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");

async function logsFor(flags: Record<string, string | boolean>): Promise<string[]> {
  const { config } = await loadConfig(repoRoot);
  const logs: string[] = [];
  const context: ModuleContext = {
    repoRoot,
    flags,
    args: [],
    config,
    settings: settingsFor(config, "check"),
    surface: "cli",
    log: (line: string) => logs.push(line),
    warn: (line: string) => logs.push(`warning: ${line}`),
  };
  await check.run(context);
  return logs.join("\n").split("\n");
}

test("a default run prints no `composed` line and no per-fragment source listing", async () => {
  const lines = await logsFor({});
  assert.deepEqual(lines.filter((line) => /^composed/.test(line)), []);
  assert.deepEqual(lines.filter((line) => /sh\/unported\/checks\//.test(line)), []);
  assert.deepEqual(lines.filter((line) => /^\s{2}\S+@\d+\s/.test(line)), []);
});

test("a default run still prints every FAIL or WARN the verbose run prints", async () => {
  const plain = (await logsFor({})).filter((line) => /^(FAIL|WARN)/.test(line));
  const verbose = (await logsFor({ verbose: true })).filter((line) => /^(FAIL|WARN)/.test(line));
  assert.deepEqual(plain, verbose);
});

test("a verbose run still prints the composition preamble", async () => {
  const lines = await logsFor({ verbose: true });
  assert.ok(lines.some((line) => /^composed \d+ checks:/.test(line)), lines.slice(0, 5).join(" | "));
});
