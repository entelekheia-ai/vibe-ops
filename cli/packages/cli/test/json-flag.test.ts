// Through the real binary, because the defect this file exists for lived ONLY in the terminal surface:
// every module that declares `--json` stops writing lines and returns `data` instead, and until 2026-08-11
// nothing on this surface rendered that field. So `--json` printed nothing and exited 0 — which reads as
// "there is nothing", a real answer, rather than as "this surface did not render it". Unit-calling the
// module would have passed the whole time, because the module was never the broken half.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bin.js");

/** A repository with one plan, enough for `plan resolve` to have something to report. */
async function repoWithAPlan(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-json-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  await mkdir(path.join(repoRoot, "project", "plans"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "project", "plans", "001-something.md"),
    "---\nvibe-ops-template: plan@3\n---\n\n# Plan-001: Something\n",
  );
  return repoRoot;
}

function run(repoRoot: string, argv: readonly string[]): { stdout: string; status: number } {
  const result = spawnSync("node", [BIN, ...argv], { cwd: repoRoot, encoding: "utf8" });
  return { stdout: result.stdout ?? "", status: result.status ?? -1 };
}

test("--json prints the module's data on the terminal, parseable and on its own", async () => {
  const repoRoot = await repoWithAPlan();
  const { stdout, status } = run(repoRoot, ["plan", "resolve", "--json"]);

  assert.equal(status, 0);
  assert.notEqual(stdout.trim(), "", "--json printed nothing, which is the defect this test exists for");

  // Parsed, not matched: the flag's whole purpose is being piped into `jq`, so framing characters from
  // the prompt library would be a silent corruption that a substring assertion would not catch.
  const parsed = JSON.parse(stdout) as { type?: string; dir?: string };
  assert.equal(parsed.type, "plan");
  assert.equal(parsed.dir, "project/plans");
});

test("without --json the same command writes its KEY=value lines and no JSON", async () => {
  const repoRoot = await repoWithAPlan();
  const { stdout, status } = run(repoRoot, ["plan", "resolve"]);

  assert.equal(status, 0);
  assert.match(stdout, /DIR=project\/plans/);
  assert.throws(() => JSON.parse(stdout), "the human surface must not have become JSON");
});
