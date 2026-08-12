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

test("the CLEAN run names both versions it compared — the one with no finding to carry them", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-fragment-parity-instrument-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  spawnSync("git", ["-C", repoRoot, "add", "-A"]);
  const outcome = await fragmentParity.run(
    ctx(repoRoot, ["AGENTS.md"], { runner: RUNNER, fragment: "links", against: "markdown-link" }),
  );
  assert.deepEqual(outcome.findings, []);
  assert.match(outcome.instrument ?? "", /^links@[0-9]+ vs markdown-link@[0-9]+$/);
});

test("a finding names both versions too, so a diverged pair is attributable from the finding alone", async () => {
  const repoRoot = await gitRepoWithBrokenLink();
  const outcome = await fragmentParity.run(
    ctx(repoRoot, ["AGENTS.md", "bad.md"], { runner: RUNNER, fragment: "links", against: "breadcrumb" }),
  );
  assert.match(outcome.findings[0]!.evidence, /links@[0-9]+ \(shell\)/);
  assert.match(outcome.findings[0]!.evidence, /breadcrumb@[0-9]+ \(the port\)/);
});

test("a fragment whose version cannot be read refuses, rather than reporting agreement between two unnamed things", async () => {
  const repoRoot = await gitRepoWithBrokenLink();
  await assert.rejects(
    () => fragmentParity.run(ctx(repoRoot, ["AGENTS.md"], { runner: RUNNER, fragment: "no-such-fragment", against: "markdown-link" })),
    /cannot read a version/,
  );
});

test("a repository with no runner SKIPS, naming why — it used to report parity over a hole", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-fragment-parity-no-runner-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  const outcome = await fragmentParity.run(
    ctx(repoRoot, [], { runner: "sh/does-not-exist.sh", fragment: "links", against: "markdown-link" }),
  );
  assert.match(outcome.skipped ?? "", /no runner/);
  assert.deepEqual(outcome.findings, []);
});

test("missing options throws before spawning anything", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-fragment-parity-bad-opts-"));
  await assert.rejects(() => fragmentParity.run(ctx(repoRoot, [], { fragment: "links" })));
});
