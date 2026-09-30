// Through the real binary, because the claim is a byte count on a pipe: no escape bytes and no framing
// characters reach a consumer that cannot ask for less.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "bin.js");

async function emptyRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-plain-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

function run(repoRoot: string, argv: readonly string[]): { out: string; status: number } {
  // The environment is cleaned of the variables that steer the layout, so the run is what a bare pipe gets.
  const env = { ...process.env };
  delete env["CI"];
  delete env["NO_COLOR"];
  const r = spawnSync("node", [BIN, ...argv], { cwd: repoRoot, encoding: "utf8", env });
  return { out: `${r.stdout ?? ""}${r.stderr ?? ""}`, status: r.status ?? -1 };
}

test("check in a pipe emits no framing characters and no escape bytes", async () => {
  const { out } = run(await emptyRepo(), ["check"]);
  assert.notEqual(out.trim(), "");
  assert.equal(/[│◆]/.test(out), false, `framing reached the pipe: ${JSON.stringify(out)}`);
  assert.equal(out.includes("\x1b"), false, "an escape byte reached the pipe");
});

test("check --ui in a pipe draws the rich summary glyph", async () => {
  const { out } = run(await emptyRepo(), ["check", "--ui"]);
  assert.match(out, /[✔✖]/);
});

test("check --no-ui is accepted, and --ui may come before the command", async () => {
  const repo = await emptyRepo();
  assert.notEqual(run(repo, ["check", "--no-ui"]).status, 2);
  assert.notEqual(run(repo, ["--ui", "check"]).status, 2);
});

test("an unknown flag still exits 2, with a line beginning error: ", async () => {
  const { out, status } = run(await emptyRepo(), ["check", "--definitely-not-a-flag"]);
  assert.equal(status, 2);
  assert.match(out, /^error: /m);
});

test("--help lists the global flags, plain", async () => {
  const { out } = run(await emptyRepo(), ["--help"]);
  assert.match(out, /flags on every command:/);
  assert.match(out, /--no-ui/);
  assert.equal(/[│◆]/.test(out), false);
});
