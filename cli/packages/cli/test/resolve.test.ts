import { test } from "node:test";
import assert from "node:assert/strict";
import { specifierFor, BUILTIN_PREFIX, OPS_PREFIX } from "../src/resolve.ts";

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

test("a bare name that is not a module-<name> falls back to an ops built-in", async () => {
  const { loadModule } = await import("../src/resolve.ts");
  const plugin = await loadModule("agents-md");
  assert.equal(plugin.definition.id, "agents-md");
});

test("a failed bare-name lookup names both prefixes it tried", async () => {
  const { loadModule } = await import("../src/resolve.ts");
  await assert.rejects(
    () => loadModule("definitely-not-installed-xyz"),
    new RegExp(`${BUILTIN_PREFIX}definitely-not-installed-xyz.*${OPS_PREFIX}definitely-not-installed-xyz`),
  );
});
