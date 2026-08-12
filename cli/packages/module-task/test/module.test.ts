import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import task from "../src/index.ts";

const run = promisify(execFile);

async function scratchRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-task-module-"));
  await run("git", ["init", "-q"], { cwd: dir });
  return dir;
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

test("task declares resolve, close and guard — and only close is destructive", () => {
  assert.deepEqual(
    task.definition.commands?.map((c) => c.name),
    ["resolve", "close", "guard"],
  );
  assert.deepEqual(
    task.definition.commands?.filter((c) => c.destructive === true).map((c) => c.name),
    ["close"],
    "resolve and guard read; only close deletes files and posts to an issue",
  );
});

test("resolve reports the GitHub facts alongside the layout", async () => {
  const result = await task.run(contextFor(await scratchRepo(), "resolve", {}, []));
  assert.equal(result.code, 0);
  const data = result.data as { task?: { ghAuth: string } };
  assert.ok(["ok", "no", "absent"].includes(data.task?.ghAuth ?? ""));
});

// ---------------------------------------------------------------- Plan-012 Track 6: the dispatch
//
// `close` ticks, commits, deletes and repoints — and it does all of that for the WHOLE BATCH, collecting
// referrers across it before the first deletion. So the batch is what a block stops: the tests below
// assert the whole batch stops and every dossier is still on disk exactly as written.

/** A task template declaring `task@<version>`. */
async function withTemplate(repo: string, version: string): Promise<void> {
  await mkdir(path.join(repo, "project", "templates"), { recursive: true });
  await writeFile(
    path.join(repo, "project", "templates", "task.md"),
    ["---", `vibe-ops-template: task@${version}`, "---", "", "# Task-NNN: Title", ""].join("\n"),
  );
}

/** A dossier under `project/tasks`, declaring `task@<version>` unless `version` is absent. */
async function withDossier(repo: string, name: string, version?: string): Promise<string> {
  await mkdir(path.join(repo, "project", "tasks"), { recursive: true });
  const text = [
    ...(version === undefined ? [] : ["---", `vibe-ops-template: task@${version}`, "---", ""]),
    `# Task-00X: ${name}`,
    "",
    "## Closure",
    "",
    "- [ ] Ready to close",
    "",
  ].join("\n");
  await writeFile(path.join(repo, "project", "tasks", name), text);
  return text;
}

async function withMigrationNote(repo: string, note: string): Promise<void> {
  const dir = path.join(repo, "skills", "migrate", "migrations");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, note), "# A migration note\n");
}

test("close on a current dossier says nothing about versions anywhere in its output", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  await withDossier(repo, "001-current.md", "3");

  const lines: string[] = [];
  const result = await task.run(contextFor(repo, "close", { "dry-run": true }, lines, ["project/tasks/001-current.md"]));
  assert.equal(result.code, 0);
  const output = [...lines, result.summary ?? ""].join("\n");
  assert.doesNotMatch(output, /version|task@|template/i, "a current record is handled with no version vocabulary at all");
  // On BOTH channels, or the constraint holds where it is easy to see and not where `--json` reads.
  assert.equal((result.data as { version?: unknown }).version, undefined);
});

test("close refuses a dossier that declares no template version, and mutates nothing", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  const before = await withDossier(repo, "001-undeclared.md");

  const lines: string[] = [];
  const result = await task.run(contextFor(repo, "close", {}, lines, ["project/tasks/001-undeclared.md"]));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /declares no template version/);
  assert.deepEqual(lines, []);
  assert.equal(await readFile(path.join(repo, "project", "tasks", "001-undeclared.md"), "utf8"), before);
});

test("close refuses a dossier ahead of the template — the tooling is what is behind", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  const before = await withDossier(repo, "001-ahead.md", "4");

  const result = await task.run(contextFor(repo, "close", {}, [], ["project/tasks/001-ahead.md"]));
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /ahead of the template's 3/);
  assert.equal(await readFile(path.join(repo, "project", "tasks", "001-ahead.md"), "utf8"), before);
});

test("close proceeds on a dossier behind the template, logging exactly one line before the steps", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  await withDossier(repo, "001-behind.md", "0.1");
  await withMigrationNote(repo, "task-0.1-to-0.2.md");
  await withMigrationNote(repo, "task-0.2-to-3.md");

  const lines: string[] = [];
  const result = await task.run(contextFor(repo, "close", { "dry-run": true }, lines, ["project/tasks/001-behind.md"]));
  assert.equal(result.code, 0);
  assert.equal(
    lines[0],
    "project/tasks/001-behind.md: written against task@0.1, current is 3 — that shape is described by " +
      "task-0.1-to-0.2.md, task-0.2-to-3.md (vibe-ops records handling project/tasks/001-behind.md)",
  );
  assert.equal(lines[1], "== referrers (collected before any deletion)");
  // The alert has to survive the surface that suppresses lines, or `--json` closes a 0.1 dossier silently.
  assert.deepEqual(
    (result.data as { version?: readonly { file: string; line: string }[] }).version?.map((entry) => entry.file),
    ["project/tasks/001-behind.md"],
  );
});

test("one blocked dossier stops the whole batch, and the current one is left untouched", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  const current = await withDossier(repo, "001-current.md", "3");
  const undeclared = await withDossier(repo, "002-undeclared.md");

  const lines: string[] = [];
  const result = await task.run(
    contextFor(repo, "close", {}, lines, ["project/tasks/001-current.md", "project/tasks/002-undeclared.md"]),
  );
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /002-undeclared\.md: declares no template version/);
  assert.doesNotMatch(result.summary ?? "", /001-current\.md/, "only the blocked dossier is named");
  assert.deepEqual(lines, []);
  // Partial closure is not acceptable: referrers are collected across the batch, so half a batch loses
  // what the other half's repair needs.
  assert.equal(await readFile(path.join(repo, "project", "tasks", "001-current.md"), "utf8"), current);
  assert.equal(await readFile(path.join(repo, "project", "tasks", "002-undeclared.md"), "utf8"), undeclared);
});

// A path that does not exist is not a version question. Answering it as one told the operator to declare
// frontmatter in a file that is not there — measured on 2026-08-11, before the existence check was moved
// ahead of the dispatch. The batch case matters more than the single one: one mistyped path in a batch
// must not be reported as a version problem across the whole set.
test("close on a path that does not exist says so, rather than reporting it as undeclared", async () => {
  const repo = await scratchRepo();
  await withTemplate(repo, "3");
  await withDossier(repo, "001-real.md", "3");

  const lines: string[] = [];
  const result = await task.run(
    contextFor(repo, "close", {}, lines, ["project/tasks/001-real.md", "project/tasks/999-nope.md"]),
  );
  assert.equal(result.code, 2);
  assert.match(result.summary ?? "", /no such dossier: project\/tasks\/999-nope\.md/);
  assert.doesNotMatch(result.summary ?? "", /version|frontmatter/i);
});
