// The style governance — pure sugar over @entelekheia/governance-base, and the default layer of the
// stack RFC-0005 §2.1 describes. It ships no record: `general.md` (moved byte-identical from
// `plugin/references/authoring-style.md`, Plan-040 Track 1's own move having already carried the other
// four policy references out of that directory) plus one fragment per target it documents
// (`type.json`'s `targets`). behaviour-equal across artefacts lives in defineGovernance, written once;
// this file only tells it where THIS package is, because an installed package sits wherever npm put it
// and nothing else can know. `general.md`, the target fragments and `type.json` ship beside `dist/`.
//
// COMPOSITION IS NOT THIS PACKAGE'S JOB. A repository's `types.style` stack may bind several style
// packages at once, each scoped to different artefacts, and merging what they each contribute is the
// composer's decision (`composeStylePolicy`, `@entelekheia/governance-base`'s `style-stack.ts`) — this
// package is one layer among possibly several, never the one place resolution happens.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineGovernance } from "@entelekheia/governance-base";

// One level up from src/ (or dist/ — tsc preserves the depth), so this resolves identically from a
// checkout and from an installed package.
export default defineGovernance({
  root: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
  version: "0.0.1",
});
