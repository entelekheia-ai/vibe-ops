// Plan-041 Track 5: what the report block's title names as the anchor of an analysis, and where a
// module's warnings go when the caller asks to hold them. Real repositories in a temporary directory,
// because the claim is about what git reports for each shape of checkout.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { defineModule } from "@entelekheia/vibe-ops-core";
import { anchorOf, runModule } from "../src/run.ts";

function git(...args: string[]): void {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
}

async function repoWithCommit(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "vibeops-anchor-repo-"));
  git("-C", repo, "init", "-q");
  git("-C", repo, "commit", "-q", "--allow-empty", "-m", "first");
  return repo;
}

test("anchorOf names a repository by its own folder, from its root and from a folder inside it", async () => {
  const repo = await repoWithCommit();
  const inside = path.join(repo, "docs", "deep");
  await mkdir(inside, { recursive: true });
  assert.equal(anchorOf(repo), path.basename(repo));
  assert.equal(anchorOf(inside), path.basename(repo));
});

test("anchorOf names a linked working tree's repository, not the working tree's folder", async () => {
  const repo = await repoWithCommit();
  const worktree = path.join(await mkdtemp(path.join(tmpdir(), "vibeops-anchor-wt-")), "some-branch-folder");
  git("-C", repo, "worktree", "add", "-q", worktree);
  assert.equal(anchorOf(worktree), path.basename(repo));
});

test("anchorOf names a bare repository without its .git suffix", async () => {
  const bare = path.join(await mkdtemp(path.join(tmpdir(), "vibeops-anchor-bare-")), "named.git");
  git("init", "-q", "--bare", bare);
  assert.equal(anchorOf(bare), "named");
});

test("anchorOf names a folder outside any repository by its own name", async () => {
  const folder = path.join(await mkdtemp(path.join(tmpdir(), "vibeops-anchor-none-")), "loose-folder");
  await mkdir(folder);
  const probe = spawnSync("git", ["-C", folder, "rev-parse", "--git-dir"], { encoding: "utf8" });
  assert.notEqual(probe.status, 0, "the temporary directory is inside a git repository; this test needs one that is not");
  assert.equal(anchorOf(folder), "loose-folder");
});

test("runModule hands a module's warnings to warnSink as whole lines, in order with its log lines", async () => {
  const plugin = defineModule({ id: "warner", version: "0.0.0", summary: "logs and warns" }, async (context) => {
    context.log("one");
    context.warn("careful");
    context.log("two");
    return { code: 0, summary: "done" };
  });
  const seen: string[] = [];
  await runModule({
    plugin,
    flags: {},
    args: [],
    cwd: process.cwd(),
    surface: "cli",
    sink: (message) => void seen.push(`out:${message}`),
    warnSink: (line) => void seen.push(`err:${line}`),
  });
  assert.deepEqual(seen, ["out:one", "err:warning: careful", "out:two"]);
});
