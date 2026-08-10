import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import fragmentParity from "../src/fragment-parity/index.ts";

// This repository's own checkout — the runner being compared lives here, not in the disposable
// fixture repos below, exactly as it does in production: fragment-parity always runs against the
// real vibe-ops checkout, comparing its own shell suite to its own ports.
const REAL_REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const RUNNER = path.join(REAL_REPO_ROOT, "cli", "packages", "module-check", "sh", "check-agents-md.sh");

async function gitRepoWithBrokenLink(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-fragment-parity-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.email", "test@example.com"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.name", "test"]);
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "bad.md"), "[absolute](/nope)\n");
  spawnSync("git", ["-C", repoRoot, "add", "-A"]);
  spawnSync("git", ["-C", repoRoot, "commit", "-q", "-m", "one"]);
  return repoRoot;
}

function ctx(repoRoot: string, files: readonly string[], options: Record<string, unknown>): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options, documents: createDocumentStore(repoRoot) };
}

test("a file the shell fragment flags and the correct port also flags produces no finding — real parity", async () => {
  const repoRoot = await gitRepoWithBrokenLink();
  const outcome = await fragmentParity.run(
    ctx(repoRoot, ["AGENTS.md", "bad.md"], { runner: RUNNER, fragment: "links", against: "markdown-link" }),
  );
  assert.deepEqual(outcome.findings, []);
});

test("a file the shell fragment flags and a DIFFERENT gate does not is reported as port-regression", async () => {
  const repoRoot = await gitRepoWithBrokenLink();
  // "breadcrumb" never looks at link_destination — standing in for a port that diverged from its
  // fragment, without needing to actually break markdown-link to prove the mechanism.
  const outcome = await fragmentParity.run(
    ctx(repoRoot, ["AGENTS.md", "bad.md"], { runner: RUNNER, fragment: "links", against: "breadcrumb" }),
  );
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.file, "bad.md");
  assert.equal(outcome.findings[0]!.rule, "port-regression");
});

test("a clean repository — no shell failures, no port findings, no port-regression", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-fragment-parity-clean-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  spawnSync("git", ["-C", repoRoot, "add", "-A"]);
  const outcome = await fragmentParity.run(
    ctx(repoRoot, ["AGENTS.md"], { runner: RUNNER, fragment: "links", against: "markdown-link" }),
  );
  assert.deepEqual(outcome.findings, []);
});

test("missing options throws before spawning anything", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-fragment-parity-bad-opts-"));
  await assert.rejects(() => fragmentParity.run(ctx(repoRoot, [], { fragment: "links" })));
});
