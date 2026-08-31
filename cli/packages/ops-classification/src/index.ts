// vibe-ops classification — what a committed file may not carry.
//
// The collection is `ops.json`; this file is its typing sugar and holds the narrative JSON cannot.
//
// Every entry here is one classification rule: a level, the patterns that level forbids, and the
// population the rule governs. The gate decides how a finding may speak from the level; this ops decides
// what is forbidden and where to look.
//
// The four levels, and what each one is for in this repository:
//
//   secret        material that must not exist in the repository at all, and must not be reproduced in
//                 the run's output either. The deny-list is the case: naming its entries in order to
//                 grep for them would leak them, so the list arrives as a path and never as data.
//   confidential  material that is real and must be rewritten — an absolute path from someone's machine,
//                 an attribution a target repository never made.
//   internal      material that travels badly rather than dangerously: a pointer to a note nobody else
//                 holds reads as a dangling reference the moment the repository is cloned alone.
//   public        forbids nothing; the gate refuses a rule declared at that level.
//
// WHY THIS IS NOT PART OF `agents-md`, which is where `memory-slug` used to sit. That ops reads the
// instruction surface and asks whether it is well formed. These entries ask a different question of a
// different population — whether any committed file carries material its classification forbids — and
// the populations only overlap by accident.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineOps, parseOpsDefinition } from "@entelekheia/vibe-ops-core";

const collection = new URL("../ops.json", import.meta.url);

export default defineOps(parseOpsDefinition(readFileSync(collection, "utf8"), fileURLToPath(collection)));
