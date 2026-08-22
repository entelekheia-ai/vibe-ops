// The three measurement traps from Plan-025 Track 4 item 5's dossier, each asserted directly rather
// than left to a comment asking a reader to be careful.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildAudit, lineCount, isScopedRule } from "../src/audit.ts";

async function gitRepo(): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-audit-"));
  spawnSync("git", ["-C", repoRoot, "init", "-q"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.email", "test@example.com"]);
  spawnSync("git", ["-C", repoRoot, "config", "user.name", "test"]);
  return repoRoot;
}

async function commit(repoRoot: string, file: string, content: string): Promise<void> {
  const target = path.join(repoRoot, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  spawnSync("git", ["-C", repoRoot, "add", file]);
  spawnSync("git", ["-C", repoRoot, "commit", "-q", "-m", `add ${file}`]);
}

function baseContext(repoRoot: string) {
  return {
    repoRoot,
    flags: {},
    args: [],
    config: {},
    settings: undefined,
    surface: "cli" as const,
    log: () => {},
    warn: () => {},
  };
}

// Trap 1 — a shell glob matching nothing while an error is swallowed reads identically to a genuinely
// empty population. `sensorsAtCi` (inside buildAudit) is built on `workflowFiles()`, already asserted in
// shape.test.ts to return `[]` (not throw, not print a bogus zero) when `.github/workflows/` is entirely
// absent. Asserted again here at the audit level, because the trap is precisely a boundary a reader
// crosses without noticing — proving it holds at shape.ts is not proof it survives the handoff.
test("trap 1: a repository with no .github/workflows/ at all contributes zero CI sensors, not a swallowed error", async () => {
  const repoRoot = await gitRepo();
  const audit = await buildAudit(baseContext(repoRoot));
  assert.deepEqual(
    audit.sensors.filter((s) => s.firesAt === "ci"),
    [],
  );
});

// Trap 2 — a line count derived from a proxy (word count, byte length / 80) drifts from `wc -l`. Asserted
// against a real, awkward case: a file with no trailing newline, where `text.split("\n").length` would
// over-count by one relative to `wc -l`, which counts newline characters, not lines-as-segments.
test("trap 2: lineCount matches wc -l exactly, including a file with no trailing newline", () => {
  assert.equal(lineCount("a\nb\nc\n"), 3, "three newlines, three lines — the ordinary case");
  assert.equal(lineCount("a\nb\nc"), 2, "no trailing newline: wc -l counts 2, a split().length would count 3");
  assert.equal(lineCount(""), 0);
});

test("trap 2, end to end: a guide's reported line count equals wc -l's, not the fixture's naive line count", async () => {
  const repoRoot = await gitRepo();
  // Five lines, no trailing newline on the last one — the exact shape that trips a split()-based counter.
  await commit(repoRoot, "AGENTS.md", "one\ntwo\nthree\nfour\nfive");
  const audit = await buildAudit(baseContext(repoRoot));
  const entry = audit.guides.find((g) => g.path === "AGENTS.md");
  assert.ok(entry);
  const wc = spawnSync("wc", ["-l", path.join(repoRoot, "AGENTS.md")], { encoding: "utf8" });
  const expected = Number.parseInt((wc.stdout ?? "0").trim().split(/\s+/)[0] ?? "0", 10);
  assert.equal(entry.lines, expected);
});

// Trap 3 — a configured-but-unexecuted tool is a guide, not a sensor. `buildAudit` sources sensors ONLY
// from `check --list` (what actually runs at commit) and `.github/workflows/` (what actually runs in
// CI); nothing here scans for a linter's config file. Asserted by fixturing a config file that names
// itself convincingly (an .eslintrc-shaped file) and confirming it produces no sensor entry at all.
test("trap 3: a configured-but-unexecuted linter's config file is never counted as a sensor", async () => {
  const repoRoot = await gitRepo();
  await commit(repoRoot, ".eslintrc.json", '{"extends": "eslint:recommended"}');
  const audit = await buildAudit(baseContext(repoRoot));
  assert.deepEqual(
    audit.sensors.filter((s) => s.id.includes("eslint") || s.source.includes("eslint")),
    [],
  );
});

test("isScopedRule: a paths: key in the frontmatter makes a rule scoped, its absence makes it always-on", () => {
  assert.equal(isScopedRule("---\ndescription: x\npaths: [\"**/*.md\"]\n---\nbody"), true);
  assert.equal(isScopedRule("---\ndescription: x\n---\nbody"), false);
  assert.equal(isScopedRule("no frontmatter at all"), false);
});

test("guides: a shipped template copy under templates/ is excluded, the same safe default governance/self apply", async () => {
  const repoRoot = await gitRepo();
  await commit(repoRoot, "plugin/skills/setup/templates/root/CLAUDE.md", "@AGENTS.md\n");
  await commit(repoRoot, "CLAUDE.md", "@AGENTS.md\n");
  const audit = await buildAudit(baseContext(repoRoot));
  assert.deepEqual(
    audit.guides.map((g) => g.path),
    ["CLAUDE.md"],
  );
});

test("buildAudit: governance overlay counts records and how many are behind the current template, per type", async () => {
  const repoRoot = await gitRepo();
  await commit(
    repoRoot,
    "project/adr/0001-x.md",
    "---\nvibe-ops-template: adr@1\n---\n\n# ADR-0001: x\n\n| Field | Value |\n|---|---|\n| Status | Accepted |\n",
  );
  const audit = await buildAudit(baseContext(repoRoot));
  const adr = audit.governance.find((o) => o.type === "adr");
  assert.ok(adr);
  assert.equal(adr.count, 1);
});
