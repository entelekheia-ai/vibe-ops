import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import recordFrontmatter from "../src/record-frontmatter/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-record-frontmatter-"));
}

/** What `log` declares in its own manifest — the shape this gate was written against. */
const LOG_REQUIRED = ["name", "description", "kind", "path", "attempted", "source"] as const;

function ctx(repoRoot: string, files: readonly string[], type: string, required: readonly string[]): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: { type, required }, documents: createDocumentStore(repoRoot) };
}

const COMPLETE = [
  "---",
  "name: a-trap",
  "description: One line.",
  "kind: trap",
  'path:\n  - "src/**"',
  "attempted: 2026-08-20",
  "source: a commit",
  "---",
  "",
  "# The trap",
  "",
].join("\n");

test("every required key present passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "a.md"), COMPLETE);
  const outcome = await recordFrontmatter.run(ctx(repoRoot, ["a.md"], "log", LOG_REQUIRED));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("missing keys are named, and only the missing ones", async () => {
  const repoRoot = await repo();
  await writeFile(
    path.join(repoRoot, "a.md"),
    ["---", "name: a-trap", "description: One line.", "---", "", "# x", ""].join("\n"),
  );
  const outcome = await recordFrontmatter.run(ctx(repoRoot, ["a.md"], "log", LOG_REQUIRED));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "record-frontmatter-log");
  assert.equal(outcome.findings[0]!.evidence, "frontmatter is missing kind, path, attempted, source");
});

test("no frontmatter at all is its own finding, naming what the type declares", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "a.md"), "# Just a heading\n\nbody.\n");
  const outcome = await recordFrontmatter.run(ctx(repoRoot, ["a.md"], "log", LOG_REQUIRED));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /^no frontmatter — a log record declares name, description/);
});

// A SEQUENCE IS A KEY LIKE ANY OTHER. `path:` is a list of globs, and a reader that only saw scalars
// would report it missing on every well-formed entry — the failure that looks like a finding.
test("a key whose value is a sequence counts as present", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "a.md"), COMPLETE);
  const outcome = await recordFrontmatter.run(ctx(repoRoot, ["a.md"], "log", ["path"]));
  assert.deepEqual(outcome.findings, []);
});

// The same acceptance `record-header` carries: a type nobody hardcoded, examined under its own name.
test("a type the tooling ships nowhere is examined against its own key list", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "p.md"), ["---", "owner: someone", "---", "", "# x", ""].join("\n"));
  const outcome = await recordFrontmatter.run(ctx(repoRoot, ["p.md"], "policy", ["owner", "reviewed"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "record-frontmatter-policy");
  assert.match(outcome.findings[0]!.evidence, /missing reviewed/);
});

test("an entry declaring no type, or no keys, throws rather than reporting a clean sweep", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "a.md"), COMPLETE);
  const base = { repoRoot, pluginDir: repoRoot, files: ["a.md"], documents: createDocumentStore(repoRoot) };
  await assert.rejects(
    () => recordFrontmatter.run({ ...base, options: { required: ["name"] } } as GateRunContext),
    /requires options\.type/,
  );
  await assert.rejects(
    () => recordFrontmatter.run({ ...base, options: { type: "log" } } as GateRunContext),
    /requires options\.required/,
  );
});

// The population this entry actually runs over in this repository.
test("against this repository's own real log entries — every one passes", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const store = createDocumentStore(repoRoot);
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(path.join(repoRoot, "project", "log"))
    .filter((name) => name.endsWith(".md") && name !== "README.md" && name !== "RETIRED.md")
    .map((name) => `project/log/${name}`);
  assert.ok(files.length > 0, "there are log entries to read");
  const outcome = await recordFrontmatter.run({
    repoRoot,
    pluginDir: path.join(repoRoot, "plugin"),
    files,
    options: { type: "log", required: LOG_REQUIRED },
    documents: store,
  });
  assert.deepEqual(outcome.findings, [], "every real log entry declares all six keys");
});
