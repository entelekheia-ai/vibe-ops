import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import type { GateRunContext } from "@entelekheia/vibe-ops-core";
import checkFrontmatter from "../src/check-frontmatter/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-frontmatter-"));
}

// documents added once here rather than in every call site below — see project/tasks/001-…, item 4.
function ctx(repoRoot: string, files: readonly string[], options: Record<string, unknown>): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options, documents: createDocumentStore(repoRoot) };
}

test("a rule with no frontmatter block fails", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "x.md"), "# no frontmatter here\n");
  const outcome = await checkFrontmatter.run(ctx(repoRoot, ["x.md"], { schema: "rule" }));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "frontmatter");
  assert.match(outcome.findings[0]!.evidence, /no frontmatter block/);
});

test("a rule with frontmatter but no description fails", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "x.md"), '---\npaths: ["x/**"]\n---\n\nbody\n');
  const outcome = await checkFrontmatter.run(ctx(repoRoot, ["x.md"], { schema: "rule" }));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /no description:/);
});

test("a rule with a description passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "x.md"), "---\ndescription: d\n---\n\nbody\n");
  const outcome = await checkFrontmatter.run(ctx(repoRoot, ["x.md"], { schema: "rule" }));
  assert.deepEqual(outcome.findings, []);
});

test("schema: skill catches an unquoted value containing \": \", naming the offending key", async () => {
  const repoRoot = await repo();
  await writeFile(
    path.join(repoRoot, "SKILL.md"),
    '---\nname: x\ndescription: template and numbering: an ADR\n---\n\nbody\n',
  );
  const outcome = await checkFrontmatter.run(ctx(repoRoot, ["SKILL.md"], { schema: "skill" }));
  // Plan-013 Track 5: this fixture now trips the parser too — `hasError` is a real, independent
  // detector alongside the textual heuristic, not a replacement for it. Two distinct findings, in a
  // fixed order: the structural parse failure first, then the heuristic naming the offending key —
  // which the parse failure alone cannot do, since a tree-sitter ERROR node's own span truncates well
  // before the fault it recovers from.
  assert.equal(outcome.findings.length, 2);
  assert.equal(outcome.findings[0]!.rule, "skill-frontmatter");
  assert.match(outcome.findings[0]!.evidence, /frontmatter does not parse/);
  assert.equal(outcome.findings[0]!.line, 3);
  assert.equal(outcome.findings[1]!.rule, "skill-frontmatter");
  assert.equal(outcome.findings[1]!.evidence, "description — unquoted value contains \": \", frontmatter will not parse and ALL fields are silently dropped");
});

test("schema: skill — hasError alone catches a fault the unquoted-colon heuristic cannot see", async () => {
  const repoRoot = await repo();
  // A tab-indented key: no unquoted ": " anywhere, so the old heuristic sees nothing. Only the parser
  // itself notices — and here it also cannot recover `description:`, which was past the fault, so the
  // "no description" finding is correct too: the file really would load with that field silently gone.
  await writeFile(path.join(repoRoot, "SKILL.md"), "---\nname: x\n\tdescription: bad indent\n---\n\nbody\n");
  const outcome = await checkFrontmatter.run(ctx(repoRoot, ["SKILL.md"], { schema: "skill" }));
  assert.equal(outcome.findings.length, 2);
  assert.match(outcome.findings[0]!.evidence, /frontmatter does not parse/);
  assert.match(outcome.findings[1]!.evidence, /no description/);
});

test("schema: skill — an unclosed quote is caught by hasError, naming the last key that parsed", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "SKILL.md"), '---\nname: x\ndescription: "unclosed\n---\n\nbody\n');
  const outcome = await checkFrontmatter.run(ctx(repoRoot, ["SKILL.md"], { schema: "skill" }));
  const parseFailure = outcome.findings.find((f) => /frontmatter does not parse/.test(f.evidence));
  assert.ok(parseFailure !== undefined);
  assert.match(parseFailure.evidence, /`name:`/);
});

test("schema: skill does not flag a quoted value containing \": \"", async () => {
  const repoRoot = await repo();
  await writeFile(
    path.join(repoRoot, "SKILL.md"),
    '---\nname: x\ndescription: "template and numbering: an ADR"\n---\n\nbody\n',
  );
  const outcome = await checkFrontmatter.run(ctx(repoRoot, ["SKILL.md"], { schema: "skill" }));
  assert.deepEqual(outcome.findings, []);
});
