// Each rule this gate reports is acted on differently, so each is asserted separately — a single
// "it finds problems" test would let two of them collapse into one and nobody would notice.
//
// The prose case is here as well as in the reader's own tests, deliberately: it is the false positive
// that produced a wrong measurement of this repository, and the gate is where anyone would meet it again.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import templateVersion from "../src/template-version/index.ts";

const TEMPLATE = "plan-template.md";

async function repo(templateDeclares = "plan@3"): Promise<string> {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-template-version-"));
  const body = templateDeclares === "" ? "# Plan-NNN: Title" : `---\nvibe-ops-template: ${templateDeclares}\n---\n\n# Plan-NNN: Title`;
  await writeFile(path.join(repoRoot, TEMPLATE), body);
  return repoRoot;
}

function ctx(repoRoot: string, files: readonly string[]): GateRunContext {
  return {
    repoRoot,
    pluginDir: repoRoot,
    files,
    options: { template: TEMPLATE },
    documents: createDocumentStore(repoRoot),
  };
}

const PLAN = (declaration: string, status = "Shipped", body = "") =>
  [declaration, "", "# Plan-001: A title", "", "| Field | Value |", "|---|---|", `| Status | ${status} |`, "", "## Summary", "", body].join("\n");

async function run(repoRoot: string, name: string, content: string) {
  await writeFile(path.join(repoRoot, name), content);
  return templateVersion.run(ctx(repoRoot, [name]));
}

test("a record declaring the template's own version is clean", async () => {
  const repoRoot = await repo();
  const outcome = await run(repoRoot, "a.md", PLAN("---\nvibe-ops-template: plan@3\n---"));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("an undeclared record is reported as undeclared — never resolved to the oldest version", async () => {
  const repoRoot = await repo();
  const outcome = await run(repoRoot, "b.md", "# Plan-001: A title\n\n## Summary\n");
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "template-version-undeclared");
  assert.match(outcome.findings[0]!.evidence, /plan@3/);
});

test("a behind record names the gap AND its Status, so open-and-behind is answerable", async () => {
  const repoRoot = await repo();
  const outcome = await run(repoRoot, "c.md", PLAN("---\nvibe-ops-template: plan@0.2\n---", "In Progress"));
  assert.equal(outcome.findings[0]!.rule, "template-version-behind");
  assert.match(outcome.findings[0]!.evidence, /plan@0\.2/);
  assert.match(outcome.findings[0]!.evidence, /Status: In Progress/);
});

test("0.x orders below an integer rather than above it", async () => {
  const repoRoot = await repo();
  const behind = await run(repoRoot, "d.md", PLAN("---\nvibe-ops-template: plan@0.9\n---"));
  assert.equal(behind.findings[0]!.rule, "template-version-behind");
});

test("a record ahead of its template is its own rule, not a migration candidate", async () => {
  const repoRoot = await repo();
  const outcome = await run(repoRoot, "e.md", PLAN("---\nvibe-ops-template: plan@4\n---"));
  assert.equal(outcome.findings[0]!.rule, "template-version-ahead");
});

test("a record declaring another type's token is a mismatch, not a version gap", async () => {
  const repoRoot = await repo();
  const outcome = await run(repoRoot, "f.md", PLAN("---\nvibe-ops-template: adr@2\n---"));
  assert.equal(outcome.findings[0]!.rule, "template-version-mismatch");
  assert.match(outcome.findings[0]!.evidence, /adr@2/);
});

test("the pre-frontmatter comment form still reads as declared", async () => {
  const repoRoot = await repo();
  const outcome = await run(repoRoot, "g.md", PLAN("<!-- vibe-ops-template plan@0.2 — KEEP THIS LINE. -->"));
  assert.equal(outcome.findings[0]!.rule, "template-version-behind");
});

// The measured false positive, at the surface where someone meets it.
test("a version mentioned only in the body is not a declaration", async () => {
  const repoRoot = await repo();
  const outcome = await run(
    repoRoot,
    "h.md",
    PLAN("# Plan-008: About versioning", "Shipped", "Every plan at `plan@0.2` carries a Progress section."),
  );
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "template-version-undeclared");
});

test("a template that declares nothing fails on the TEMPLATE, not on every record under it", async () => {
  const repoRoot = await repo("");
  const outcome = await run(repoRoot, "i.md", PLAN("---\nvibe-ops-template: plan@3\n---"));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.file, TEMPLATE);
  assert.equal(outcome.examined, 0);
});

test("options.template is required — a composition that forgets it fails loudly", async () => {
  const repoRoot = await repo();
  await assert.rejects(
    () =>
      templateVersion.run({
        repoRoot,
        pluginDir: repoRoot,
        files: [],
        options: {},
        documents: createDocumentStore(repoRoot),
      }),
    /requires options\.template/,
  );
});
