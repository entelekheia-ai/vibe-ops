import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { installHarness, HARNESS_FILES } from "../src/install.ts";

async function target(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-harness-install-"));
}

test("a fresh repository gets the whole apparatus, and the scripts are executable", async () => {
  const repo = await target();
  const result = installHarness(repo);

  assert.deepEqual([...result.written].sort(), HARNESS_FILES.map((f) => f.to).sort());
  assert.equal(result.kept.length, 0);
  for (const file of HARNESS_FILES.filter((f) => f.executable)) {
    const mode = (await stat(path.join(repo, file.to))).mode & 0o111;
    assert.notEqual(mode, 0, `${file.to} is not executable`);
  }
});

test("a second install keeps everything and writes nothing", async () => {
  const repo = await target();
  installHarness(repo);
  const second = installHarness(repo);
  assert.equal(second.written.length, 0);
  assert.equal(second.kept.length, HARNESS_FILES.length);
});

// THE CASE THAT COSTS SOMEBODY THEIR HOOK. A repository with a pre-commit of its own must not have it
// replaced — and must not have it silently kept either, because then the gate is not installed and the
// run said nothing about it.
test("a pre-commit that is not the gate is kept AND reported as needing the gate appended", async () => {
  const repo = await target();
  await mkdir(path.join(repo, ".githooks"), { recursive: true });
  await writeFile(path.join(repo, ".githooks", "pre-commit"), "#!/bin/sh\nnpm run lint\n");

  const result = installHarness(repo);
  assert.ok(result.kept.includes(".githooks/pre-commit"));
  assert.deepEqual(result.needsAppend, [".githooks/pre-commit"]);
  assert.equal(await readFile(path.join(repo, ".githooks", "pre-commit"), "utf8"), "#!/bin/sh\nnpm run lint\n");
});

test("a pre-commit that already calls the gate is kept and needs nothing", async () => {
  const repo = await target();
  await mkdir(path.join(repo, ".githooks"), { recursive: true });
  await writeFile(path.join(repo, ".githooks", "pre-commit"), "#!/bin/sh\nvibe-ops check \"$ROOT\"\n");

  const result = installHarness(repo);
  assert.ok(result.kept.includes(".githooks/pre-commit"));
  assert.deepEqual(result.needsAppend, []);
});

test("force overwrites only the destination it names", async () => {
  const repo = await target();
  installHarness(repo);
  await writeFile(path.join(repo, "scripts", "check.sh"), "# mine\n");
  await writeFile(path.join(repo, ".githooks", "pre-commit"), "# also mine\n");

  const result = installHarness(repo, { force: new Set(["scripts/check.sh"]) });
  assert.deepEqual(result.written, ["scripts/check.sh"]);
  assert.equal(await readFile(path.join(repo, ".githooks", "pre-commit"), "utf8"), "# also mine\n");
});
