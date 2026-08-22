import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import { resolveRecord } from "../src/resolve.ts";
import { RecordsConfigError } from "../src/layout.ts";
import { formatResolved } from "../src/format.ts";

const run = promisify(execFile);

const PLAN_TEMPLATE = [
  "# Plan-NNN: Title",
  "",
  "| Field | Value |",
  "|---|---|",
  "| Status | Backlog |",
  "",
  "<!-- Status lifecycle: Backlog → In Progress → Shipped. The file is never deleted. -->",
  "",
  "<!-- ===== LIVING SECTIONS -->",
  "## Decision Log",
  "## Outcomes & Retrospective",
  "<!-- ===== END LIVING SECTIONS -->",
  "",
].join("\n");

async function scratchRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-resolve-"));
  await run("git", ["init", "-q"], { cwd: dir });
  return dir;
}

test("resolveRecord(plan): directory, template, next number, active status and living sections, in one pass", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await writeFile(path.join(repo, "project", "plans", "001-first.md"), "");
  await mkdir(path.join(repo, "project", "templates"), { recursive: true });
  await writeFile(path.join(repo, "project", "templates", "plan.md"), PLAN_TEMPLATE);

  const resolved = resolveRecord("plan", repo, undefined, createDocumentStore(repo));
  assert.equal(resolved.dir, "project/plans");
  assert.equal(resolved.template, "project/templates/plan.md");
  assert.equal(resolved.templateSource, "search");
  assert.equal(resolved.next, "002");
  assert.equal(resolved.plan?.active, "In Progress");
  assert.deepEqual(resolved.plan?.living, ["Decision Log", "Outcomes & Retrospective"]);
});

test("resolveRecord(plan): a records.templates override reports (config), not (search) — the fix for defect 2", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "plugin", "templates"), { recursive: true });
  await writeFile(path.join(repo, "plugin", "templates", "plan.md"), PLAN_TEMPLATE);

  const resolved = resolveRecord("plan", repo, { records: { templates: { plan: "plugin/templates/plan.md" } } }, createDocumentStore(repo));
  assert.equal(resolved.dir, undefined, "no project/plans/ here — matches the shell's (none) in this exact repository shape");
  assert.equal(resolved.template, "plugin/templates/plan.md");
  assert.equal(resolved.templateSource, "config");
  assert.deepEqual(resolved.plan?.living, ["Decision Log", "Outcomes & Retrospective"], "LIVING is real, not (unknown)");
  assert.ok(formatResolved(resolved).includes("TPL=plugin/templates/plan.md (config)"));
});

test("resolveRecord: a declared config path that does not exist throws RecordsConfigError, not a silent fallback", () => {
  assert.throws(
    () => resolveRecord("plan", "/does/not/matter", { records: { templates: { plan: "nowhere.md" } } }, createDocumentStore("/does/not/matter")),
    RecordsConfigError,
  );
});

test("resolveRecord(task): GitHub facts are attached, and only for task", async () => {
  const repo = await scratchRepo();
  await run("git", ["remote", "add", "origin", "git@github.com:someone/somerepo.git"], { cwd: repo });

  const resolved = resolveRecord("task", repo, undefined, createDocumentStore(repo));
  assert.equal(resolved.task?.ghRemote, "someone/somerepo");
  assert.ok(["ok", "no", "absent"].includes(resolved.task?.ghAuth ?? ""));
  assert.equal(resolved.plan, undefined);
});

test("resolveRecord(adr): no plan/task fields attached at all — those are per-type, not per-call", async () => {
  const repo = await scratchRepo();
  const resolved = resolveRecord("adr", repo, undefined, createDocumentStore(repo));
  assert.equal(resolved.plan, undefined);
  assert.equal(resolved.task, undefined);
});

test("formatResolved: NEXT renders the unknown-numbering sentence, naming AUTHORITY", async () => {
  const repo = await scratchRepo();
  await mkdir(path.join(repo, "project", "adr"), { recursive: true });
  await writeFile(path.join(repo, "project", "adr", "DA01-02-slug.md"), "");

  const resolved = resolveRecord("adr", repo, undefined, createDocumentStore(repo));
  const lines = formatResolved(resolved);
  assert.ok(lines.some((line) => line.startsWith("NEXT=(unknown") && line.includes("follow AUTHORITY")));
});
