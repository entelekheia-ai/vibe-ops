// vibe-ops self — what this repository CLAIMS ABOUT ITSELF, checked against what it is.
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
// resolves in the TARGET repository rather than this one. That holds for each of its twelve entries and
// is false for `template-heading-drift`, whose whole subject is the false text those shipped copies
// carry. `ignore` is additive with no negation, so keeping both meant replacing one `"*"` line with
// thirteen per-label ones — and thirteen lines is not the cost. The cost is that `"*"` was a SAFE
// DEFAULT: a gate added to `governance` inherited the exclusion without anyone thinking about it, and
// after the split it inherited nothing and would read the shipped templates in silence, green. Moving
// the odd entry out restores the default it was breaking.
//
// WHAT ELSE BELONGS HERE. Anything whose subject is this repository's own claims about its own
// machinery. Plan-014 leaves two named: a document that fails to mention a section a template GAINED,
// and a renamed section, where the old name is forbidden and the new one required in the same places.
// Both share this population and this exclusion list, which is what makes this a composition rather
// than a package built around one detector.
//
// TEMPLATE-HEADING-DRIFT. `.agents/` IS NAMED EXPLICITLY because `**/*.md` does not reach a
// dot-directory, and the rule that governs work inside `project/` is one of the six documents this gate
// exists to correct. Left implicit it reports a clean sweep over everything except the file that matters
// most. Since Plan-033 each type's notes and template live in its own governance package. The gate takes
// ONE migrations directory, so the notes are listed per package in `options.migrations`; until the gate
// takes several, the plan package's directory carries the only notes that record dropped sections today.
// A note that drops a section, a template that no longer has it, and a rule asserting records still carry
// it — the three files whose disagreement is the whole defect, in the smallest tree that can hold them.
// `<plugin>/` resolves to the fixture root, so a run pointed at the real plugin surface fails here
// instead of passing on the wrong corpus.
//
// UNSTATED-DESTINATION. The notes are prose about this repository's own machinery too — and the one
// kind whose reader is a migration about to move somebody's content. Population is the notes themselves,
// not the documents describing them, which is what separates this from the template-heading-drift entry
// above: that one reads the notes as its authority, this one reads them as its subject. Two notes, and
// the second is the point. A fixture carrying only the violation passes whether or not the gate
// distinguishes anything: the decoy drops a section AND routes it, so a gate that fired on every
// `**dropped**` row would produce two findings where one is correct. The two notes `unstated-destination`
// is proven on are exported because the fixture runner asserts only that the expected rule fired — which
// a gate firing on every `**dropped**` row would also satisfy. The other direction, that the decoy stays
// silent, is asserted in this package's test against this object, so the fixture and the assertion cannot
// drift into describing different notes. Since Plan-034 this export and the fixture cannot drift because
// the fixture is read from ops.json's own `fixture.files` object.

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
