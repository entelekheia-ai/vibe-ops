import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrationsDirFor, resolveNormFacet } from "../src/norm-facet.ts";

// The precedence ADR-0019 fixes: the repository's own copy first, then the activated governance
// package, then a pinned tree in both its layouts. These tests run inside the workspace, so the
// activated package for the DEFAULT bindings is the real @entelekheia/governance-<t> — which is the
// point: activation is an import, and the workspace is an installed consumer like any other.

async function scratch(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

test("a repository's own type unit outranks the activated package", async () => {
  const repo = await scratch("norm-repo-");
  await mkdir(path.join(repo, "types", "adr"), { recursive: true });
  await mkdir(path.join(repo, "own"), { recursive: true });
  await writeFile(path.join(repo, "own", "adr.md"), "# mine\n");
  await writeFile(
    path.join(repo, "types", "adr", "type.json"),
    JSON.stringify({
      type: "adr",
      template: "../../own/adr.md",
      authoring: "../../own/adr-rules.md",
      migrations: "../../own/migrations",
      schema: { carrier: "table", required: ["Status"] },
    }),
  );
  const answer = await resolveNormFacet("adr", "template", repo, undefined, undefined);
  assert.equal(answer?.source, "repo");
  assert.equal(answer?.path, path.join(repo, "own", "adr.md"));
});

test("with no repository copy, the activated governance package answers", async () => {
  const repo = await scratch("norm-empty-");
  const answer = await resolveNormFacet("adr", "template", repo, undefined, undefined);
  assert.equal(answer?.source, "package");
  assert.ok(answer.exists, answer.path);
  assert.ok(answer.path.endsWith(path.join("templates", "adr.md")), answer.path);
});

test("a type bound to a package that is not installed falls through to the pinned tree's flat layout", async () => {
  const repo = await scratch("norm-bound-");
  const pinned = await scratch("norm-pin-");
  await mkdir(path.join(pinned, "templates"), { recursive: true });
  await writeFile(path.join(pinned, "templates", "policy.md"), "# pinned policy\n");
  const config = { types: { policy: "@x/not-installed" } };
  const answer = await resolveNormFacet("policy", "template", repo, config, pinned);
  assert.equal(answer?.source, "pinned");
  assert.ok(answer.exists);
});

test("migrationsDirFor answers only with a directory that exists", async () => {
  const repo = await scratch("norm-mig-");
  const dir = await migrationsDirFor("plan", repo, undefined, undefined);
  assert.ok(dir !== undefined && dir.endsWith(path.join("governance-plan", "migrations")), String(dir));
  const none = await migrationsDirFor("nonexistent-type", repo, undefined, undefined);
  assert.equal(none, undefined);
});
