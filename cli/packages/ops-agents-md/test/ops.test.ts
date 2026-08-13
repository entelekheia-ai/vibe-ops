// End-to-end: the real composition, against a fixture repo broken the same five ways
// check-agents-md.sh's own --self-test breaks its fixture, run through the actual gates package
// rather than through fakes. This is the comparison RFC-0001 asks for before the shell fragments are
// ever removed — the same shape of fixture, read by the ported detectors.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ops from "../src/index.ts";
import { settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-agents-md-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  return repoRoot;
}

function gitAdd(repoRoot: string): void {
  spawnSync("git", ["-C", repoRoot, "add", "-A"]);
}

function contextFor(repoRoot: string, config: VibeOpsConfig, flags: Record<string, string | boolean> = {}): {
  context: ModuleContext;
  logs: string[];
} {
  const logs: string[] = [];
  const context: ModuleContext = {
    repoRoot,
    flags,
    args: [],
    config,
    settings: settingsFor(config, "agents-md"),
    surface: "cli",
    log: (message) => logs.push(message),
    warn: (message) => logs.push(`warning: ${message}`),
  };
  return { context, logs };
}

/** A repository broken in the six ways this ops composes gates to catch. */
async function brokenFixture(): Promise<string> {
  const repoRoot = await gitRepo();

  // budget: over the 150-line default, and pairing: no sibling CLAUDE.md
  await writeFile(path.join(repoRoot, "AGENTS.md"), `${"padding line\n".repeat(200)}see [[project_something]]\n`);

  // check-frontmatter (rule schema): no description
  await mkdir(path.join(repoRoot, ".agents", "rules"), { recursive: true });
  await writeFile(path.join(repoRoot, ".agents", "rules", "nodesc.md"), '---\npaths: ["x/**"]\n---\n\nno description.\n');

  // bridge: a regular file where a symlink belongs
  await mkdir(path.join(repoRoot, ".claude", "rules"), { recursive: true });
  await writeFile(path.join(repoRoot, ".claude", "rules", "nodesc.md"), "not a symlink\n");

  // check-frontmatter (skill schema): unquoted ": " in a value
  await mkdir(path.join(repoRoot, "skills", "demo"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "skills", "demo", "SKILL.md"),
    "---\nname: demo\ndescription: template and numbering: an ADR\n---\n\nbody\n",
  );

  // check-frontmatter (agent schema): the two faults no other schema looks for. Both parse fine and
  // both are silent at load — a plugin-shipped agent's permissionMode is dropped, and an isolation
  // value that is not "worktree" configures nothing. A description is present deliberately, so this
  // fixture fails on the agent-specific faults rather than on the one every schema shares.
  await mkdir(path.join(repoRoot, "agents"), { recursive: true });
  await writeFile(
    path.join(repoRoot, "agents", "broken.md"),
    "---\nname: broken\ndescription: an agent that declares what a plugin ignores\npermissionMode: bypassPermissions\nisolation: sandbox\n---\n\nbody\n",
  );

  gitAdd(repoRoot);
  return repoRoot;
}

test("every gate fires on a repository broken in all six ways", async () => {
  const repoRoot = await brokenFixture();
  const { context, logs } = contextFor(repoRoot, {}, { verbose: true });
  const result = await ops.run(context);
  const output = logs.join("\n");

  assert.equal(result.code, 1);
  // pairing's rule names its failure mode, not the gate — this fixture triggers the "no sibling at
  // all" mode, not the "sibling exists without the import" one (that one is a warn, not a fail).
  for (const rule of ["budget", "no-sibling-claude-md", "bridge", "frontmatter", "skill-frontmatter", "agent-frontmatter", "memory-slug"]) {
    assert.match(output, new RegExp(`FAIL {2}\\[${rule}\\]`), output);
  }
  // Named individually, because both are agent-only and neither is a parse failure: a rule name in the
  // loop above would pass on the shared missing-description finding alone.
  assert.match(output, /declares `permissionMode:`/, output);
  assert.match(output, /the only value is `worktree`/, output);
});

test("a clean repository passes every composed entry", async () => {
  const repoRoot = await gitRepo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  gitAdd(repoRoot);

  const { context, logs } = contextFor(repoRoot, {}, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0);
  assert.ok(!logs.some((line) => line.includes("FAIL")), logs.join("\n"));
  // no .claude/ directory at all — bridge must say so, not report a vacuous ok
  assert.ok(logs.some((line) => line.includes("SKIP  [bridge]")), logs.join("\n"));
  // the three fragment-parity entries (Plan-013) SKIP here too — this fixture is a throwaway repo with
  // no cli/packages/module-check/sh/check-agents-md.sh of its own to compare against, which is the
  // correct outcome (fragment-parity's own "no runner" test covers the mechanism directly) rather than
  // a false pass over a hole.
  for (const label of ["fragment-parity-frontmatter", "fragment-parity-skill-frontmatter", "fragment-parity-memory-slug"]) {
    assert.ok(logs.some((line) => line.includes(`SKIP  [${label}]`)), logs.join("\n"));
  }
});

// Plan-013 Track 6, against the real checkout — the comparison RFC-0001 wants before a shell fragment
// is ever removed, run for real rather than against a synthetic fixture. `check-agents-md.sh` resolves
// relative to `repoRoot`, so this is the one test in this file that must point `repoRoot` at this
// repository's own checkout instead of a throwaway one.
test("the three fragment-parity entries report zero port-regression against this repository's real checkout", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const { context, logs } = contextFor(repoRoot, {}, { verbose: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0, logs.join("\n"));
  assert.ok(!logs.some((line) => line.includes("[port-regression]")), logs.join("\n"));
});

test("only memory-slug is recorded, and only for the entries declaring emits: true", async () => {
  const repoRoot = await gitRepo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "over budget but not what this test checks\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  gitAdd(repoRoot);

  const artifactDir = path.join(repoRoot, ".git", "gate-artifacts");
  const { context } = contextFor(repoRoot, { artifactDir });
  await ops.run(context);

  // One file per emitting entry, named for it. An entry that does not declare emits leaves no file at
  // all, which is what this asserts: the directory holds exactly one name.
  const files = await import("node:fs/promises").then((fs) => fs.readdir(artifactDir).catch(() => []));
  assert.deepEqual(files, ["agents-md.memory-slug.jsonl"]);

  const lines = (await readFile(path.join(artifactDir, files[0]!), "utf8")).trim().split("\n");
  const header = JSON.parse(lines[0]!);
  assert.equal(header.producer, "memory-slug");
  for (const forbidden of ["severity", "score", "pass", "verdict", "level"]) {
    assert.ok(!(forbidden in header), `a recorded observation must not carry a ${forbidden}`);
    for (const line of lines.slice(1)) {
      assert.ok(!(forbidden in JSON.parse(line)), `a finding line must not carry a ${forbidden}`);
    }
  }
});

test("memory-slug catches a real slug on AGENTS.md and records exactly one finding", async () => {
  const repoRoot = await gitRepo();
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n\nsee [[project_something]] for detail.\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  gitAdd(repoRoot);

  const artifactDir = path.join(repoRoot, ".git", "gate-artifacts");
  const { context, logs } = contextFor(repoRoot, { artifactDir });
  const result = await ops.run(context);

  assert.equal(result.code, 1);
  assert.ok(logs.some((line) => line.includes("FAIL  [memory-slug]") && line.includes("project_something")));

  // One artifact per signal, named for the emitting entry: the header carries one producer over one
  // population, so two entries in one file would describe neither.
  const lines = (await readFile(path.join(artifactDir, "agents-md.memory-slug.jsonl"), "utf8"))
    .trim()
    .split("\n");
  const header = JSON.parse(lines[0]!);
  assert.equal(header.kind, "gate");
  assert.equal(header.tool, "memory-slug@1", "the instrument is the gate and its own version");
  assert.deepEqual(JSON.parse(lines[1]!), { kind: "finding", rule: "memory-slug", count: 1 });
});

test("settings.agents-md.ignore excludes a shipped template's memory-slug link; without it, the link is a finding", async () => {
  const repoRoot = await gitRepo();
  // Must match one of memory-slug's own declared paths (AGENTS.md/CLAUDE.md/README.md) — a shipped
  // template README is exactly the case that produced the 13 false findings this task fixed.
  await mkdir(path.join(repoRoot, "skills", "demo", "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "skills", "demo", "templates", "README.md"), "see [[project_x]]\n");
  await writeFile(path.join(repoRoot, "AGENTS.md"), "# map\n");
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  gitAdd(repoRoot);

  const unfiltered = contextFor(repoRoot, {}, { verbose: true });
  const unfilteredResult = await ops.run(unfiltered.context);
  assert.equal(unfilteredResult.code, 1);
  assert.ok(unfiltered.logs.some((line) => line.includes("FAIL  [memory-slug]") && line.includes("templates")));

  const governed = contextFor(
    repoRoot,
    { settings: { "agents-md": { ignore: { "*": ["**/templates/**"] } } } },
    { verbose: true },
  );
  const governedResult = await ops.run(governed.context);
  assert.equal(governedResult.code, 0);
  assert.ok(!governed.logs.some((line) => line.includes("FAIL")), governed.logs.join("\n"));
  const okLine = governed.logs.find((line) => line.includes("ok    [memory-slug]"));
  assert.ok(okLine?.includes("ignored"), governed.logs.join("\n"));
});

test("a gate named in settings.agents-md.disabled reports SKIP with the reason, and never runs", async () => {
  const repoRoot = await gitRepo();
  // Over budget — would FAIL [budget] if the gate ran at all.
  await writeFile(path.join(repoRoot, "AGENTS.md"), "padding line\n".repeat(200));
  await writeFile(path.join(repoRoot, "CLAUDE.md"), "@AGENTS.md\n");
  gitAdd(repoRoot);

  const { context, logs } = contextFor(
    repoRoot,
    { settings: { "agents-md": { disabled: { budget: "budget still under review" } } } },
    { verbose: true },
  );
  const result = await ops.run(context);
  assert.equal(result.code, 0);
  assert.ok(!logs.some((line) => line.includes("FAIL  [budget]")), logs.join("\n"));
  assert.ok(logs.some((line) => line.includes("SKIP  [budget] budget still under review")), logs.join("\n"));
});

test("the token <plugin>/ reaches the skill-frontmatter entry against this real repository", async () => {
  // Not a fixture — the ops run against the actual vibe-ops checkout, whose plugin/ subfolder is
  // exactly the case the <plugin>/ token exists for. A regression here means every dogfooded skill
  // path silently stops being checked, in the one repository that would never notice from its own
  // shell gate (which resolves $PLUGIN_DIR independently).
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const { context, logs } = contextFor(repoRoot, {}, { list: true });
  const result = await ops.run(context);
  assert.equal(result.code, 0);
  const skillLine = logs.find((line) => line.includes("skill-frontmatter"));
  assert.ok(skillLine?.includes("plugin/skills/*/SKILL.md"), logs.join("\n"));
});
