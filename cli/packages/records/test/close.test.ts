// The three properties finalize.sh's own header names are the acceptance criteria for this port, and
// they are asserted here rather than read off the code — each one is an ordering, and an ordering is
// exactly what survives a refactor unnoticed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import { closeTasks, TaskCloseError } from "../src/close.ts";

const DOSSIER = (n: string) =>
  [
    `# Task-${n}: Something`,
    "",
    "| Field | Value |",
    "|---|---|",
    "| Status | Done |",
    "| Issue | https://github.com/o/r/issues/42 |",
    "",
    "## Closure",
    "",
    "- [ ] Run `/vibe-ops:close task` — do not just delete this file. Stays unchecked until closure",
    "      actually runs.",
    "",
  ].join("\n");

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" });
}

/** A repository with two dossiers, one plan, and one document linking to both dossiers. */
async function fixture(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-close-"));
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "t@example.invalid"]);
  git(repo, ["config", "user.name", "T"]);

  await mkdir(path.join(repo, "project", "tasks"), { recursive: true });
  await mkdir(path.join(repo, "project", "plans"), { recursive: true });
  await writeFile(path.join(repo, "project", "tasks", "001-alpha.md"), DOSSIER("001"));
  await writeFile(path.join(repo, "project", "tasks", "002-beta.md"), DOSSIER("002"));
  await writeFile(path.join(repo, "project", "plans", "001-p.md"), "# Plan-001\n\n## Tracks\n\n- [x] Track 1\n");
  // The referrer links with a RELATIVE path, which is how a sibling record actually writes one.
  await writeFile(
    path.join(repo, "project", "plans", "README.md"),
    "# Plans\n\nSee [alpha](../tasks/001-alpha.md) and [beta](../tasks/002-beta.md).\n",
  );

  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "seed"]);
  return repo;
}

const DOSSIERS = ["project/tasks/001-alpha.md", "project/tasks/002-beta.md"];

function closeAll(repo: string, extra: { plan?: string; dryRun?: boolean } = {}) {
  return closeTasks(
    { repoRoot: repo, dossiers: DOSSIERS, plan: extra.plan, dryRun: extra.dryRun ?? false },
    createDocumentStore(repo),
  );
}

test("property 1: referrers are collected across the whole batch, before anything is deleted", async () => {
  const repo = await fixture();
  const result = closeAll(repo);

  // One referrer, found for BOTH dossiers — a per-dossier collection interleaved with deletion would
  // have found it for the first and missed it for the second, since the file is rewritten in between.
  assert.deepEqual(result.referrers, ["project/plans/README.md"]);

  const readme = await readFile(path.join(repo, "project", "plans", "README.md"), "utf8");
  assert.match(readme, /alpha \(closed dossier — `git show [0-9a-f]{40}:project\/tasks\/001-alpha\.md`\)/);
  assert.match(readme, /beta \(closed dossier — `git show [0-9a-f]{40}:project\/tasks\/002-beta\.md`\)/);
  assert.doesNotMatch(readme, /\]\(/, "no link to a deleted file may survive");

  // And the collection step ran before the deletion step.
  const order = result.steps.map((s) => s.trim());
  assert.ok(order.indexOf("== referrers (collected before any deletion)") < order.indexOf("== delete the dossiers and repoint what referred to them"));
});

test("the repoint rewrites real links only — a code span and a fenced example survive it", async () => {
  // Measured 2026-08-10 on this exact fixture: the pattern finalize.sh used matches all THREE, the tree
  // finds the one. A plan referring to a dossier is the document most likely to be showing its own
  // reference syntax, so rewriting the other two damages it while looking like a successful closure.
  const repo = await fixture();
  await writeFile(
    path.join(repo, "project", "plans", "README.md"),
    [
      "# Plans",
      "",
      "A real reference: [alpha](../tasks/001-alpha.md).",
      "",
      "We write them as `[name](../tasks/001-alpha.md)` — a code span, not a link.",
      "",
      "```sh",
      "grep -l '[x](../tasks/001-alpha.md)' .",
      "```",
      "",
    ].join("\n"),
  );
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "a referrer that documents its own syntax"]);

  const result = closeTasks(
    { repoRoot: repo, dossiers: ["project/tasks/001-alpha.md"], dryRun: false },
    createDocumentStore(repo),
  );
  const readme = await readFile(path.join(repo, "project", "plans", "README.md"), "utf8");

  assert.match(readme, /A real reference: alpha \(closed dossier — `git show [0-9a-f]{40}:project\/tasks\/001-alpha\.md`\)\./);
  assert.match(readme, /`\[name\]\(\.\.\/tasks\/001-alpha\.md\)` — a code span/, "the code span is untouched");
  assert.match(readme, /grep -l '\[x\]\(\.\.\/tasks\/001-alpha\.md\)' \./, "the fenced example is untouched");
  assert.deepEqual(result.dangling, [], "and neither survivor counts as a dangling link, because neither is one");
});

test("a referrer that names a dossier without linking to it is left alone", async () => {
  const repo = await fixture();
  await writeFile(
    path.join(repo, "project", "plans", "README.md"),
    "# Plans\n\nThe work is tracked in 001-alpha.md, mentioned in prose only.\n",
  );
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "prose mention"]);

  const result = closeTasks(
    { repoRoot: repo, dossiers: ["project/tasks/001-alpha.md"], dryRun: false },
    createDocumentStore(repo),
  );
  assert.deepEqual(result.repointed, []);
  assert.ok(result.steps.some((s) => s.includes("carries no link to it — left alone")));
  assert.match(await readFile(path.join(repo, "project", "plans", "README.md"), "utf8"), /in 001-alpha\.md, mentioned/);
});

test("property 2: the breadcrumb sha names a commit that STILL CONTAINS the dossier", async () => {
  const repo = await fixture();
  const result = closeAll(repo, { plan: "project/plans/001-p.md" });

  // The whole point. If the tick were committed after the `git rm`, this would throw.
  for (const dossier of DOSSIERS) {
    const content = git(repo, ["show", `${result.dossierSha}:${dossier}`]);
    assert.match(content, /- \[x\] Run `\/vibe-ops:close task`/, "and it is the TICKED copy that is archived");
  }

  // The deletion is a later commit, and the dossiers are gone from the working tree and from HEAD.
  assert.notEqual(result.closeSha, result.dossierSha);
  for (const dossier of DOSSIERS) {
    assert.equal(existsSync(path.join(repo, dossier)), false);
    assert.throws(() => git(repo, ["show", `HEAD:${dossier}`]));
  }

  const plan = await readFile(path.join(repo, "project", "plans", "001-p.md"), "utf8");
  assert.match(plan, new RegExp(`git show ${result.dossierSha}:project/tasks/001-alpha\\.md`));
});

test("property 3: the dangling check runs after the deletion, and catches a link the repoint could not", async () => {
  const repo = await fixture();
  // A referrer git does not track is invisible to `git grep`, so the repoint never reaches it — which is
  // precisely the case the after-the-fact check exists to report rather than assume away.
  await writeFile(path.join(repo, "project", "plans", "untracked.md"), "[a](../tasks/001-alpha.md)\n");

  const result = closeAll(repo);
  const order = result.steps.map((s) => s.trim());
  assert.ok(
    order.indexOf("== delete the dossiers and repoint what referred to them") <
      order.indexOf("== dangling check, run AFTER the deletion"),
  );
  assert.deepEqual(result.dangling, [], "an untracked referrer is not in the population either way");

  // Now the same thing, tracked: it is found, and reported.
  const repo2 = await fixture();
  await writeFile(path.join(repo2, "project", "plans", "other.md"), "[a](../tasks/001-alpha.md)\n");
  git(repo2, ["add", "project/plans/other.md"]);
  git(repo2, ["commit", "-q", "-m", "another referrer"]);
  const result2 = closeTasks(
    { repoRoot: repo2, dossiers: ["project/tasks/002-beta.md"], dryRun: false },
    createDocumentStore(repo2),
  );
  assert.deepEqual(result2.dangling, [], "other.md links to alpha, which was not in this batch");
});

test("--dry-run narrates every step and mutates nothing — not the files, not the history", async () => {
  const repo = await fixture();
  const before = git(repo, ["rev-parse", "HEAD"]);
  const readmeBefore = await readFile(path.join(repo, "project", "plans", "README.md"), "utf8");

  const result = closeAll(repo, { plan: "project/plans/001-p.md", dryRun: true });

  assert.equal(git(repo, ["rev-parse", "HEAD"]), before, "no commit was made");
  assert.equal(git(repo, ["status", "--porcelain"]).trim(), "", "the working tree is untouched");
  assert.equal(await readFile(path.join(repo, "project", "plans", "README.md"), "utf8"), readmeBefore);
  for (const dossier of DOSSIERS) assert.equal(existsSync(path.join(repo, dossier)), true);

  assert.ok(result.steps.some((s) => s.includes("would tick: project/tasks/001-alpha.md")));
  assert.ok(result.steps.some((s) => s.includes("would run: git rm")));
  assert.ok(result.steps.some((s) => s.includes("would append the breadcrumbs")));
  // A pass here would mean nothing, so it is not claimed.
  assert.ok(result.steps.some((s) => s.includes("skipped under --dry-run: nothing was deleted")));
  assert.deepEqual(result.dangling, []);
});

test("a dossier already ticked is reported, not re-ticked, and does not stop the batch", async () => {
  const repo = await fixture();
  await writeFile(
    path.join(repo, "project", "tasks", "002-beta.md"),
    DOSSIER("002").replace("- [ ] Run", "- [x] Run"),
  );
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", "beta already closed by hand"]);

  const result = closeAll(repo);
  assert.deepEqual(result.ticked, ["project/tasks/001-alpha.md"]);
  assert.ok(result.steps.some((s) => s.includes("already ticked or no box: project/tasks/002-beta.md")));
  assert.equal(existsSync(path.join(repo, "project/tasks/002-beta.md")), false, "it is still deleted");
});

test("a dossier that does not exist stops the run before anything is touched", async () => {
  const repo = await fixture();
  const before = git(repo, ["rev-parse", "HEAD"]);
  assert.throws(
    () => closeTasks({ repoRoot: repo, dossiers: ["project/tasks/nope.md"], dryRun: false }, createDocumentStore(repo)),
    TaskCloseError,
  );
  assert.equal(git(repo, ["rev-parse", "HEAD"]), before);
});

test("an empty batch is refused rather than committing nothing", async () => {
  const repo = await fixture();
  assert.throws(() => closeTasks({ repoRoot: repo, dossiers: [], dryRun: false }, createDocumentStore(repo)), TaskCloseError);
});
