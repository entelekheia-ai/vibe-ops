import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtemp, mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import gate from "../src/template-heading-drift/index.ts";

// The fixture puts the plugin surface in a SUBDIRECTORY and addresses it through `<plugin>/`, because a
// fixture shaped like this repository would never exercise the token expansion at all (cli/AGENTS.md).

const NOTE = [
  "# plan 0.1 → 0.2 — the plan becomes an epic",
  "",
  "## What changed in the template",
  "",
  "| Section | 0.1 | 0.2 |",
  "|---|---|---|",
  "| `## Progress` | step-level checklist | **dropped** |",
  "| `## Tracks` | prose only | prose **plus one checkbox per track** |",
  "| `## Surprises & Discoveries` | living section | **dropped** |",
  "| `## Decision Log` | every decision | unchanged in shape, **narrowed in scope** |",
  "| Living sections | four | two — `Decision Log`, `Outcomes & Retrospective` |",
  "",
].join("\n");

/** A note of the other shape: no per-section rows, so it contributes nothing. */
const QUIET_NOTE = [
  "# task 0.2 → 3 — the version moves into the frontmatter",
  "",
  "| | 0.2 | 3 |",
  "|---|---|---|",
  "| Sections | — | **unchanged; none added, dropped, renamed or retyped** |",
  "",
].join("\n");

const PLAN_TEMPLATE = [
  "---",
  "vibe-ops-template: plan@3",
  "---",
  "",
  "# Plan-NNN: Title",
  "",
  "## Summary",
  "",
  "## Tracks",
  "",
  "<!-- ===== LIVING SECTIONS — maintained during the work ===== -->",
  "",
  "## Decision Log",
  "",
  "## Outcomes & Retrospective",
  "",
  "<!-- ===== END LIVING SECTIONS ===== -->",
  "",
].join("\n");

const TASK_TEMPLATE = [
  "---",
  "vibe-ops-template: task@3",
  "---",
  "",
  "# Task-NNN: Title",
  "",
  "## Context",
  "",
  "## Surprises & Discoveries",
  "",
].join("\n");

async function repo(): Promise<string> {
  // REALPATH, NOT THE RAW mkdtemp PATH. On macOS it returns `/var/...`, a symlink to `/private/var/...`,
  // and the document store resolves what it is handed: the note is then simply not found, `droppedSections`
  // reads an unparsed document, and every `-named` assertion fails against an empty dropped set while the
  // count rule keeps passing. The same mismatch is recorded in cli/AGENTS.md for the hook surface.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "vibeops-template-heading-drift-")));
  await mkdir(path.join(root, "plugin", "templates"), { recursive: true });
  await mkdir(path.join(root, "plugin", "migrations"), { recursive: true });
  await writeFile(path.join(root, "plugin", "migrations", "plan-0.1-to-0.2.md"), NOTE);
  await writeFile(path.join(root, "plugin", "migrations", "task-0.2-to-3.md"), QUIET_NOTE);
  await writeFile(path.join(root, "plugin", "templates", "plan.md"), PLAN_TEMPLATE);
  await writeFile(path.join(root, "plugin", "templates", "task.md"), TASK_TEMPLATE);
  return root;
}

function ctx(repoRoot: string, files: readonly string[]): GateRunContext {
  return {
    repoRoot,
    pluginDir: path.join(repoRoot, "plugin"),
    files,
    options: {
      migrations: "<plugin>/migrations",
      templates: { plan: "<plugin>/templates/plan.md", task: "<plugin>/templates/task.md" },
    },
    documents: createDocumentStore(repoRoot),
  };
}

async function run(root: string, name: string, body: string) {
  await writeFile(path.join(root, name), body);
  return gate.run(ctx(root, [name]));
}

test("a document describing a plan's shape must not name a section the plan template dropped", async () => {
  const root = await repo();
  const outcome = await run(
    root,
    "rule.md",
    ["### Plan (`project/plans/`)", "", "Two sections are living: `Progress` and `Decision Log`.", ""].join("\n"),
  );
  assert.equal(outcome.examined, 1);
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "template-heading-drift-named");
  assert.equal(outcome.findings[0]!.line, 3);
  assert.match(outcome.findings[0]!.evidence, /Progress/);
  // The failure names the TEMPLATE, so a reader knows whether the sentence is wrong or merely about a
  // different type — one of the two properties the sweep that preceded this gate was missing.
  assert.match(outcome.findings[0]!.evidence, /plan template/);
});

test("the same heading is correct about a task, because task@3 still has it", async () => {
  const root = await repo();
  const outcome = await run(
    root,
    "rule.md",
    ["### Task (`project/tasks/`)", "", "Route each `Surprises & Discoveries` entry at closure.", ""].join("\n"),
  );
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("EVERY occurrence is reported, not the first — the failure being prevented is a partial sweep", async () => {
  const root = await repo();
  const outcome = await run(
    root,
    "plan.md",
    [
      "# Writing a plan",
      "",
      "A plan carries `Progress`, updated at every stopping point.",
      "",
      "A plan's `Surprises & Discoveries` is filled in when the surprise happens.",
      "",
    ].join("\n"),
  );
  assert.equal(outcome.findings.length, 2);
  assert.deepEqual(
    outcome.findings.map((finding) => finding.line),
    [3, 5],
  );
});

test("a heading inside a fenced block is being shown, not claimed", async () => {
  const root = await repo();
  const outcome = await run(
    root,
    "plan.md",
    ["# Writing a plan", "", "```markdown", "## Progress", "## Surprises & Discoveries", "```", ""].join("\n"),
  );
  assert.deepEqual(outcome.findings, []);
});

test("a code span that MERELY CONTAINS the name is not naming it", async () => {
  // The regression this exists for: `Status` moves `Backlog → In Progress → Shipped` is a status value
  // in this repository's own plan reference, and a substring match reported it as a claim about a
  // dropped section — in the right file, about the right record type, and wrong.
  const root = await repo();
  const outcome = await run(
    root,
    "plan.md",
    ["# Writing a plan", "", "`Status` moves `Backlog → In Progress → Shipped`. The file is never deleted.", ""].join(
      "\n",
    ),
  );
  assert.deepEqual(outcome.findings, []);
});

test("a claim about how many sections are living is checked against the template", async () => {
  const root = await repo();
  const outcome = await run(
    root,
    "rule.md",
    ["### Plan (`project/plans/`)", "", "Four sections are living and are maintained while the work happens.", ""].join(
      "\n",
    ),
  );
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "template-heading-drift-count");
  assert.match(outcome.findings[0]!.evidence, /Four/);
  assert.match(outcome.findings[0]!.evidence, /declares 2/);
});

test("the count nearest the word `sections` is the one reported", async () => {
  const root = await repo();
  const outcome = await run(
    root,
    "plan.md",
    ["# Plans", "", "Trap 5 is the one with a measurement: it named the four living sections in its own text.", ""].join(
      "\n",
    ),
  );
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /claims four/);
});

test("a sentence naming two record types is reported as unattributed, never guessed at", async () => {
  const root = await repo();
  const outcome = await run(
    root,
    "contrast.md",
    ["# Records", "", "A plan is permanent and `Surprises & Discoveries` lives in the task dossier.", ""].join("\n"),
  );
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "template-heading-drift-unattributed");
  // The gate's own default is advisory; whether it blocks is the repository's, through `level`.
  assert.equal(outcome.findings[0]!.level, "warn");
});

test("a repository whose notes drop nothing is skipped, never reported clean", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "vibeops-template-heading-drift-quiet-")));
  await mkdir(path.join(root, "plugin", "migrations"), { recursive: true });
  await mkdir(path.join(root, "plugin", "templates"), { recursive: true });
  await writeFile(path.join(root, "plugin", "migrations", "task-0.2-to-3.md"), QUIET_NOTE);
  await writeFile(path.join(root, "a.md"), "Some prose naming `Progress` freely.\n");
  const outcome = await gate.run({
    repoRoot: root,
    pluginDir: path.join(root, "plugin"),
    files: ["a.md"],
    options: { migrations: "<plugin>/migrations", templates: {} },
    documents: createDocumentStore(root),
  });
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, undefined);
  assert.match(outcome.skipped ?? "", /no migration note/);
});

test("options.migrations is required — the dropped set has no other source", async () => {
  const root = await repo();
  await assert.rejects(
    () =>
      gate.run({
        repoRoot: root,
        pluginDir: path.join(root, "plugin"),
        files: [],
        options: { templates: {} },
        documents: createDocumentStore(root),
      }),
    /options\.migrations/,
  );
});

test("against this repository's own tree — the CLI's markdown is clean", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
  const files = execSync("git ls-files 'cli/**/*.md' README.md AGENTS.md", { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  assert.ok(files.length > 5, "expected the real corpus, not an empty list");
  const outcome = await gate.run({
    repoRoot,
    pluginDir: path.join(repoRoot, "plugin"),
    files,
    options: {
      migrations: "<plugin>/skills/migrate/migrations",
      templates: {
        adr: "<plugin>/templates/adr.md",
        log: "<plugin>/templates/log.md",
        plan: "<plugin>/templates/plan.md",
        rfc: "<plugin>/templates/rfc.md",
        task: "<plugin>/templates/task.md",
      },
    },
    documents: createDocumentStore(repoRoot),
  });
  assert.deepEqual(outcome.findings, []);
});
