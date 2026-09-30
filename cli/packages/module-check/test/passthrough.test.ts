// The default `vibe-ops check` output no longer repeats the composition preamble. `--verbose` still does.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext } from "@entelekheia/vibe-ops-core";
import check from "../src/index.ts";

const repoRoot = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");

async function logsFor(flags: Record<string, string | boolean>, root: string = repoRoot): Promise<string[]> {
  const { config } = await loadConfig(root);
  const logs: string[] = [];
  const context: ModuleContext = {
    repoRoot: root,
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

// This repository's own fragments all pass, so the tests above never see a shell-half finding. A fixture
// fragment, contributed the way a consumer repository does (VIBE_OPS_CHECK_DIRS), prints one.
test("a shell-half FAIL and its indented evidence survive the default run; the preamble does not", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const nodePath = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const base = mkdtempSync(nodePath.join(tmpdir(), "vibeops-passthrough-"));
  const frags = nodePath.join(base, "frags");
  const target = nodePath.join(base, "target");
  mkdirSync(frags);
  mkdirSync(target);
  spawnSync("git", ["-C", target, "init", "-q"]);
  writeFileSync(
    nodePath.join(frags, "10-fixture-finding.sh"),
    `CHECK_VERSION=1
check_fixture_finding() {
  fail fixture-finding "a finding from the fixture"
  printf '  evidence: an indented line under it\\n'
}
`,
  );
  const saved = process.env["VIBE_OPS_CHECK_DIRS"];
  process.env["VIBE_OPS_CHECK_DIRS"] = frags;
  try {
    const lines = await logsFor({}, target);
    const at = lines.findIndex((line) => line === "FAIL  [fixture-finding] a finding from the fixture");
    assert.ok(at >= 0, lines.slice(0, 8).join(" | "));
    assert.equal(lines[at + 1], "  evidence: an indented line under it");
    assert.deepEqual(lines.filter((line) => /^composed/.test(line)), []);
    assert.deepEqual(lines.filter((line) => /10-fixture-finding\.sh/.test(line)), []);
  } finally {
    if (saved === undefined) delete process.env["VIBE_OPS_CHECK_DIRS"];
    else process.env["VIBE_OPS_CHECK_DIRS"] = saved;
    rmSync(base, { recursive: true, force: true });
  }
});
