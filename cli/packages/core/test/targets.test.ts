import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTargetResolver } from "../src/targets.ts";

// Every fixture repository is built with the caller's git environment scrubbed. Run from a hook, git
// exports GIT_DIR and GIT_INDEX_FILE, which override `-C`: `git init` then re-initialises the CALLER's
// repository (from a linked worktree, writing core.bare=true into the shared config), `git config`
// writes the fixture identity there, and `git add` stages the fixture over its index (vibe-ops#36).
const fixtureEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: fixtureEnv });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
}

/**
 * The shape vibe-ops#41 was measured on: a root that tracks only an allowlist of its own folders and
 * whose docs link into a sibling folder it ignores, plus an untracked draft beside the tracked docs.
 */
async function allowlistRepo(): Promise<string> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "vibeops-targets-")));
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "t");
  await writeFile(path.join(root, ".gitignore"), "/*\n!/.gitignore\n!/docs/\n");
  await mkdir(path.join(root, "docs", "deep"), { recursive: true });
  await mkdir(path.join(root, "sibling"), { recursive: true });
  await writeFile(path.join(root, "docs", "a.md"), "a\n");
  await writeFile(path.join(root, "docs", "deep", "b.md"), "b\n");
  await writeFile(path.join(root, "sibling", "README.md"), "s\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "init");
  await writeFile(path.join(root, "docs", "draft.md"), "untracked\n");
  return root;
}

test("tracked files and the directories holding them are tracked; the root is too", async () => {
  const root = await allowlistRepo();
  const targets = createTargetResolver(root);
  assert.equal(targets.classify("docs/a.md").state, "tracked");
  assert.equal(targets.classify("docs/deep").state, "tracked");
  assert.equal(targets.classify("docs/deep/").state, "tracked");
  assert.equal(targets.classify("").state, "tracked");
});

test("a file only staged is tracked — a pre-commit run reads the index, not HEAD", async () => {
  const root = await allowlistRepo();
  await writeFile(path.join(root, "docs", "staged.md"), "s\n");
  git(root, "add", "docs/staged.md");
  assert.equal(createTargetResolver(root).classify("docs/staged.md").state, "tracked");
});

test("an untracked file on disk is untracked, and a missing one is absent", async () => {
  const root = await allowlistRepo();
  const targets = createTargetResolver(root);
  assert.equal(targets.classify("docs/draft.md").state, "untracked");
  assert.equal(targets.classify("docs/nowhere.md").state, "absent");
});

test("under the default policy an ignored target is reported, with nothing followed", async () => {
  const root = await allowlistRepo();
  const targets = createTargetResolver(root);
  assert.deepEqual(targets.policy, { ignored: "report" });
  assert.deepEqual(targets.classify("sibling/README.md"), { state: "ignored" });
});

test("the same commit classifies the same way in a linked working tree — the defect of vibe-ops#41", async () => {
  const root = await allowlistRepo();
  const worktree = path.join(await realpath(await mkdtemp(path.join(tmpdir(), "vibeops-targets-wt-"))), "wt");
  git(root, "worktree", "add", "-q", "--detach", worktree);

  const main = createTargetResolver(root);
  const linked = createTargetResolver(worktree);
  for (const target of ["docs/a.md", "sibling/README.md", "docs/nowhere.md"]) {
    assert.equal(linked.classify(target).state, main.classify(target).state, target);
  }
});

test("under follow, an ignored target resolves in the MAIN working tree, from a linked one too", async () => {
  const root = await allowlistRepo();
  const worktree = path.join(await realpath(await mkdtemp(path.join(tmpdir(), "vibeops-targets-wt-"))), "wt");
  git(root, "worktree", "add", "-q", "--detach", worktree);

  const linked = createTargetResolver(worktree, { ignored: "follow" });
  assert.deepEqual(linked.classify("sibling/README.md"), {
    state: "ignored",
    followed: { exists: true, where: path.join(root, "sibling", "README.md") },
  });
  assert.equal(linked.classify("sibling/gone.md").followed?.exists, false);
});

test("outside a git repository the disk is the only witness — the answer every gate gave before", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-targets-bare-"));
  await writeFile(path.join(dir, "here.md"), "h\n");
  const targets = createTargetResolver(dir);
  assert.equal(targets.classify("here.md").state, "tracked");
  assert.equal(targets.classify("gone.md").state, "absent");
});
