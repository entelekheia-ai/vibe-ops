// End-to-end: the real composition, against this repository's own checkout under its own config, and
// against the fixture each entry declares.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import ops from "../src/index.ts";
import { loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext, VibeOpsConfig } from "@entelekheia/vibe-ops-core";

function contextFor(
  repoRoot: string,
  config: VibeOpsConfig,
  flags: Record<string, string | boolean> = {},
): { context: ModuleContext; logs: string[] } {
  const logs: string[] = [];
  return {
    logs,
    context: {
      repoRoot,
      flags,
      args: [],
      config,
      settings: settingsFor(config, "exposure"),
      surface: "cli",
      log: (message) => logs.push(message),
      warn: (message) => logs.push(`warning: ${message}`),
    },
  };
}

const REPO = path.resolve(import.meta.dirname, "..", "..", "..", "..");

async function gitRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "vibeops-classification-ops-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}

function gitAdd(root: string): void {
  execFileSync("git", ["add", "-A"], { cwd: root });
}

test("--list composes one entry per classification rule", async () => {
  const { context } = contextFor(REPO, {}, { list: true });
  const result = await ops.run(context);
  const data = result.data as { gates: readonly { label: string }[] };
  assert.deepEqual(data.gates.map((gate) => gate.label), [
    "private-name",
    "file-path",
    "template-attribution",
    "memory-slug",
  ]);
});

test("against this repository's own checkout, under its own config — nothing fails", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
});

// A rule whose list arrives at run time reports SKIP when no list was supplied. That is the honest
// outcome and it must stay distinguishable from "the list was read and nothing matched".
test("private-name skips when no deny-list was supplied, rather than passing", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { verbose: true });
  await ops.run(context);
  assert.ok(logs.some((line) => line.includes("SKIP  [private-name]")), logs.join("\n"));
});

// `[[…]]` is also TOML and Wikitext. The entry declares `scope: "prose"` so syntax quoted as code is
// read as being shown rather than used — this repository's own README documents that distinction and
// would otherwise be reported by the rule it describes.
test("memory-slug reads prose, so a slug inside a code span is not a finding", async () => {
  const root = await gitRepo();
  await writeFile(path.join(root, "AGENTS.md"), "# Map\n\nThe shape `[[a-slug]]` is also TOML.\n");
  gitAdd(root);
  const { context, logs } = contextFor(root, {}, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  assert.ok(!logs.some((line) => line.includes("FAIL  [memory-slug]")), logs.join("\n"));
});

test("memory-slug catches a real slug on AGENTS.md and records exactly one finding", async () => {
  const root = await gitRepo();
  await writeFile(path.join(root, "AGENTS.md"), "# Map\n\nSee [[project_something]] for the rest.\n");
  gitAdd(root);
  const artifactDir = path.join(root, ".git", "gate-artifacts");
  const { context, logs } = contextFor(root, { artifactDir }, { verbose: true });
  const result = await ops.run(context);

  assert.equal(result.code, 1);
  assert.ok(
    logs.some((line) => line.includes("FAIL  [memory-slug]") && line.includes("project_something")),
    logs.join("\n"),
  );
  // Two entries emit, and both are behavioural and recurrent: a model reintroducing a note pointer on an
  // instruction surface, and a pasted command carrying someone's home directory. The structural rules —
  // an attribution inside a shipped template, a name from the deny-list — stay fixed once corrected and
  // record nothing.
  const files = (await readdir(artifactDir)).sort();
  assert.deepEqual(files, ["exposure.file-path.jsonl", "exposure.memory-slug.jsonl"]);
  const lines = (await readFile(path.join(artifactDir, "exposure.memory-slug.jsonl"), "utf8"))
    .trim()
    .split("\n");
  const header = JSON.parse(lines[0]!) as { tool: string };
  assert.equal(header.tool, "classification@1", "the instrument is the gate and its own version");
});

test("a shipped template carrying a literal attribution is a finding", async () => {
  const root = await gitRepo();
  await mkdir(path.join(root, "skills", "demo", "templates"), { recursive: true });
  await writeFile(path.join(root, "skills", "demo", "templates", "t.md"), "<!--\n Copyright (c) 2026 X\n-->\n\n# T\n");
  gitAdd(root);
  const { context, logs } = contextFor(root, {}, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 1);
  assert.ok(logs.some((line) => line.includes("FAIL  [template-attribution]")), logs.join("\n"));
});

test("every entry that declares a fixture still fires on it", async () => {
  const { config } = await loadConfig(REPO);
  const { context, logs } = contextFor(REPO, config, { "self-test": true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
});
