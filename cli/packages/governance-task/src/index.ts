// The task governance — pure sugar over @entelekheia/governance-base (Plan-033, ADR-0019). Everything
// behaviour-equal across artifacts lives in defineGovernance, written once; this file only tells it
// where THIS package is, because an installed package sits wherever npm put it and nothing else can
// know. The data (type.json, templates/, migrations/, authoring.md, ownership.json) ships beside dist/.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineGovernance } from "@entelekheia/governance-base";

// One level up from src/ (or dist/ — tsc preserves the depth), so this resolves identically from a
// checkout and from an installed package.
export default defineGovernance({
  root: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
  version: "0.0.1",
});
