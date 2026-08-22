// Promulgation — Plan-025 Track 5. Against real git repositories, because every claim this verb makes is
// about git's behaviour and none of it survives being mocked: an ignored path staging as nothing, a
// linked working tree inheriting the clone's ignore list, a tag surviving the directory it was made in.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { boundaryRefusals, classOf, sync, widens } from "../src/index.ts";
import type { Ownership } from "../src/index.ts";

function git(cwd: string, args: readonly string[]): string {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return (result.stdout ?? "").trim();
}

/** An installed norm: the templates promulgation would write, the generated index `shippedVersions()`
 *  reads their version from (Plan-030 Track 1), and the declaration that classifies them. */
async function source(version = 1): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "vibeops-norm-"));
  await mkdir(path.join(root, "templates"), { recursive: true });
  const index: Record<string, { version: number }> = {};
  for (const type of ["adr", "plan"]) {
    await writeFile(path.join(root, "templates", `${type}.md`), `---\nvibe-ops-template: ${type}@3\n---\n\n# ${type}\n`);
    index[type] = { version: 3 };
  }
  await mkdir(path.join(root, "types"), { recursive: true });
  await writeFile(path.join(root, "types", "index.json"), JSON.stringify(index));
  await writeFile(
    path.join(root, "ownership.json"),
    JSON.stringify({
      version,
      classes: { norm: "n", seed: "s", repo: "r" },
      paths: [{ match: "project/templates/{adr,rfc,plan,task,log}.md", class: "norm", why: "each declares its own version" }],
    }),
  );
  return root;
}

async function target(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "vibeops-target-"));
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "t@example.invalid"]);
  git(root, ["config", "user.name", "T"]);
  await writeFile(path.join(root, "README.md"), "# target\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-q", "-m", "seed"]);
  return root;
}

test("sync leaves the target's working tree untouched, and stops at a branch and a tag", async () => {
  const repoRoot = await target();
  const sourceRoot = await source();

  // Uncommitted work in the target. The whole point of the linked working tree is that this survives
  // untouched — not that it is stashed and restored, which is the version with a failure mode.
  await writeFile(path.join(repoRoot, "README.md"), "# target, mid-edit\n");

  const result = await sync({ repoRoot, sourceRoot, dryRun: false });

  assert.equal(await readFile(path.join(repoRoot, "README.md"), "utf8"), "# target, mid-edit\n");
  assert.equal(git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]), "main", "the target stayed on its own branch");
  assert.equal(result.branch, "vibe-ops/norm-1");
  assert.equal(result.tag, "vibe-ops/norm@1");

  const changed = git(repoRoot, ["diff", "--name-only", "main", result.branch!]).split("\n").filter((n) => n !== "");
  assert.deepEqual(changed.sort(), ["project/templates/adr.md", "project/templates/plan.md"]);

  // The durable artifacts are the branch and the tag; the directory is not one of them.
  assert.equal(git(repoRoot, ["worktree", "list"]).split("\n").length, 1, "no sibling working tree left behind");
  assert.ok(git(repoRoot, ["tag", "-l", "vibe-ops/norm@1"]) !== "", "the tag survives the tree it was made in");
});

// `worktree add -B` creates the branch BEFORE anything is committed to it, so a run that threw used to
// leave `vibe-ops/norm-1` sitting at base: no commit, no tag, `harness status` still saying never
// promulgated. Litter shaped like a partial success — the next reader has to prove it is empty before
// daring to delete it. Found by a real promulgation that failed for an unrelated reason, 2026-08-14.
test("a run that fails deletes the branch it created, when nothing ever landed on it", async () => {
  const repoRoot = await target();
  const sourceRoot = await source();

  // A gate the target refuses to pass. This is the real failure shape: `sync` commits inside the linked
  // working tree, so the target's own hook runs and can reject it.
  const hooks = path.join(repoRoot, "refusing-hooks");
  await mkdir(hooks, { recursive: true });
  await writeFile(path.join(hooks, "pre-commit"), "#!/bin/sh\necho 'the gate says no' >&2\nexit 1\n", { mode: 0o755 });
  git(repoRoot, ["config", "core.hooksPath", hooks]);

  await assert.rejects(() => sync({ repoRoot, sourceRoot, dryRun: false }), /the promulgation commit failed/);

  assert.equal(git(repoRoot, ["branch", "--list", "vibe-ops/norm-1"]), "", "the empty branch must not survive");
  assert.equal(git(repoRoot, ["tag", "-l", "vibe-ops/norm@1"]), "", "and neither should a tag");
  assert.equal(git(repoRoot, ["worktree", "list"]).split("\n").length, 1, "no sibling working tree left behind");
  assert.equal(git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]), "main", "the target stayed on its own branch");
});

// The verb has to record what it did, or the question the whole mechanism exists to answer — "which
// repositories are on version N?" — is left exactly as unanswered by the act that should have answered it.
// Shipped without this once: sync wrote the files, recorded only the boundary, and `harness status` went
// on reporting a freshly promulgated repository as never promulgated to.
test("sync reports the version of each type it applied, and only for what reached the index", async () => {
  const repoRoot = await target();
  const sourceRoot = await source();

  const result = await sync({ repoRoot, sourceRoot, dryRun: false });
  assert.deepEqual(result.applied, { adr: 3, plan: 3 }, "the two types this norm ships, at their declared versions");

  const dry = await sync({ repoRoot: await target(), sourceRoot, dryRun: true });
  assert.deepEqual(dry.applied, {}, "a dry run promulgated nothing and must not claim otherwise");
});

// THE ONE THIS VERB EXISTS TO GET RIGHT. A linked working tree shares the repository's internal
// directory, so `.git/info/exclude` applies inside it. `git add` on an ignored path succeeds, stages
// nothing, and says so only as a hint — so trusting the exit code produces a branch that looks complete
// and silently is not.
test("a written path the clone's ignore list swallows is reported, with the rule that caught it", async () => {
  const repoRoot = await target();
  const sourceRoot = await source();
  await writeFile(path.join(repoRoot, ".git", "info", "exclude"), "project/templates/\n");

  const result = await sync({ repoRoot, sourceRoot, dryRun: false });

  assert.equal(result.swallowed.length, 2, "both templates were written and neither reached the index");
  assert.deepEqual(result.swallowed.map((one) => one.path).sort(), [
    "project/templates/adr.md",
    "project/templates/plan.md",
  ]);
  for (const one of result.swallowed) {
    assert.match(one.rule, /exclude/, "the rule must name the FILE that caught it, not merely say 'ignored'");
    assert.match(one.rule, /project\/templates/, "and the pattern");
  }
  assert.equal(result.tag, undefined, "nothing is tagged when the branch is incomplete");
});

test("a path the declaration does not classify stops the run — absence is not permission", async () => {
  const repoRoot = await target();
  const sourceRoot = await source();
  // A declaration that classifies nothing at all: every path promulgation would write is unnamed.
  await writeFile(
    path.join(sourceRoot, "ownership.json"),
    JSON.stringify({ version: 1, classes: {}, paths: [{ match: "nothing/at/all", class: "norm", why: "" }] }),
  );

  await assert.rejects(() => sync({ repoRoot, sourceRoot, dryRun: false }), /Absence of an entry is not permission/);
});

test("a dry run reports what it would do and creates neither a branch nor a tag", async () => {
  const repoRoot = await target();
  const sourceRoot = await source();

  const result = await sync({ repoRoot, sourceRoot, dryRun: true });

  assert.equal(result.branch, undefined);
  assert.deepEqual([...result.written].sort(), ["project/templates/adr.md", "project/templates/plan.md"]);
  assert.equal(git(repoRoot, ["branch", "--list", "vibe-ops/norm-1"]), "", "no branch was created");
});

// ── The boundary ────────────────────────────────────────────────────────────────────────────────────
// Only a WIDENING needs consent. The asymmetry is the design: narrowing can only reduce what this tooling
// may do, and refusing those too would block a repository on a change that made it safer.

test("widens: only a move that gives this tooling more authority needs consent", () => {
  assert.equal(widens("seed", "norm"), true, "a file the repository owned becomes one promulgation overwrites");
  assert.equal(widens("repo", "seed"), true, "a file never to be touched becomes one that may be written");
  assert.equal(widens("norm", "seed"), false);
  assert.equal(widens("norm", "repo"), false);
  assert.equal(widens("seed", "seed"), false);
  assert.equal(widens(undefined, "norm"), false, "gaining an entry where there was none takes nothing away");
});

test("classOf: the last matching entry wins, so a narrow exception can carve out of a broad claim", () => {
  const ownership: Ownership = {
    version: 1,
    paths: [
      { match: ".githooks/*", class: "norm", why: "wiring" },
      { match: ".githooks/post-commit", class: "repo", why: "the declared exception" },
    ],
  };
  assert.equal(classOf(ownership, ".githooks/pre-commit"), "norm");
  assert.equal(classOf(ownership, ".githooks/post-commit"), "repo");
  assert.equal(classOf(ownership, "src/index.ts"), undefined, "no match is undefined, never a default");
});

test("boundaryRefusals names only the paths that widened, never the whole run", () => {
  const agreed: Ownership = {
    version: 1,
    paths: [
      { match: "a.md", class: "seed", why: "" },
      { match: "b.md", class: "norm", why: "" },
    ],
  };
  const installed: Ownership = {
    version: 2,
    paths: [
      { match: "a.md", class: "norm", why: "it now declares a version" },
      { match: "b.md", class: "norm", why: "" },
    ],
  };

  const refused = boundaryRefusals(installed, agreed, ["a.md", "b.md"]);
  assert.deepEqual(
    refused.map((one) => one.path),
    ["a.md"],
    "b.md did not change class, so a version bump alone must not block it",
  );
  assert.equal(refused[0]!.was, "seed");
  assert.equal(refused[0]!.now, "norm");
  assert.match(refused[0]!.why, /declares a version/, "the refusal carries the declaration's own justification");
});

test("a clone that agreed to an older boundary is refused until it accepts the installed one", async () => {
  const repoRoot = await target();
  const sourceRoot = await source(2);

  const refusedRun = await sync({ repoRoot, sourceRoot, agreedBoundary: 1, dryRun: false });
  assert.ok(refusedRun.refused.length > 0, "an unaccepted boundary change is not promulgated over");
  assert.equal(refusedRun.branch, undefined);
  assert.match(refusedRun.refused[0]!.why, /agreed to ownership@1/);

  const accepted = await sync({ repoRoot, sourceRoot, agreedBoundary: 1, acceptBoundary: 2, dryRun: false });
  assert.equal(accepted.refused.length, 0, "consent given on this run clears it");
  assert.equal(accepted.branch, "vibe-ops/norm-2");
});

test("a clone already on the installed boundary promulgates without asking again", async () => {
  const repoRoot = await target();
  const sourceRoot = await source(2);

  const result = await sync({ repoRoot, sourceRoot, agreedBoundary: 2, dryRun: false });
  assert.equal(result.refused.length, 0);
  assert.equal(result.branch, "vibe-ops/norm-2");
  assert.ok(existsSync(path.join(repoRoot, ".git")), "the target is intact");
});
