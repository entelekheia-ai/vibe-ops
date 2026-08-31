// The licence governance — pure sugar over @entelekheia/governance-base. It owns the licence texts and
// the registry that pins each to its published source; `mirror` verifies the pins, and `license-setup`
// reads the texts through the CLI rather than from a path inside the plugin.
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
