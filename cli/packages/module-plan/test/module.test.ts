import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import plan from "../src/index.ts";

const run = promisify(execFile);

async function scratchRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-plan-module-"));
  await run("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("plan declares the three read verbs; file and close are Track 6", () => {
  assert.deepEqual(
    plan.definition.commands?.map((c) => c.name),
    ["resolve", "status", "context"],
  );
});

/** A plan template declaring the plan@0.2 chain and its two living sections, written into `repo`. */
async function withTemplate(repo: string): Promise<void> {
  await mkdir(path.join(repo, "project", "templates"), { recursive: true });
  await writeFile(
    path.join(repo, "project", "templates", "plan.md"),
    [
      "<!-- Status lifecycle: Backlog → In Progress → Shipped. The file is never deleted. -->",
      "",
      "# Plan-NNN: Title",
      "",
      "<!-- ===== LIVING SECTIONS -->",
      "",
      "## Decision Log",
      "",
      "## Outcomes & Retrospective",
      "",
      "<!-- ===== END LIVING SECTIONS -->",
      "",
    ].join("\n"),
  );
}

function contextFor(repo: string, command: string, flags: Record<string, string | boolean>, lines: string[]) {
  return {
    repoRoot: repo,
    flags,
    args: [],
    command,
    config: {},
    settings: undefined,
    surface: "cli" as const,
    log: (message: string) => lines.push(message),
    warn: () => {},
  };
}

test("status names a plan whose Status is terminal while a track box is still open", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo);
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await writeFile(
    path.join(repo, "project", "plans", "009-x.md"),
    [
      "# Plan-009: X",
      "",
      "| Field | Value |",
      "|---|---|",
      "| Status | Shipped |",
      "",
      "## Tracks",
      "",
      "- [x] Track 1",
      "- [ ] Run `/vibe-ops:close plan`",
      "",
    ].join("\n"),
  );

  const lines: string[] = [];
  const result = await plan.run(contextFor(repo, "status", {}, lines));
  assert.equal(result.code, 0);
  const { findings } = result.data as { findings: readonly { file: string; reason: string }[] };
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.file, "project/plans/009-x.md");
  assert.equal(findings[0]?.reason, "terminal-with-open-tracks");
  assert.ok(lines.some((line) => line.includes("1 of 2 tracks are unchecked")));
});

test("status on a repository with no plans at all is zero findings, not an error", async () => {
  const repo = await scratchRepo();
  const lines: string[] = [];
  const result = await plan.run(contextFor(repo, "status", {}, lines));
  assert.equal(result.code, 0);
  assert.deepEqual((result.data as { findings: readonly unknown[] }).findings, []);
  assert.deepEqual(lines, ["no incoherent plan found"]);
});

test("context names the living sections the template actually declares — defect 1's fix", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo);
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });

  const lines: string[] = [];
  const result = await plan.run(contextFor(repo, "context", {}, lines));
  assert.equal(result.code, 0);
  const { text } = result.data as { text: string };
  assert.match(text, /Decision Log, Outcomes & Retrospective/);
  assert.doesNotMatch(text, /Surprises & Discoveries/, "the deleted plan@0.1 prose must not reappear");
  assert.deepEqual(lines, [text]);
});

test("an unknown verb is refused by the module, naming what it was given", async () => {
  const result = await plan.run(contextFor(await scratchRepo(), "close", {}, []));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /plan close is not implemented yet/);
});

test("resolve returns the resolved record as data, and logs KEY=value lines by default", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const lines: string[] = [];
  const result = await plan.run({
    repoRoot: repo,
    flags: {},
    args: [],
    command: "resolve",
    config: {},
    settings: undefined,
    surface: "cli",
    log: (message) => lines.push(message),
    warn: () => {},
  });
  assert.equal(result.code, 0);
  assert.ok(lines.some((line) => line.startsWith("DIR=project/plans")));
  assert.equal((result.data as { type: string }).type, "plan");
});

test("--json suppresses the KEY=value lines but still returns the structured data", async () => {
  const repo = await scratchRepo();
  const lines: string[] = [];
  const result = await plan.run({
    repoRoot: repo,
    flags: { json: true },
    args: [],
    command: "resolve",
    config: {},
    settings: undefined,
    surface: "cli",
    log: (message) => lines.push(message),
    warn: () => {},
  });
  assert.equal(lines.length, 0);
  assert.equal(result.code, 0);
  assert.notEqual(result.data, undefined);
});

test("a declared records config error is reported as a summary, not thrown out of run()", async () => {
  const result = await plan.run({
    repoRoot: "/does/not/matter",
    flags: {},
    args: [],
    command: "resolve",
    config: { records: { templates: { plan: "nowhere.md" } } },
    settings: undefined,
    surface: "cli",
    log: () => {},
    warn: () => {},
  });
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /records\.templates\.plan/);
});
