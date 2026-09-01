import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import {
  expandOptionTokens,
  expandPluginToken,
  expandRecordsToken,
  expandTemplateToken,
  expandTokens,
  filterByGlobs,
  resolveArtifactDir,
  resolvePluginDir,
} from "../src/files.ts";

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

// `<plugin>/templates/<type>.md` resolved to the repository ROOT in a repo laid out flat, and nothing
// writes a root-level templates/. So the check was inert in every repository this tooling scaffolds, and
// reported SKIP — indistinguishable, in the summary, from a repository that keeps no records.
test("<template:t> resolves to what the repository declared in records.templates", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  assert.equal(
    expandTemplateToken("<template:adr>", repoRoot, repoRoot, { templates: { adr: "docs/adr-template.md" } }),
    "docs/adr-template.md",
  );
});

test("<template:t> falls back to the first candidate that exists, never to a path nothing writes", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  await mkdir(path.join(repoRoot, "project", "templates"), { recursive: true });
  await writeFile(path.join(repoRoot, "project", "templates", "plan.md"), "# plan\n");
  assert.equal(expandTemplateToken("<template:plan>", repoRoot, repoRoot, undefined), "project/templates/plan.md");
});

// `log` is not a RecordType, so no config can declare it. A repository whose templates ARE its
// distributable keeps them under the plugin dir, and without that last candidate its log entry stops
// resolving — which is what a run against the one repository shaped that way reported.
test("<template:t> reaches the plugin surface for a type no config can declare", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  const pluginDir = path.join(repoRoot, "plugin");
  await mkdir(path.join(pluginDir, "templates"), { recursive: true });
  await writeFile(path.join(pluginDir, "templates", "log.md"), "# log\n");
  assert.equal(expandTemplateToken("<template:log>", repoRoot, pluginDir, undefined), "plugin/templates/log.md");
});

test("an absent template still names a path a reader recognises, so the SKIP is actionable", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  assert.equal(expandTemplateToken("<template:rfc>", repoRoot, repoRoot, undefined), "project/templates/rfc.md");
});

test("expandOptionTokens expands both tokens, leaves non-strings alone, and is idempotent", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  const expanded = expandOptionTokens(
    { template: "<template:adr>", runner: "<plugin>/sh/run.sh", schema: "adr", depth: 2 },
    repoRoot,
    path.join(repoRoot, "plugin"),
    { templates: { adr: "project/templates/adr.md" } },
  );
  assert.equal(expanded["template"], "project/templates/adr.md");
  assert.equal(expanded["runner"], "plugin/sh/run.sh");
  assert.equal(expanded["schema"], "adr", "a string carrying no token is untouched");
  assert.equal(expanded["depth"], 2, "a non-string option is passed through as it is");
  // A gate that expands <plugin>/ itself must keep working: a second pass finds no token.
  assert.deepEqual(expandOptionTokens(expanded, repoRoot, path.join(repoRoot, "plugin"), undefined), expanded);
});

// The same defect on the other field: an entry hardcoding `project/rfc/**/*.md` examines zero files in a
// repository that keeps RFCs under a plural directory it declared in its own config — and zero examined
// reports `ok`, which is the reading that says nothing while looking like everything is fine.
test("<records:t> resolves to the directory the repository declared", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  assert.equal(expandRecordsToken("<records:rfc>/**/*.md", repoRoot, { dirs: { rfc: "project/rfcs" } }), "project/rfcs/**/*.md");
});

test("<records:t> searches when nothing is declared, and rfc's plural is one of the candidates", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  await mkdir(path.join(repoRoot, "project", "rfcs"), { recursive: true });
  assert.equal(expandRecordsToken("<records:rfc>/*.md", repoRoot, undefined), "project/rfcs/*.md");
});

// A type the map does not name resolves by the generic convention, which is what lets a repository bring
// a type of its own without this map growing an entry for it.
test("<records:t> gives an unnamed type the generic convention", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  assert.equal(expandRecordsToken("<records:freeze-policy>/*.md", repoRoot, undefined), "project/freeze-policy/*.md");
});

// Deliberately not the search order: an entry examining zero files against the path the repository named
// is attributable to the declaration, where a quiet fallback to somewhere else is not.
test("a declared directory that does not exist is still used, so the report names it", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  await mkdir(path.join(repoRoot, "project", "rfc"), { recursive: true });
  assert.equal(expandRecordsToken("<records:rfc>/*.md", repoRoot, { dirs: { rfc: "docs/proposals" } }), "docs/proposals/*.md");
});

test("expandTokens applies every token, so paths and options mean the same thing", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  const records = { dirs: { adr: "docs/adr" }, templates: { adr: "docs/adr/_template.md" } };
  assert.equal(expandTokens("<records:adr>/*.md", repoRoot, repoRoot, records), "docs/adr/*.md");
  assert.equal(expandTokens("<template:adr>", repoRoot, repoRoot, records), "docs/adr/_template.md");
  assert.equal(expandTokens("<plugin>/skills/*", repoRoot, path.join(repoRoot, "plugin"), records), "plugin/skills/*");
});

test("filterByGlobs matches AGENTS.md against both a bare pattern and **/AGENTS.md", () => {
  const files = ["AGENTS.md", "cli/AGENTS.md", "README.md"];
  assert.deepEqual(filterByGlobs(files, ["**/AGENTS.md"]), ["AGENTS.md", "cli/AGENTS.md"]);
  assert.deepEqual(filterByGlobs(files, ["AGENTS.md"]), ["AGENTS.md"]);
});

// PLAN-029 TRACK 1'S ACCEPTANCE, and the reason the union was opened at all: a repository keeping an
// artifact this tooling does not ship must be able to SAY SO. Before this, `records: { dirs: { policy:
// … } }` was a compile error — the closed union of four literals was the single wall RFC-0003's whole
// model stopped at. The tokens were already generic (commits a4d01e7/50ad03e); only the config was not.
test("a type the tooling ships nowhere flows from config through both tokens", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  await mkdir(path.join(repoRoot, "project", "policy"), { recursive: true });
  const records = { dirs: { policy: "project/policy" }, templates: { policy: "project/policy/_template.md" } };

  assert.equal(expandTokens("<records:policy>/*.md", repoRoot, repoRoot, records), "project/policy/*.md");
  assert.equal(expandTokens("<template:policy>", repoRoot, repoRoot, records), "project/policy/_template.md");
});

// Declaring nothing must still resolve, or a contributed type would need a config line to exist at all.
// `project/<type>` is the generic convention core has always answered with; opening the union is what
// finally lets a repository reach it on purpose.
test("an undeclared type falls back to the generic convention rather than to nothing", async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "vibeops-files-"));
  await mkdir(path.join(repoRoot, "project", "policy"), { recursive: true });
  assert.equal(expandRecordsToken("<records:policy>/*.md", repoRoot, undefined), "project/policy/*.md");
});
