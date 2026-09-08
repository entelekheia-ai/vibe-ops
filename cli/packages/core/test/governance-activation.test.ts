// A package may ship several units, and each binds independently — Plan-040 Track 2, the mechanism the
// ADR succeeding ADR-0019 records. The "package" here is the smallest activation object core accepts,
// bound by an absolute path the way `parseBinding` already passes one to `import()` verbatim, which is
// the same technique `ops-governance`'s derivation test uses for a fabricated sixth governance.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { activateGovernance } from "../src/governance-map.ts";
import type { VibeOpsConfig } from "../src/config.ts";

/** A package whose default export carries `units` rather than one `unit`. The file name is unique per
 *  call because an ES module import is cached by specifier for the life of the process. */
async function twoUnitPackage(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-two-units-"));
  const file = path.join(dir, "index.mjs");
  await writeFile(
    file,
    `export default { root: ${JSON.stringify(dir)}, units: [\n` +
      `  { type: "log", template: "./templates/log.md", authoring: "./authoring.md", migrations: "./migrations" },\n` +
      `  { type: "learning", template: "./templates/learning.md", authoring: "./authoring.md", migrations: "./migrations" },\n` +
      `] };\n`,
  );
  return file;
}

test("each unit of a multi-unit package activates under its own binding", async () => {
  const pkg = await twoUnitPackage();
  const config = { types: { log: pkg, learning: `${pkg}#learning` } } as VibeOpsConfig;

  const log = await activateGovernance("log", config);
  const learning = await activateGovernance("learning", config);

  assert.equal(log?.unit.type, "log");
  assert.equal(learning?.unit.type, "learning");
  // The caller sees one unit, never the array: a multi-unit package is a fact about the manifest, not a
  // second shape every reader downstream has to learn.
  assert.equal(log?.unit.template, "./templates/log.md");
  assert.equal(learning?.unit.template, "./templates/learning.md");
});

// THE CACHE IS KEYED BY `<package>#<type>`. Keyed by package name alone — which it was until this
// track — the second binding would be handed whatever the first one resolved to, so `learning` would
// activate as `log` under a different name and every facet it served would be the wrong file.
test("a second binding to the same package is not served the first binding's unit", async () => {
  const pkg = await twoUnitPackage();
  const first = await activateGovernance("learning", { types: { learning: `${pkg}#learning` } } as VibeOpsConfig);
  const second = await activateGovernance("log", { types: { log: pkg } } as VibeOpsConfig);
  assert.equal(first?.unit.type, "learning");
  assert.equal(second?.unit.type, "log");
});

test("a binding naming a type the package does not ship activates nothing", async () => {
  const pkg = await twoUnitPackage();
  const activated = await activateGovernance("recipe", { types: { recipe: `${pkg}#recipe` } } as VibeOpsConfig);
  assert.equal(activated, undefined);
});

test("a single-unit package still activates, and only under its own type", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "vibeops-one-unit-"));
  const file = path.join(dir, "index.mjs");
  await writeFile(file, `export default { root: ${JSON.stringify(dir)}, unit: { type: "note", template: "./t.md" } };\n`);

  assert.equal((await activateGovernance("note", { types: { note: file } } as VibeOpsConfig))?.unit.type, "note");
  assert.equal(await activateGovernance("other", { types: { other: `${file}#other` } } as VibeOpsConfig), undefined);
});
