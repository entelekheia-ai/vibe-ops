// vibe-ops learning — the fact that holds beyond one repository (Plan-040 Track 3, RFC-0005 §2).
//
// PURE SUGAR, deliberately, unlike its sibling `log`: `resolve` (from `defineGovernance`'s own
// `STANDARD_COMMANDS`) is everything this module adds today. `learning` is NOT in
// `DEFAULT_GOVERNANCE_BINDINGS` — a repository binds it only when it has learnings of its own to keep,
// which is a smaller set than every repository that keeps a log. Building `index`/`sweep`/`lint` for a
// type nobody has bound yet would be machinery with no reader; the two units share `type.json` and the
// `lifecycle` policy facet (the promotion test that decides which of the two a fact becomes), so adding
// those verbs later, if a bound repository needs them, costs a manifest edit and this file — never the
// package's shape.
//
// THIS IS THE SECOND OF TWO ENTRY MODULES `@entelekheia/governance-knowledge` BUILDS FROM ONE MANIFEST
// (ADR-0020) — see `./index.ts` for `log`, the `.` export and the default binding. This one is the
// `./learning` export, and a repository reaches it only by declaring
// `types.learning: "@entelekheia/governance-knowledge#learning"` itself.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineGovernance } from "@entelekheia/governance-base";

export default defineGovernance({
  root: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
  version: "0.0.1",
  type: "learning",
  summary: "A fact that holds beyond one repository — resolve where it lives",
});
