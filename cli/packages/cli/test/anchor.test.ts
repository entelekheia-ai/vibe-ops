// Plan-041 Track 5: what the report block's title names as the anchor of an analysis, and where a
// module's warnings go when the caller asks to hold them. Real repositories in a temporary directory,
// because the claim is about what git reports for each shape of checkout.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
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

test("anchorOf names a repository kept in the .bare layout by its folder, from the root and a linked working tree", async () => {
  // The layout: `project/.bare` is a bare clone, `project/.git` a gitfile pointing at it, and each branch a
  // linked working tree beside it. The common dir is `project/.bare`, whose name is not the repository's.
  const source = await repoWithCommit();
  const project = path.join(await mkdtemp(path.join(tmpdir(), "vibeops-anchor-dotbare-")), "project");
  await mkdir(project);
  git("clone", "-q", "--bare", source, path.join(project, ".bare"));
  await writeFile(path.join(project, ".git"), "gitdir: ./.bare\n");
  git("-C", project, "worktree", "add", "-q", path.join(project, "main"));
  assert.equal(anchorOf(project), "project");
  assert.equal(anchorOf(path.join(project, "main")), "project");
});

test("anchorOf does not name the folder holding a hidden git dir that is not a repository's own", async () => {
  // `git init --separate-git-dir store/.sep-git work`: the common dir is `store/.sep-git`, but `store` is
  // only where the metadata lives — no `store/.git` — so the anchor is the working tree's own name.
  const root = await mkdtemp(path.join(tmpdir(), "vibeops-anchor-sepdir-"));
  const work = path.join(root, "gitfile-repo");
  await mkdir(path.join(root, "store"));
  git("init", "-q", "--separate-git-dir", path.join(root, "store", ".sep-git"), work);
  assert.equal(anchorOf(work), "gitfile-repo");
});

test("anchorOf does not name a .bare directory's parent when the parent carries no .git", async () => {
  // A `.bare` clone on its own, no gitfile beside it: the parent is not the repository's folder, so a
  // linked working tree of it is named by its own toplevel.
  const source = await repoWithCommit();
  const root = await mkdtemp(path.join(tmpdir(), "vibeops-anchor-lonebare-"));
  const holder = path.join(root, "holder");
  await mkdir(holder);
  git("clone", "-q", "--bare", source, path.join(holder, ".bare"));
  const tree = path.join(root, "lone-tree");
  git("-C", path.join(holder, ".bare"), "worktree", "add", "-q", tree);
  assert.equal(anchorOf(tree), "lone-tree");
});

test("anchorOf falls back to the toplevel's name when git does not understand --path-format", async () => {
  // Emulates git before 2.31: the unknown `--path-format=absolute` is echoed back and the common dir is
  // printed relative. `--show-toplevel` is understood, as it has been for much longer.
  const repo = await repoWithCommit();
  const inside = path.join(repo, "docs");
  await mkdir(inside);
  const bin = await mkdtemp(path.join(tmpdir(), "vibeops-anchor-oldgit-"));
  const fake = path.join(bin, "git");
  await writeFile(
    fake,
    `#!/bin/sh\ncase "$*" in\n  *--show-toplevel*) echo ${JSON.stringify(repo)} ;;\n  *) echo "--path-format=absolute"; echo ".git" ;;\nesac\n`,
  );
  await chmod(fake, 0o755);
  const saved = process.env["PATH"];
  process.env["PATH"] = `${bin}${path.delimiter}${saved ?? ""}`;
  try {
    assert.equal(anchorOf(inside), path.basename(repo));
  } finally {
    process.env["PATH"] = saved;
  }
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
