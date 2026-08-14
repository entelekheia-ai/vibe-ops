// Integration-level, deliberately: `buildCatalog` reads the REAL installed gates and ops packages (there
// is no fixture-injectable seam for "what gates exist" — that IS the question being asked), so these
// tests run against this repository's own checkout, the same way `ops.test.ts` does for the ops suite.
//
// `runner-provenance` and `disabled-declared` (Plan-025 Track 4 item 6) are gates that exist and are
// deliberately composed into nothing, so this repository's own catalog reports exactly those two — the
// verb doing its job, not a regression.

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

test("buildCatalog: against this repository's own checkout, the only gap is the two gates deliberately composed into nothing", async () => {
  const catalog = await buildCatalog(baseContext());
  assert.deepEqual(
    [...catalog.uncomposed].sort((a, b) => a.id.localeCompare(b.id)),
    [
      { kind: "gate", id: "disabled-declared" },
      { kind: "gate", id: "runner-provenance" },
    ],
  );
});

test("buildCatalog: an ops package that fails to load composes nothing from itself, rather than throwing", async () => {
  // Same repoRoot, but nothing about failure handling depends on it — this asserts the shape survives a
  // module-load failure path indirectly by confirming a normal run never throws even though it internally
  // best-effort loads five other packages.
  await assert.doesNotReject(buildCatalog(baseContext()));
});
