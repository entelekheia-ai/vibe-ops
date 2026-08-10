import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import checkFrontmatter from "../src/check-frontmatter/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-frontmatter-"));
}

test("a rule with no frontmatter block fails", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "x.md"), "# no frontmatter here\n");
  const outcome = await checkFrontmatter.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["x.md"],
    options: { schema: "rule" },
  });
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "frontmatter");
  assert.match(outcome.findings[0]!.evidence, /no frontmatter block/);
});

test("a rule with frontmatter but no description fails", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "x.md"), '---\npaths: ["x/**"]\n---\n\nbody\n');
  const outcome = await checkFrontmatter.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["x.md"],
    options: { schema: "rule" },
  });
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /no description:/);
});

test("a rule with a description passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "x.md"), "---\ndescription: d\n---\n\nbody\n");
  const outcome = await checkFrontmatter.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["x.md"],
    options: { schema: "rule" },
  });
  assert.deepEqual(outcome.findings, []);
});

test("schema: skill also catches an unquoted value containing \": \", naming the offending key", async () => {
  const repoRoot = await repo();
  await writeFile(
    path.join(repoRoot, "SKILL.md"),
    '---\nname: x\ndescription: template and numbering: an ADR\n---\n\nbody\n',
  );
  const outcome = await checkFrontmatter.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["SKILL.md"],
    options: { schema: "skill" },
  });
  // A textual heuristic, same as the shell fragment it replaces — it does not actually parse YAML, so
  // it does not know the unquoted colon would make a real parser drop the description too. Only the
  // one fault it can see fires.
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "skill-frontmatter");
  assert.equal(outcome.findings[0]!.evidence, "description — unquoted value contains \": \", frontmatter will not parse and ALL fields are silently dropped");
});

test("schema: skill does not flag a quoted value containing \": \"", async () => {
  const repoRoot = await repo();
  await writeFile(
    path.join(repoRoot, "SKILL.md"),
    '---\nname: x\ndescription: "template and numbering: an ADR"\n---\n\nbody\n',
  );
  const outcome = await checkFrontmatter.run({
    repoRoot,
    pluginDir: repoRoot,
    files: ["SKILL.md"],
    options: { schema: "skill" },
  });
  assert.deepEqual(outcome.findings, []);
});
