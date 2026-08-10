import { test } from "node:test";
import assert from "node:assert/strict";
import { specifierFor, BUILTIN_PREFIX } from "../src/resolve.ts";

test("a bare name resolves to a built-in package", () => {
  assert.equal(specifierFor("check"), `${BUILTIN_PREFIX}check`);
});

test("a scoped package name is taken verbatim, so a third party is invoked as itself", () => {
  assert.equal(specifierFor("@someone/vibe-ops-thing"), "@someone/vibe-ops-thing");
});

test("a path is taken verbatim, so a module under development runs without publishing", () => {
  assert.equal(specifierFor("./local/mod.ts"), "./local/mod.ts");
  assert.equal(specifierFor("/abs/mod.js"), "/abs/mod.js");
});

test("loading something that is not a module reports what was expected", async () => {
  const { loadModule } = await import("../src/resolve.ts");
  await assert.rejects(() => loadModule("definitely-not-installed-xyz"), /cannot load/);
});
