import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfig, MANAGED_FILENAME, searchPath, settingsFor, writeManagedConfig } from "../src/config.ts";
import type { ManagedConfigPatch } from "../src/config.ts";

/** A `.git` DIRECTORY at `dir` — the ordinary-checkout form of the toplevel marker RFC-0004 §2 reads. */
async function gitDir(dir: string): Promise<void> {
  await mkdir(path.join(dir, ".git"));
}

/** A `.git` FILE at `dir` — the linked-worktree/submodule form; §2 requires both to count. */
async function gitFile(dir: string): Promise<void> {
  await writeFile(path.join(dir, ".git"), "gitdir: ../elsewhere/.git/worktrees/x\n");
}

test("searchPath walks from the start directory up to the root and includes home", () => {
  const dirs = searchPath("/a/b/c", "/home/someone");
  assert.equal(dirs[0], "/a/b/c");
  assert.ok(dirs.includes("/a"));
  assert.ok(dirs.includes("/"));
  assert.ok(dirs.includes("/home/someone"), "the home directory must be reachable even when off the path");
});

test("home is not duplicated when it already lies on the upward path", () => {
  const dirs = searchPath("/home/someone/repo", "/home/someone");
  assert.equal(dirs.filter((d) => d === "/home/someone").length, 1);
});

test("the nearer file wins per key, and settings merge one level deep", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-home-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });

  await writeFile(
    path.join(home, "vibeops.config.mjs"),
    `export default { artifactDir: "home-dir", modules: ["a"], settings: { check: { from: "home" }, other: { keep: true } } };`,
  );
  await writeFile(
    path.join(repo, "vibeops.config.mjs"),
    `export default { artifactDir: "repo-dir", settings: { check: { from: "repo" } } };`,
  );

  const { config, sources } = await loadConfig(repo, home);

  assert.equal(config.artifactDir, "repo-dir", "the nearer file wins");
  assert.deepEqual(config.modules, ["a"], "a key the nearer file omits falls through to the further one");
  assert.deepEqual(settingsFor(config, "check"), { from: "repo" });
  assert.deepEqual(settingsFor(config, "other"), { keep: true }, "another module's settings survive the override");
  assert.equal(sources.length, 2);
});

test("records merges one level deep per sub-key, same as settings", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-home-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });

  await writeFile(
    path.join(home, "vibeops.config.mjs"),
    `export default { records: { dirs: { adr: "home-adr" }, templates: { adr: "home-adr.md" } } };`,
  );
  await writeFile(
    path.join(repo, "vibeops.config.mjs"),
    `export default { records: { dirs: { plan: "repo-plan" } } };`,
  );

  const { config } = await loadConfig(repo, home);
  assert.deepEqual(config.records, {
    dirs: { adr: "home-adr", plan: "repo-plan" },
    templates: { adr: "home-adr.md" },
  });
});

test("records is undefined when neither file declares it — no empty object appears from nowhere", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-norecords-"));
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { artifactDir: "x" };`);
  const { config } = await loadConfig(dir, dir);
  assert.equal(config.records, undefined);
});

test("a config file without a default export is rejected rather than silently ignored", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-bad-"));
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export const config = {};`);
  await assert.rejects(() => loadConfig(dir, dir), /no default export/);
});

test("no config anywhere is not an error", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-empty-"));
  const { config, sources } = await loadConfig(dir, dir);
  assert.deepEqual(sources, []);
  assert.equal(config.artifactDir, undefined);
});

test("the local file layers over the committed one in the same directory rather than replacing it", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-local-"));
  await writeFile(
    path.join(dir, "vibeops.config.mjs"),
    `export default { artifactDir: "committed", modules: ["a", "b"], settings: { check: { from: "committed" }, other: { keep: true } } };`,
  );
  await writeFile(
    path.join(dir, "vibeops.config.local.mjs"),
    `export default { artifactDir: "local", settings: { check: { from: "local" } } };`,
  );

  const { config, sources } = await loadConfig(dir, dir);

  assert.equal(config.artifactDir, "local", "the local file wins per key");
  assert.deepEqual(config.modules, ["a", "b"], "a key the local file omits falls through to the committed one");
  assert.deepEqual(settingsFor(config, "check"), { from: "local" });
  assert.deepEqual(settingsFor(config, "other"), { keep: true }, "another module's settings survive");
  assert.equal(sources.length, 2, "both files contributed, so both are reported");
  assert.ok(sources[0]!.endsWith("vibeops.config.local.mjs"), "sources is nearest-first, local before committed");
});

test("a nearer committed file beats a farther local one — the directory walk outranks the pair", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-home-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });

  await writeFile(path.join(home, "vibeops.config.local.mjs"), `export default { artifactDir: "home-local" };`);
  await writeFile(path.join(repo, "vibeops.config.mjs"), `export default { artifactDir: "repo-committed" };`);

  const { config } = await loadConfig(repo, home);

  assert.equal(
    config.artifactDir,
    "repo-committed",
    "a stale personal file in home must not govern a repository that declared its own",
  );
});

test("the committed file still loads alone when no local file exists", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-nolocal-"));
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { artifactDir: "committed" };`);
  const { config, sources } = await loadConfig(dir, dir);
  assert.equal(config.artifactDir, "committed");
  assert.equal(sources.length, 1);
});

test("harness is undefined when nothing declares it, and absence is not zero", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-noharness-"));
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { artifactDir: "x" };`);
  const { config } = await loadConfig(dir, dir);
  assert.equal(config.harness, undefined);
});

// --- RFC-0004: the managed layer ---------------------------------------------------------------------

test("a directory holding both vibeops.config.ts and vibeops.config.json loads both, managed ranking last", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-managed-"));
  await gitDir(dir);
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { artifactDir: "declared" };`);
  await writeFile(path.join(dir, MANAGED_FILENAME), JSON.stringify({ artifactDir: "managed" }));

  const { config, sources, layers, leave } = await loadConfig(dir, dir);

  assert.equal(config.artifactDir, "declared", "within a directory, declared beats managed");
  assert.equal(sources.length, 2);
  assert.deepEqual(
    layers.map((l) => l.layer),
    ["declared", "managed"],
    "managed is the third half of loadOne, ranking after declared, never a fourth name ahead of it",
  );
  assert.deepEqual(leave, []);
});

test("a nearer managed beats a farther declared, home included", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-managed-home-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });
  await gitDir(repo);

  await writeFile(path.join(home, "vibeops.config.mjs"), `export default { artifactDir: "home-declared" };`);
  await writeFile(path.join(repo, MANAGED_FILENAME), JSON.stringify({ artifactDir: "repo-managed" }));

  const { config } = await loadConfig(repo, home);

  assert.equal(
    config.artifactDir,
    "repo-managed",
    "the directory walk outranks the layer — a nearer managed file must not lose to a farther declared one",
  );
});

test("a vibeops.config.json off the repository toplevel appears in leave, unread — $HOME included", async () => {
  const home = await mkdtemp(path.join(tmpdir(), "vibeops-managed-leave-"));
  const repo = path.join(home, "nested", "repo");
  await mkdir(repo, { recursive: true });
  await gitDir(repo);

  await writeFile(path.join(home, MANAGED_FILENAME), JSON.stringify({ artifactDir: "home-managed" }));
  await writeFile(path.join(path.dirname(repo), MANAGED_FILENAME), JSON.stringify({ artifactDir: "nested-managed" }));

  const { config, leave, sources } = await loadConfig(repo, home);

  assert.equal(config.artifactDir, undefined, "neither off-toplevel managed file may contribute a value");
  assert.equal(sources.length, 0);
  assert.equal(leave.length, 2, "both the ancestor and the home copies are reported");
  for (const entry of leave) {
    assert.ok(entry.reason.length > 0);
  }
  assert.ok(leave.some((l) => l.file === path.join(home, MANAGED_FILENAME)));
  assert.ok(leave.some((l) => l.file === path.join(path.dirname(repo), MANAGED_FILENAME)));
});

test("a walk with no .git ancestor reads no managed layer", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-managed-norepo-"));
  await writeFile(path.join(dir, MANAGED_FILENAME), JSON.stringify({ artifactDir: "managed" }));

  const { config, leave } = await loadConfig(dir, dir);

  assert.equal(config.artifactDir, undefined);
  assert.equal(leave.length, 1, "the managed file is still reported, just never read");
  assert.equal(leave[0]?.file, path.join(dir, MANAGED_FILENAME));
});

test("a .git FILE counts as the toplevel, same as a .git directory", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-managed-gitfile-"));
  await gitFile(dir);
  await writeFile(path.join(dir, MANAGED_FILENAME), JSON.stringify({ artifactDir: "managed" }));

  const { config, leave } = await loadConfig(dir, dir);

  assert.equal(config.artifactDir, "managed", "a linked worktree's .git file must qualify, not only a directory");
  assert.deepEqual(leave, []);
});

test.todo(
  "vibeops.config.local.json appears in leave, unread — RFC-0004 §1 assertion, not implemented in Plan-032 " +
    "Track 2: the legacy state file is deliberately still read (as a lowest-precedence harness.applied/" +
    "harness.boundary fallback) rather than left. Track 4 retires the read and this becomes a real test.",
);

test("harness.applied and harness.boundary come from managed alone; a declared copy is ignored", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-managed-harness-"));
  await gitDir(dir);
  await writeFile(
    path.join(dir, "vibeops.config.mjs"),
    `export default { harness: { applied: { plan: 1, task: 1 }, boundary: 1 } };`,
  );
  await writeFile(
    path.join(dir, MANAGED_FILENAME),
    JSON.stringify({ harness: { applied: { plan: 5 }, boundary: 5 } }),
  );

  const { config } = await loadConfig(dir, dir);

  assert.deepEqual(config.harness?.applied, { plan: 5 }, "the declared copy's applied map must not be consulted");
  assert.equal(config.harness?.boundary, 5, "the declared copy's boundary must not be consulted");
});

test("harness.applied is undefined when only a declared file sets it, and no managed layer exists", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-declared-only-harness-"));
  await gitDir(dir);
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { harness: { applied: { plan: 1 } } };`);

  const { config } = await loadConfig(dir, dir);

  assert.equal(config.harness, undefined, "a declared harness.applied is not a source — managed is the only one");
});

test(
  "Legacy state read (Plan-032 Track 4 removes this): vibeops.config.local.json is the lowest-precedence " +
    "fallback for harness.applied/harness.boundary when no managed layer supplies them",
  async () => {
    const home = await mkdtemp(path.join(tmpdir(), "vibeops-legacy-state-"));
    const repo = path.join(home, "nested", "repo");
    await mkdir(repo, { recursive: true });
    await gitDir(repo);

    await writeFile(
      path.join(home, "vibeops.config.local.json"),
      JSON.stringify({ harness: { applied: { plan: 1, task: 1, adr: 1 }, boundary: 1 } }),
    );
    await writeFile(
      path.join(repo, "vibeops.config.local.json"),
      JSON.stringify({ harness: { applied: { plan: 3 } } }),
    );

    const { config, leave } = await loadConfig(repo, home);

    assert.deepEqual(config.harness?.applied, { plan: 3 }, "only the toplevel's legacy file is read");
    assert.equal(config.harness?.boundary, undefined, "the home-directory copy is never consulted, so it cannot fill in boundary");
    assert.deepEqual(
      leave.map((one) => one.file),
      [path.join(repo, "vibeops.config.local.json")],
      "the legacy file in force is named in leave; the home copy, never read, is not",
    );
  },
);

test("a managed layer's harness.applied wins over the legacy state file even when the state file is nearer", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-legacy-vs-managed-"));
  await gitDir(dir);
  await writeFile(path.join(dir, "vibeops.config.local.json"), JSON.stringify({ harness: { applied: { plan: 9 } } }));
  await writeFile(path.join(dir, MANAGED_FILENAME), JSON.stringify({ harness: { applied: { plan: 1 } } }));

  const { config } = await loadConfig(dir, dir);

  assert.deepEqual(config.harness?.applied, { plan: 1 }, "managed outranks the legacy fallback regardless of nearness");
});

test("types merges per local name across all three layers in one directory", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-types-three-layers-"));
  await gitDir(dir);
  await writeFile(path.join(dir, "vibeops.config.local.mjs"), `export default { types: { a: "pkg-local" } };`);
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { types: { b: "pkg-declared" } };`);
  await writeFile(path.join(dir, MANAGED_FILENAME), JSON.stringify({ types: { c: "pkg-managed" } }));

  const { config } = await loadConfig(dir, dir);

  assert.deepEqual(config.types, { a: "pkg-local", b: "pkg-declared", c: "pkg-managed" });
});

test("types: a name bound in two layers is won by the nearer one, per-name not whole-key", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-types-collision-"));
  await gitDir(dir);
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { types: { x: "declared-pkg", y: "declared-only" } };`);
  await writeFile(path.join(dir, MANAGED_FILENAME), JSON.stringify({ types: { x: "managed-pkg", z: "managed-only" } }));

  const { config } = await loadConfig(dir, dir);

  assert.deepEqual(config.types, { x: "declared-pkg", y: "declared-only", z: "managed-only" });
});

test("ownership concatenates across layers, nearer landing last, each entry carrying its <layer>:<file> origin", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-ownership-origin-"));
  await gitDir(dir);
  const localFile = path.join(dir, "vibeops.config.local.mjs");
  const declaredFile = path.join(dir, "vibeops.config.mjs");
  const managedFile = path.join(dir, MANAGED_FILENAME);

  await writeFile(localFile, `export default { ownership: [{ match: "L", class: "repo", reason: "local" }] };`);
  await writeFile(declaredFile, `export default { ownership: [{ match: "D", class: "repo", reason: "declared" }] };`);
  await writeFile(managedFile, JSON.stringify({ ownership: [{ match: "M", class: "repo", reason: "managed" }] }));

  const { config } = await loadConfig(dir, dir);

  assert.deepEqual(
    config.ownership?.map((e) => e.match),
    ["M", "D", "L"],
    "managed is farthest so it lands first; declared, being nearer than managed, lands after it — the concatenation's last entry wins",
  );
  assert.equal(config.ownership?.find((e) => e.match === "L")?.origin, `local:${localFile}`);
  assert.equal(config.ownership?.find((e) => e.match === "D")?.origin, `declared:${declaredFile}`);
  assert.equal(config.ownership?.find((e) => e.match === "M")?.origin, `managed:${managedFile}`);
});

// --- writeManagedConfig --------------------------------------------------------------------------------

async function repoWithManaged(prefix: string, existing?: unknown): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  await gitDir(dir);
  if (existing !== undefined) await writeFile(path.join(dir, MANAGED_FILENAME), JSON.stringify(existing));
  return dir;
}

test("writeManagedConfig creates the managed file and writes two-space JSON", async () => {
  const dir = await repoWithManaged("vibeops-write-create-");

  const result = await writeManagedConfig(dir, { types: { plan: "@acme/governance-plan" } });

  assert.equal(result.ok, true);
  const text = await readFile(path.join(dir, MANAGED_FILENAME), "utf8");
  assert.equal(text, `${JSON.stringify({ types: { plan: "@acme/governance-plan" } }, undefined, 2)}\n`);
});

test("writeManagedConfig refuses an unparseable managed file (R2), naming it", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-write-badjson-"));
  await gitDir(dir);
  await writeFile(path.join(dir, MANAGED_FILENAME), "{ not json");

  const result = await writeManagedConfig(dir, { types: { plan: "@acme/governance-plan" } });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.refusal, "R2");
  assert.match(result.message, new RegExp(MANAGED_FILENAME.replace(".", "\\.")));
});

test("writeManagedConfig preserves keys the patch does not touch", async () => {
  const dir = await repoWithManaged("vibeops-write-foreign-", {
    types: { existing: "@acme/existing" },
    ownership: [{ match: "keep-me", class: "repo", reason: "already there" }],
    settings: { governance: { level: { "*": "fail" } } },
    "x-team": { owner: "platform" },
  });

  const result = await writeManagedConfig(dir, { types: { plan: "@acme/governance-plan" } });
  assert.equal(result.ok, true);

  const written = JSON.parse(await readFile(path.join(dir, MANAGED_FILENAME), "utf8"));
  assert.deepEqual(written.types, { existing: "@acme/existing", plan: "@acme/governance-plan" });
  assert.deepEqual(written.ownership, [{ match: "keep-me", class: "repo", reason: "already there" }]);
  assert.deepEqual(written.settings, { governance: { level: { "*": "fail" } } }, "a foreign key outside the writable set survives byte-for-byte");
  assert.deepEqual(written["x-team"], { owner: "platform" }, "an unknown top-level key is the repository's and is preserved");
});

test("writeManagedConfig options.remove deletes named key paths", async () => {
  const dir = await repoWithManaged("vibeops-write-remove-", {
    types: { plan: "@acme/governance-plan", task: "@acme/governance-task" },
    harness: { applied: { plan: 3 }, boundary: 2 },
  });

  const result = await writeManagedConfig(dir, {}, { remove: ["types.plan", "harness.applied"] });
  assert.equal(result.ok, true);

  const written = JSON.parse(await readFile(path.join(dir, MANAGED_FILENAME), "utf8"));
  assert.deepEqual(written.types, { task: "@acme/governance-task" });
  assert.equal(written.harness.applied, undefined);
  assert.equal(written.harness.boundary, 2, "a sibling key untouched by remove survives");
});

test("R1 fires per types.<name> when the toplevel's own declared layer already holds it", async () => {
  const dir = await repoWithManaged("vibeops-r1-types-");
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { types: { plan: "@acme/governance-plan" } };`);

  const result = await writeManagedConfig(dir, { types: { plan: "@other/governance-plan" } });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.refusal, "R1");
  assert.match(result.message, /vibeops\.config\.mjs/);
});

test("R1 fires on an identical ownership match declared at the toplevel", async () => {
  const dir = await repoWithManaged("vibeops-r1-ownership-");
  await writeFile(
    path.join(dir, "vibeops.config.mjs"),
    `export default { ownership: [{ match: "project/secrets/**", class: "repo", reason: "hand-written" }] };`,
  );

  const result = await writeManagedConfig(dir, {
    ownership: [{ match: "project/secrets/**", class: "seed", reason: "tool-written" }],
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.refusal, "R1");
});

test("R1 fires on harness.applied declared at the toplevel, whole-key", async () => {
  const dir = await repoWithManaged("vibeops-r1-harness-");
  await writeFile(path.join(dir, "vibeops.config.mjs"), `export default { harness: { applied: { plan: 1 } } };`);

  const result = await writeManagedConfig(dir, { harness: { applied: { plan: 2 } } });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.refusal, "R1");
});

test("R1 never consults the local layer — one clone must not block a repository-wide write", async () => {
  const dir = await repoWithManaged("vibeops-r1-not-local-");
  await writeFile(path.join(dir, "vibeops.config.local.mjs"), `export default { types: { plan: "@acme/governance-plan" } };`);

  const result = await writeManagedConfig(dir, { types: { plan: "@other/governance-plan" } });

  assert.equal(result.ok, true, "a local copy of the same key must not refuse the write");
});

test("a successful write reports the toplevel's own local copy as shadowing it", async () => {
  const dir = await repoWithManaged("vibeops-shadowed-by-local-");
  await writeFile(path.join(dir, "vibeops.config.local.mjs"), `export default { types: { plan: "@acme/local-plan" } };`);

  const result = await writeManagedConfig(dir, { types: { plan: "@acme/governance-plan" } });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(result.shadowedBy.length, 1);
  assert.equal(result.shadowedBy[0]?.layer, "local");
  assert.ok(result.shadowedBy[0]?.file.endsWith("vibeops.config.local.mjs"));
});

test("R3 refuses a write outside any repository, naming the directory", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-r3-"));

  const result = await writeManagedConfig(dir, { types: { plan: "@acme/governance-plan" } });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.refusal, "R3");
  assert.match(result.message, /\.git/);
});

test("R4 refuses a key outside the closed writable set", async () => {
  const dir = await repoWithManaged("vibeops-r4-");

  const result = await writeManagedConfig(
    dir,
    { harness: { applied: { plan: 1 }, source: "/some/path" } } as unknown as ManagedConfigPatch,
  );

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.refusal, "R4");
  assert.match(result.message, /harness\.source/);
});

test("R4 refuses a top-level key that is not writable at all", async () => {
  const dir = await repoWithManaged("vibeops-r4-toplevel-");

  const result = await writeManagedConfig(dir, { artifactDir: "x" } as unknown as ManagedConfigPatch);

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.refusal, "R4");
});

test("R5 refuses rebinding a types name already bound to a different package in managed, naming both", async () => {
  const dir = await repoWithManaged("vibeops-r5-", { types: { plan: "@acme/governance-plan" } });

  const result = await writeManagedConfig(dir, { types: { plan: "@other/governance-plan" } });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.refusal, "R5");
  assert.match(result.message, /@acme\/governance-plan/);
  assert.match(result.message, /@other\/governance-plan/);
});

test("R5 does not fire when the managed write repeats the same binding", async () => {
  const dir = await repoWithManaged("vibeops-r5-same-", { types: { plan: "@acme/governance-plan" } });

  const result = await writeManagedConfig(dir, { types: { plan: "@acme/governance-plan" } });

  assert.equal(result.ok, true);
});
