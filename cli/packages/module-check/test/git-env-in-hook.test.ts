// A git hook exports GIT_DIR / GIT_INDEX_FILE, which outrank `git -C`. `check --self-test` builds a throwaway
// repository and must not act on the real one when it runs inside the repository's own pre-commit.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BIN = new URL("../../cli/dist/bin.js", import.meta.url).pathname;

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

test("a pre-commit running --self-test from a linked worktree leaves core.bare and the index alone", () => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "vibeops-hook-env-")));
  try {
    const main = path.join(root, "main");
    const wt = path.join(root, "wt");
    git(root, "init", "-q", main);
    git(main, "config", "user.email", "t@example.com");
    git(main, "config", "user.name", "t");
    writeFileSync(path.join(main, "seed.txt"), "seed\n");
    git(main, "add", "-A");
    git(main, "commit", "-q", "-m", "seed");
    git(main, "worktree", "add", "-q", "-b", "side", wt);
    const hook = path.join(main, ".git", "hooks", "pre-commit");
    writeFileSync(hook, `#!/bin/sh\nnode "${BIN}" check --self-test >/dev/null 2>&1\nexit 0\n`);
    chmodSync(hook, 0o755);

    writeFileSync(path.join(wt, "change.txt"), "change\n");
    git(wt, "add", "change.txt");
    git(wt, "commit", "-q", "-m", "change");

    const bare = spawnSync("git", ["config", "--file", path.join(main, ".git", "config"), "core.bare"], { encoding: "utf8" });
    assert.notEqual(bare.stdout.trim(), "true", "core.bare was flipped by the hook's self-test");
    assert.deepEqual(git(wt, "ls-tree", "-r", "--name-only", "HEAD").split("\n").sort(), ["change.txt", "seed.txt"]);
    assert.equal(git(wt, "status", "--porcelain"), "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
