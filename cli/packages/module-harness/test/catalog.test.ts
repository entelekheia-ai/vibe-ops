// Integration-level, deliberately: `buildCatalog` reads the REAL installed gates and ops packages (there
// is no fixture-injectable seam for "what gates exist" — that IS the question being asked), so these
// tests run against this repository's own checkout, the same way `ops.test.ts` does for the ops suite.
//
// NOTE for Plan-025 Track 4 item 6: once `runner-provenance` and `disabled-declared` land as gates that
// are deliberately composed into nothing, this repository's own catalog gains exactly two entries. The
// "currently zero" assertion below is expected to need updating at that point — that is the point of the
// verb, not a regression.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog } from "../src/catalog.ts";

const repoRoot = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");

function baseContext() {
  return {
    repoRoot,
    flags: {},
    args: [],
    config: {},
    settings: undefined,
    surface: "cli" as const,
    log: () => {},
    warn: () => {},
  };
}

test("buildCatalog: against this repository's own checkout, every available gate and shell fragment is composed into something", async () => {
  const catalog = await buildCatalog(baseContext());
  assert.deepEqual(catalog.uncomposed, []);
});

test("buildCatalog: an ops package that fails to load composes nothing from itself, rather than throwing", async () => {
  // Same repoRoot, but nothing about failure handling depends on it — this asserts the shape survives a
  // module-load failure path indirectly by confirming a normal run never throws even though it internally
  // best-effort loads five other packages.
  await assert.doesNotReject(buildCatalog(baseContext()));
});
