// vibe-ops agents-md — the instruction surface as an ops.
//
// Composition only: no detector lives here. Each gate is resolved from @entelekheia/vibe-ops-gates,
// where it is importable on its own — an ops that owned its gates outright would force `memory-slug`
// to be copied into every ops that also needs it, and the copies would drift exactly the way two
// copies of anything drift in this repository. See project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md.
//
// This ops runs BESIDE cli/packages/module-check/sh/check.sh, not instead of it — five of the seven
// entries below port 10-budget.sh, 30-bridge.sh, 40-frontmatter.sh, 45-skill-frontmatter.sh and
// 60-memory-slugs.sh, and the two are meant to be compared, finding by finding, before the shell
// fragments are ever removed. That removal is a separate, later act. `pairing` and `claude-md-content`
// are not ports — the shell runner never checked the AGENTS.md ↔ CLAUDE.md pairing at all.
//
// Plan-013 Track 6: the three `fragment-parity` entries below are that comparison, made mechanical —
// same runner as `ops-governance`'s own `links` entry, same shape. Not emitted, same reasoning as that
// entry: `fragment-parity` is temporary by construction, tied to a shell fragment RFC-0001 expects to
// eventually delete, and a series that dies with its subject is one nobody reads. Each entry's `paths`
// mirrors the population of the check it is comparing against, so the comparison means what it says.
//
// THE COLLECTION IS `ops.json`, AND THIS FILE IS ITS TYPING SUGAR (Plan-034 Track 2).
//
// THE ENTRIES, AND WHY EACH IS SHAPED AS IT IS.
//
// The `agent-frontmatter` entry: no `fragment-parity` entry accompanies this one, and none ever will.
// Parity compares a gate against the shell fragment it ports, and `agent` has no fragment to replace
// (Plan-024 Track 6).
//
// The `memory-slug` entry: the only entry that emits (RFC-0001, Rationale) — the others are
// structural properties that, once corrected, stay corrected. This one is behavioural and recurrent,
// and worth a series.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineOps, parseOpsDefinition } from "@entelekheia/vibe-ops-core";

const collection = new URL("../ops.json", import.meta.url);

export default defineOps(parseOpsDefinition(readFileSync(collection, "utf8"), fileURLToPath(collection)));
