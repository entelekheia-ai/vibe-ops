import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import setupModule from "../src/index.ts";
import type { ModuleContext, ModuleResult } from "@entelekheia/vibe-ops-core";

async function target(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "vibeops-scaffold-"));
}

function contextFor(repoRoot: string, command: string, args: readonly string[] = [], flags: Record<string, unknown> = {}) {
  const logs: string[] = [];
  const warnings: string[] = [];
  const context = {
    repoRoot,
    args,
    command,
    config: undefined,
    settings: {},
    surface: "cli",
    flags,
    log: (message: string) => logs.push(message),
    warn: (message: string) => warnings.push(message),
  } as unknown as ModuleContext;
  return { context, logs, warnings };
}

async function run(repoRoot: string, command: string, args: readonly string[] = [], flags: Record<string, unknown> = {}) {
  const { context, logs, warnings } = contextFor(repoRoot, command, args, flags);
  const result: ModuleResult = await setupModule.run(context);
  return { result, logs, warnings };
}

test("plan reports what would be written and where each file comes from, and writes nothing", async () => {
  const repo = await target();
  const { result } = await run(repo, "plan");
  const data = result.data as { files: readonly { to: string; origin: string }[]; directories: readonly string[] };

  assert.ok(data.files.length > 0);
  assert.ok(data.files.some((f) => f.to === "GOVERNANCE.md" && f.origin === "rendered"));
  assert.ok(data.files.some((f) => f.to === "project/templates/adr.md"));
  assert.ok(data.directories.includes("project/adr"));
  // The whole point of a dry run: nothing on disk.
  assert.equal(existsSync(path.join(repo, "GOVERNANCE.md")), false);
  assert.equal(existsSync(path.join(repo, "project")), false);
});

test("scaffold writes the composition, substituting the values it was given", async () => {
  const repo = await target();
  const { result } = await run(repo, "scaffold", ["REPO_NAME=probe", "ONE_LINE_DESCRIPTION=a probe"]);
  const data = result.data as { written: readonly string[] };

  assert.ok(data.written.includes("README.md"));
  assert.match(await readFile(path.join(repo, "README.md"), "utf8"), /^# probe/);
  assert.ok(existsSync(path.join(repo, "project", "adr", ".gitkeep")));
  assert.ok(existsSync(path.join(repo, ".agents", "rules", "governance.md")));
});

// A PLACEHOLDER NOBODY ANSWERED IS LEFT STANDING, never emptied. `{{PKG_NAME}}` in a written file is
// visible and greppable; an empty string where a name belongs is a file that looks finished and is not.
test("an unanswered placeholder survives into the file and is reported", async () => {
  const repo = await target();
  const { result, warnings } = await run(repo, "scaffold", ["REPO_NAME=probe"]);
  const data = result.data as { unanswered: readonly string[] };

  assert.ok(data.unanswered.includes("PKG_NAME"), data.unanswered.join(", "));
  assert.match(await readFile(path.join(repo, "README.md"), "utf8"), /\{\{PKG_NAME\}\}/);
  assert.ok(warnings.some((w) => w.includes("PKG_NAME")));
});

// THE FIRST WRITE INTO A REPOSITORY IS NOT A PROMULGATION. Anything already there was put there by
// someone, so it is kept and reported rather than overwritten — `harness sync` is the verb that owns the
// question of what may be overwritten, and it consults the ownership boundary to answer it.
test("a destination that already exists is kept, and named, unless it is forced", async () => {
  const repo = await target();
  await writeFile(path.join(repo, "README.md"), "# mine\n");

  const first = await run(repo, "scaffold", ["REPO_NAME=probe"]);
  assert.ok((first.result.data as { skipped: readonly string[] }).skipped.includes("README.md"));
  assert.equal(await readFile(path.join(repo, "README.md"), "utf8"), "# mine\n");

  const forced = await run(repo, "scaffold", ["REPO_NAME=probe"], { force: "README.md" });
  assert.ok((forced.result.data as { written: readonly string[] }).written.includes("README.md"));
  assert.match(await readFile(path.join(repo, "README.md"), "utf8"), /^# probe/);
});

// GOVERNANCE.md IS `shaped`: the rendered lifecycles are the tooling's, everything else is the
// repository's, permanently. This is the test that would fail if a re-scaffold ever replaced the file.
test("a second scaffold re-renders the lifecycles and keeps what the repository wrote around them", async () => {
  const repo = await target();
  await run(repo, "scaffold", ["REPO_NAME=probe"]);

  const file = path.join(repo, "GOVERNANCE.md");
  await writeFile(file, `${await readFile(file, "utf8")}\n## Our own section\n\nKeep this.\n`);

  await run(repo, "scaffold", [], { force: "GOVERNANCE.md" });
  const after = await readFile(file, "utf8");
  assert.match(after, /## Our own section/);
  assert.match(after, /Keep this\./);
  assert.match(after, /### Plan/);
});

test("a directory this repository's types need is created even when every file already exists", async () => {
  const repo = await target();
  await run(repo, "scaffold", ["REPO_NAME=probe"]);
  await mkdir(path.join(repo, "project", "adr"), { recursive: true });
  const { result } = await run(repo, "scaffold", []);
  assert.ok((result.data as { directories: readonly string[] }).directories.includes("project/adr"));
});

// THE SHAPE DECIDES BETWEEN TWO FILES AT ONE DESTINATION. A single-package repository and a workspace
// need different `package.json` content, so the choice cannot be read off the destination — which is why
// RFC-0005 §4 gives the verb a shape at all. Without one, neither is written: a scaffold that guessed
// would produce a manifest for a repository shape nobody chose.
test("a shape-bound file is written only for its shape, and not at all without one", async () => {
  const asPackage = await target();
  await run(asPackage, "scaffold", ["REPO_NAME=p"], { shape: "package" });
  assert.match(await readFile(path.join(asPackage, "package.json"), "utf8"), /"name"/);

  const asWorkspace = await target();
  await run(asWorkspace, "scaffold", ["REPO_NAME=w"], { shape: "workspace" });
  assert.match(await readFile(path.join(asWorkspace, "package.json"), "utf8"), /workspaces/);

  const shapeless = await target();
  const { result } = await run(shapeless, "scaffold", ["REPO_NAME=n"]);
  assert.equal((result.data as { written: readonly string[] }).written.includes("package.json"), false);
  assert.equal(existsSync(path.join(shapeless, "package.json")), false);
});
