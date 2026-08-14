import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { expandPluginToken, filterByGlobs, resolveArtifactDir, resolvePluginDir } from "../src/files.ts";

function git(cwd: string, args: readonly string[]): void {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
}

/** A repository with one commit, and a linked working tree cut from it. Returns both roots. */
async function repoWithLinkedWorktree(): Promise<{ main: string; linked: string }> {
  const main = await mkdtemp(path.join(tmpdir(), "vibeops-worktree-"));
  git(main, ["init", "-q", "."]);
  await writeFile(path.join(main, "a.txt"), "hi\n");
  git(main, ["add", "-A"]);
  git(main, ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "init"]);
  const linked = path.join(main, "..", `${path.basename(main)}-linked`);
  git(main, ["worktree", "add", "--detach", "-q", linked, "HEAD"]);
  return { main, linked: path.resolve(linked) };
}


test("resolvePluginDir finds plugin/ when it carries a manifest", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  await mkdir(path.join(repoRoot, "plugin", ".claude-plugin"), { recursive: true });
  await writeFile(path.join(repoRoot, "plugin", ".claude-plugin", "plugin.json"), "{}");
  assert.equal(resolvePluginDir(repoRoot), path.join(repoRoot, "plugin"));
});

test("resolvePluginDir falls back to the repository root in a flat layout", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  assert.equal(resolvePluginDir(repoRoot), repoRoot);
});

test("<plugin>/ expands to plugin/ in a nested layout and to nothing in a flat one", () => {
  const nested = "/repo";
  assert.equal(
    expandPluginToken("<plugin>/skills/*/SKILL.md", nested, path.join(nested, "plugin")),
    "plugin/skills/*/SKILL.md",
  );
  assert.equal(expandPluginToken("<plugin>/skills/*/SKILL.md", nested, nested), "skills/*/SKILL.md");
});

test("a pattern with no <plugin>/ token is returned unchanged", () => {
  assert.equal(expandPluginToken("AGENTS.md", "/repo", "/repo/plugin"), "AGENTS.md");
});

// THE WORKTREE TEST IS THE ONE THAT MATTERS. Against an ordinary checkout the old
// `path.resolve(repoRoot, declared)` gives the same answer this function does, so a test that never
// leaves a normal repository passes on the broken code and proves nothing.
test("a .git-relative artifactDir resolves into the main clone's .git from a linked working tree", async () => {
  const { main, linked } = await repoWithLinkedWorktree();

  // The premise, asserted rather than assumed: in a linked working tree `.git` is a FILE, which is why
  // resolving through the working tree produced a path under a file and mkdir raised ENOTDIR.
  assert.ok(statSync(path.join(linked, ".git")).isFile());

  // realpath on the expectation, not on the answer: from a linked tree the path comes back through
  // git, which resolves symlinks, and macOS reaches every mkdtemp directory through /private. The same
  // asymmetry scoped `--file` to an empty population once already (see cli/AGENTS.md, the hook surface).
  assert.equal(
    resolveArtifactDir(linked, ".git/gate-artifacts"),
    path.join(realpathSync(main), ".git", "gate-artifacts"),
  );
});

test("the same declaration is unchanged in an ordinary checkout — this moves no existing artifacts", async () => {
  const { main } = await repoWithLinkedWorktree();
  // Not realpath'ed: `--git-common-dir` answers `.git`, relative, so the result stays rooted wherever
  // the caller said the repository was — which is what makes this a no-op for every existing repo.
  assert.equal(resolveArtifactDir(main, ".git/gate-artifacts"), path.join(main, ".git", "gate-artifacts"));
});

test("an artifactDir outside .git is the plain resolve it always was, in both trees", async () => {
  const { main, linked } = await repoWithLinkedWorktree();
  assert.equal(resolveArtifactDir(main, "build/artifacts"), path.join(main, "build", "artifacts"));
  // Not the main clone's: only a `.git`-relative declaration is routed through git, so a working tree
  // keeping its artifacts beside its own files still does.
  assert.equal(resolveArtifactDir(linked, "build/artifacts"), path.join(linked, "build", "artifacts"));
});

test("outside a repository a .git-relative artifactDir falls back to the plain resolve", async () => {
  const loose = await mkdtemp(path.join(tmpdir(), "vibeops-notarepo-"));
  assert.equal(resolveArtifactDir(loose, ".git/gate-artifacts"), path.join(loose, ".git", "gate-artifacts"));
});

test("filterByGlobs matches AGENTS.md against both a bare pattern and **/AGENTS.md", () => {
  const files = ["AGENTS.md", "cli/AGENTS.md", "README.md"];
  assert.deepEqual(filterByGlobs(files, ["**/AGENTS.md"]), ["AGENTS.md", "cli/AGENTS.md"]);
  assert.deepEqual(filterByGlobs(files, ["AGENTS.md"]), ["AGENTS.md"]);
});
