import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDocumentStore, createTargetResolver } from "@entelekheia/vibe-ops-core";
import type { GateFinding, GateRunContext, TargetsPolicy } from "@entelekheia/vibe-ops-core";
import markdownLink from "../src/markdown-link/index.ts";

async function repo(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-markdown-link-"));
}

function ctx(repoRoot: string, files: readonly string[]): GateRunContext {
  return { repoRoot, pluginDir: repoRoot, files, options: {}, documents: createDocumentStore(repoRoot) };
}

test("an absolute path in a link fails, naming the target and the line", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), "line one\n\n[bad](/etc/passwd)\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.rule, "links");
  assert.equal(outcome.findings[0]!.line, 3);
  assert.match(outcome.findings[0]!.evidence, /absolute path/);
});

test("a link that climbs above the repository root fails as OUTSIDE, not as a normal miss", async () => {
  const repoRoot = await repo();
  await mkdir(path.join(repoRoot, "sub"), { recursive: true });
  await writeFile(path.join(repoRoot, "sub", "f.md"), "[climb](../../outside.md)\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["sub/f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /outside the repository/);
});

test("a relative link to a file that does not exist fails, naming the target", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), "[missing](nowhere.md)\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /does not resolve: nowhere\.md/);
});

test("a link inside a code span is not a finding — code_span has no link_destination child", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), "See `[fake](nowhere.md)` here.\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("external links, anchors, mailto, and an unexpanded template variable are all skipped", async () => {
  const repoRoot = await repo();
  const text = [
    "[ext](http://example.com/nowhere)",
    "[anchor](#nowhere)",
    "[mail](mailto:nobody@example.com)",
    "[var](${FOO}/nowhere.md)",
    "",
  ].join("\n");
  await writeFile(path.join(repoRoot, "f.md"), text);
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("a link that resolves — including one anchored with #fragment — passes", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "target.md"), "# target\n");
  await writeFile(path.join(repoRoot, "f.md"), "[good](target.md#section) and [also good](./target.md)\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 1);
});

test("a link written only inside a table cell is still found — the supplement, not the declared query, delivers it", async () => {
  const repoRoot = await repo();
  const text = ["| Field | Value |", "| --- | --- |", "| link | [missing](nowhere.md) |", ""].join("\n");
  await writeFile(path.join(repoRoot, "f.md"), text);
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.equal(outcome.findings[0]!.line, 3);
  assert.match(outcome.findings[0]!.evidence, /does not resolve: nowhere\.md/);
});

test("an image's link_destination is checked the same way a link's is", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), '![missing](nowhere.png "title")\n');
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.equal(outcome.findings.length, 1);
  assert.match(outcome.findings[0]!.evidence, /does not resolve: nowhere\.png/);
});

test("a shortcut link ([text] with no destination) is never collected — no finding, no crash", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.md"), "See [shortcut] for details.\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.md"]));
  assert.deepEqual(outcome.findings, []);
});

test("a file the model could not parse is not examined, and produces no crash", async () => {
  const repoRoot = await repo();
  await writeFile(path.join(repoRoot, "f.unknown"), "irrelevant\n");
  const outcome = await markdownLink.run(ctx(repoRoot, ["f.unknown"]));
  assert.deepEqual(outcome.findings, []);
  assert.equal(outcome.examined, 0);
});

// vibe-ops#41 — the verdict reads the repository, not the disk. A real repository is needed from here on:
// in a bare temporary directory the classifier falls back to the disk, which is the defect itself.

// Every fixture repository is built with the caller's git environment scrubbed. Run from a hook, git
// exports GIT_DIR and GIT_INDEX_FILE, which override `-C`: `git init` then re-initialises the CALLER's
// repository (from a linked worktree, writing core.bare=true into the shared config), `git config`
// writes the fixture identity there, and `git add` stages the fixture over its index (vibe-ops#36).
const fixtureEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: fixtureEnv });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
}

/** A root tracking only `docs/`, linking into an ignored sibling and at an untracked draft. */
async function allowlistRepo(): Promise<string> {
  const root = await realpath(await repo());
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "t");
  await writeFile(path.join(root, ".gitignore"), "/*\n!/.gitignore\n!/docs/\n");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "sibling"), { recursive: true });
  await writeFile(path.join(root, "sibling", "README.md"), "s\n");
  await writeFile(
    path.join(root, "docs", "a.md"),
    "[ok](b.md)\n[sib](../sibling/README.md)\n[gone](../sibling/gone.md)\n[draft](draft.md)\n",
  );
  await writeFile(path.join(root, "docs", "b.md"), "b\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "init");
  await writeFile(path.join(root, "docs", "draft.md"), "untracked\n");
  return root;
}

function repoCtx(repoRoot: string, files: readonly string[], policy?: TargetsPolicy): GateRunContext {
  return { ...ctx(repoRoot, files), targets: createTargetResolver(repoRoot, policy) };
}

const byLine = (findings: readonly GateFinding[]) =>
  findings.map((f) => ({ line: f.line, rule: f.rule, level: f.level ?? "fail" }));

test("report: an ignored target and an untracked one each fail under a rule of their own", async () => {
  const root = await allowlistRepo();
  const outcome = await markdownLink.run(repoCtx(root, ["docs/a.md"]));
  assert.deepEqual(byLine(outcome.findings), [
    { line: 2, rule: "links-ignored", level: "fail" },
    { line: 3, rule: "links-ignored", level: "fail" },
    { line: 4, rule: "links-untracked", level: "fail" },
  ]);
});

test("the same commit gets the same verdict from a linked working tree", async () => {
  const root = await allowlistRepo();
  const worktree = path.join(await realpath(await repo()), "wt");
  git(root, "worktree", "add", "-q", "--detach", worktree);
  const main = await markdownLink.run(repoCtx(root, ["docs/a.md"]));
  const linked = await markdownLink.run(repoCtx(worktree, ["docs/a.md"]));
  // The draft is untracked in the main checkout and absent from the worktree — the only line that may differ.
  const withoutDraft = (fs: readonly GateFinding[]) => byLine(fs).filter((f) => f.line !== 4);
  assert.deepEqual(withoutDraft(linked.findings), withoutDraft(main.findings));
});

test("follow: an ignored target that exists in the main working tree holds; one that does not is a plain miss", async () => {
  const root = await allowlistRepo();
  const worktree = path.join(await realpath(await repo()), "wt");
  git(root, "worktree", "add", "-q", "--detach", worktree);
  const outcome = await markdownLink.run(repoCtx(worktree, ["docs/a.md"], { ignored: "follow" }));
  const gone = outcome.findings.find((f) => f.line === 3);
  assert.equal(gone?.rule, "links");
  assert.match(gone!.evidence, /followed into the main working tree: .*sibling\/gone\.md/);
  assert.equal(outcome.findings.some((f) => f.line === 2), false);
});

test("an ignored document linking into an ignored path warns rather than fails — a clone carries neither", async () => {
  const root = await allowlistRepo();
  await writeFile(path.join(root, "sibling", "notes.md"), "[r](README.md)\n");
  const outcome = await markdownLink.run(repoCtx(root, ["sibling/notes.md"]));
  assert.deepEqual(byLine(outcome.findings), [{ line: 1, rule: "links-ignored", level: "warn" }]);
});
