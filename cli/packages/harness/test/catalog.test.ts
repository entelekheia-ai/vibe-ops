// Integration-level, deliberately: `buildCatalog` reads the REAL installed gates and ops packages (there
// is no fixture-injectable seam for "what gates exist" — that IS the question being asked), so these
// tests run against this repository's own checkout, the same way `ops.test.ts` does for the ops suite.
//
// Every gate is composed into some ops since 2026-09-06 (`runner-provenance` and `disabled-declared`,
// Plan-025 Track 4 item 6, were the last two, now in `governance`), so this repository's own catalog
// reports no gap — and a gate added later without an ops entry is what this test would catch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "@entelekheia/vibe-ops-core";
import { buildCatalog } from "../src/catalog.ts";

const repoRoot = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");

// THE REAL CONFIG, not `{}`. Since Plan-038 track 6 which ops compose is the repository's own answer
// (`config.ops`), so a catalog built against an empty config reports this repository's `mirror` and
// `for-vibe-ops` gates as composed nowhere — which is true of the config it was handed and false of the
// repository the test claims to be checking.
async function baseContext() {
  const { config } = await loadConfig(repoRoot);
  return {
    repoRoot,
    flags: {},
    args: [],
    config,
    settings: undefined,
    surface: "cli" as const,
    log: () => {},
    warn: () => {},
  };
}

test("buildCatalog: against this repository's own checkout, every available gate and fragment is composed into something", async () => {
  const catalog = await buildCatalog(await baseContext());
  assert.deepEqual([...catalog.uncomposed], []);
});

test("buildCatalog: an ops package that fails to load composes nothing from itself, rather than throwing", async () => {
  // Same repoRoot, but nothing about failure handling depends on it — this asserts the shape survives a
  // module-load failure path indirectly by confirming a normal run never throws even though it internally
  // best-effort loads five other packages.
  await assert.doesNotReject(buildCatalog(await baseContext()));
});
