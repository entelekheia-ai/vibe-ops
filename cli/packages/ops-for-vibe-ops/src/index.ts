// vibe-ops for-vibe-ops — what this repository CLAIMS ABOUT ITSELF, checked against what it is.
//
// THE COLLECTION IS `ops.json`, AND THIS FILE IS ITS TYPING SUGAR (Plan-034 Track 2). The data form
// is canonical, and what follows is the narrative the JSON cannot carry.
//
// WHY THIS IS NOT PART OF `governance`, which is the question a reader will have. `governance` asks "is
// this record well formed?" and every one of its entries is scoped to a record directory. The entries
// here ask the near-complement: "does the prose describing our own machinery still match the machinery?"
// — so the population is, deliberately, everything that is NOT a record. RFC-0001's test is exactly
// that: a signal's identity includes the population it was read over, and two readings this different
// are two signals, not one composition with an odd member.
//
// IT WAS PART OF `governance` FOR ONE COMMIT, AND THE CONFIG SAID SO. `governance` excluded
// `**/templates/**` from every entry through a single `"*"` line, because a shipped template's content
// resolves in the TARGET repository rather than this one. That `"*"` was a SAFE DEFAULT: a gate added to
// `governance` inherited the exclusion without anyone thinking about it, and a gate whose subject IS the
// shipped copies would inherit it too and read nothing, in silence, green. Splitting kept the default
// intact for the twelve entries it is right for.
//
// WHAT IS LEFT HERE AFTER PLAN-037, AND WHY IT IS ONE ENTRY. `template-heading-drift` moved to `mirror`,
// whose subject is a PAIR — a migration note's record of a dropped section against the documents still
// asserting the section exists. What stays is the reading with no counterpart: prose this repository
// writes about its own machinery, read as itself. That is a narrower subject than the one this package
// was opened with, and it is the honest one; a package holding a single entry is not a defect, whereas a
// package whose subject cannot be stated without an "and" is.
//
// WHAT ELSE BELONGS HERE. Anything whose subject is this repository's own claims about its own
// machinery, read directly rather than against a second copy. Plan-014 leaves one named that still fits:
// a document that fails to mention a section a template GAINED — the absence of an assertion, which no
// pairwise comparison detects.
//
// UNSTATED-DESTINATION. The notes are prose about this repository's own machinery, and the one kind
// whose reader is a migration about to move somebody's content. Population is the notes THEMSELVES, not
// the documents describing them — which is exactly what separates this from the entry that left: that
// one read the notes as its authority, this one reads them as its subject. Two notes, and the second is
// the point. A fixture carrying only the violation passes whether or not the gate distinguishes
// anything: the decoy drops a section AND routes it, so a gate that fired on every `**dropped**` row
// would produce two findings where one is correct.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineOps, parseOpsDefinition } from "@entelekheia/vibe-ops-core";

const collection = new URL("../ops.json", import.meta.url);
const definition = parseOpsDefinition(readFileSync(collection, "utf8"), fileURLToPath(collection));

/**
 * The two notes `unstated-destination` is proven on, exported because the fixture runner asserts only
 * that the expected rule fired — which a gate firing on every `**dropped**` row would also satisfy. The
 * other direction, that the decoy stays silent, is asserted in this package's test against **this**
 * object, so the fixture and the assertion cannot drift into describing different notes. Since Plan-034
 * it is read from ops.json's own fixture, so the export and the fixture cannot drift.
 */
export const UNSTATED_DESTINATION_NOTES: Readonly<Record<string, string>> =
  definition.gates.find((entry) => entry.gate === "unstated-destination")!.fixture!.files;

export default defineOps(definition);
