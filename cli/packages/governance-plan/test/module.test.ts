import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
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

test("plan declares its six verbs, and only close is destructive", () => {
  assert.deepEqual(
    plan.definition.commands?.map((c) => c.name),
    ["resolve", "status", "context", "file", "close", "guard"],
  );
  // `file` writes a new file and `close` moves an existing one — but only the second is irreversible in
  // the sense that matters: filing never overwrites, and the plan-mode source is still on disk.
  assert.deepEqual(
    plan.definition.commands?.filter((c) => c.destructive === true).map((c) => c.name),
    ["close"],
  );
});

/**
 * A plan template declaring the plan@0.2 chain and its two living sections, written into `repo`.
 * `version` declares what a plan written today is written against — the dispatch's `current`.
 */
async function withTemplate(repo: string, version?: string): Promise<void> {
  await mkdir(path.join(repo, "project", "templates"), { recursive: true });
  await writeFile(
    path.join(repo, "project", "templates", "plan.md"),
    [
      ...(version === undefined ? [] : ["---", `vibe-ops-template: plan@${version}`, "---", ""]),
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

function contextFor(
  repo: string,
  command: string,
  flags: Record<string, string | boolean>,
  lines: string[],
  args: readonly string[] = [],
) {
  return {
    repoRoot: repo,
    flags,
    args,
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

test("close without a path is refused before anything is read", async () => {
  const result = await plan.run(contextFor(await scratchRepo(), "close", {}, []));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /needs the plan's path/);
});

// ---------------------------------------------------------------- Plan-012 Track 6: the dispatch
//
// `close` sets a Status row, moves the file and repoints its referrers. Every assertion below is about
// the dispatch happening BEFORE any of that, which is why the blocked cases run without --dry-run: a
// stop that lands after the first write is not a stop, and the file on disk is what proves it.

/** A plan under `project/plans`, declaring `plan@<version>` unless `version` is absent. */
async function withPlanFile(repo: string, name: string, version?: string): Promise<string> {
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  const text = [
    ...(version === undefined ? [] : ["---", `vibe-ops-template: plan@${version}`, "---", ""]),
    `# Plan-00X: ${name}`,
    "",
    "| Field | Value |",
    "|---|---|",
    "| Status | In Progress |",
    "",
  ].join("\n");
  await writeFile(path.join(repo, "project", "plans", name), text);
  return text;
}

/** One migration note, named the way `/vibe-ops:migrate` names its own. */
async function withMigrationNote(repo: string, note: string): Promise<void> {
  const dir = path.join(repo, "skills", "migrate", "migrations");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, note), "# A migration note\n");
}

test("close on a current plan says nothing about versions anywhere in its output", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  await withPlanFile(repo, "009-current.md", "3");

  const lines: string[] = [];
  const result = await plan.run(contextFor(repo, "close", { "dry-run": true }, lines, ["project/plans/009-current.md"]));
  assert.equal(result.code, 0);
  const output = [...lines, result.summary ?? ""].join("\n");
  assert.doesNotMatch(output, /version|plan@|template/i, "a current record is handled with no version vocabulary at all");
  // On BOTH channels, or the constraint holds where it is easy to see and not where `--json` reads.
  assert.equal((result.data as { version?: unknown }).version, undefined);
});

test("close refuses a plan that declares no template version, and moves nothing", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  const before = await withPlanFile(repo, "009-undeclared.md");

  const lines: string[] = [];
  const result = await plan.run(contextFor(repo, "close", {}, lines, ["project/plans/009-undeclared.md"]));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /declares no template version/);
  assert.deepEqual(lines, [], "nothing is narrated, because nothing ran");
  assert.equal(await readFile(path.join(repo, "project", "plans", "009-undeclared.md"), "utf8"), before);
  assert.equal(existsSync(path.join(repo, "project", "plans", "shipped")), false);
});

test("close refuses a plan ahead of the template — the tooling is what is behind", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  const before = await withPlanFile(repo, "009-ahead.md", "4");

  const result = await plan.run(contextFor(repo, "close", {}, [], ["project/plans/009-ahead.md"]));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /ahead of the template's 3/);
  assert.equal(await readFile(path.join(repo, "project", "plans", "009-ahead.md"), "utf8"), before);
});

test("close refuses a plan whose migration chain breaks, naming the jump nobody wrote down", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  await withPlanFile(repo, "009-stuck.md", "0.1");
  await withMigrationNote(repo, "plan-0.1-to-0.2.md"); // …and nothing from 0.2 onward.

  const result = await plan.run(contextFor(repo, "close", {}, [], ["project/plans/009-stuck.md"]));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /no migration note leaves plan@0\.2 toward 3/);
});

test("close proceeds on a plan behind the template, logging exactly one line before the steps", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  await withPlanFile(repo, "009-behind.md", "0.1");
  await withMigrationNote(repo, "plan-0.1-to-0.2.md");
  await withMigrationNote(repo, "plan-0.2-to-3.md");

  const lines: string[] = [];
  const result = await plan.run(contextFor(repo, "close", { "dry-run": true }, lines, ["project/plans/009-behind.md"]));
  assert.equal(result.code, 0);
  assert.equal(
    lines[0],
    "project/plans/009-behind.md: written against plan@0.1, current is 3 — that shape is described by " +
      "plan-0.1-to-0.2.md, plan-0.2-to-3.md (vibe-ops records handling project/plans/009-behind.md)",
  );
  assert.ok(lines.length > 1 && lines.slice(1).every((line) => !line.includes("written against")));
  // The alert has to survive the surface that suppresses lines, or `--json` closes a 0.1 plan silently.
  assert.equal((result.data as { version?: { line: string } }).version?.line, lines[0]);
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

// A path that does not exist is not a version question. Answering it as one told the operator to declare
// frontmatter in a file that is not there — measured on 2026-08-11, before the existence check was moved
// ahead of the dispatch.
test("close on a path that does not exist says so, rather than reporting it as undeclared", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  await withPlanFile(repo, "009-real.md", "3");

  const lines: string[] = [];
  const result = await plan.run(contextFor(repo, "close", {}, lines, ["project/plans/999-nope.md"]));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /no such plan: project\/plans\/999-nope\.md/);
  assert.doesNotMatch(result.summary ?? "", /version|frontmatter/i);
});
