// vibe-ops mirror — WHAT ONE PLACE CLAIMS, ANOTHER PLACE MUST CONFIRM.
//
// THE COLLECTION IS `ops.json`, AND THIS FILE IS ITS TYPING SUGAR (Plan-034 Track 2). The data form is
// canonical, and what follows is the narrative the JSON cannot carry.
//
// THE SUBJECT, IN ONE SENTENCE, AND WHY IT IS ITS OWN OPS. Every entry here holds two things side by
// side and fails when they stop agreeing: a manifest against the marketplace entry that describes the
// same plugin, a registration against the scripts on disk, a template against the prose that describes
// its shape, a shell fragment against the gate that ports it. None of them is asking "is this file well
// formed?" — each is asking "do these two still say the same thing?", and neither side is the subject on
// its own. RFC-0001's test settles it: a signal's identity includes the population it was read over, and
// a population that is a PAIR is a different kind of reading from a population that is a set of files.
//
// WHAT THIS REPLACED, AND WHY THAT MATTERS MORE THAN THE TIDINESS. Before Plan-037 these entries were
// scattered across the three ops that happened to touch their subject, and the 2026-08-23 classification
// pass measured the consequence: every one of them is meaningless in a repository that publishes no
// Claude Code plugin or holds no vibe-ops checkout, and nothing distinguished them from the entries
// beside them that are meaningful everywhere. A composition announced seventeen checks and delivered
// seven. An `audience` field was built to filter them and removed unshipped — a boundary that has to be
// switched on, by a switch nothing turns, is not a boundary (Plan-035's Decision Log). This package IS
// the boundary: a repository that does not install it composes none of these, with nothing to declare.
//
// SO THE MEMBERSHIP RULE IS NOT "PLUGIN-SHAPED". It is the pair. An entry belongs here when it would be
// wrong to describe it by naming only one of the two things it reads, and it does NOT belong here merely
// because it happens to be internal to this repository — `unstated-destination` stays in `for-vibe-ops`, whose
// subject is the prose this repository writes about its own machinery, read as itself rather than
// against a counterpart.
//
// TEMPLATE-HEADING-DRIFT ARRIVES FROM `for-vibe-ops`, AND THE REASON `for-vibe-ops` EXISTS SURVIVES THE MOVE. That
// reason is `governance`'s single `ignore: { "*": ["**/templates/**"] }` line — a SAFE DEFAULT that a
// gate added to `governance` inherits without anyone thinking about it, and which is exactly wrong for
// the one gate whose subject is the content of those shipped copies. This ops declares no such
// exclusion and is not `governance`, so the default it would have broken is not in force here. What the
// entry compares is a migration note's record of a dropped section against the documents still asserting
// the section exists — a pair, which is why it is here rather than in `for-vibe-ops`.
//
// `.agents/` IS NAMED EXPLICITLY in that entry's paths because `**/*.md` does not reach a dot-directory,
// and the rule governing work inside `project/` is one of the documents the gate exists to correct. Left
// implicit it reports a clean sweep over everything except the file that matters most.
//
// THE FOUR FRAGMENT-PARITY ENTRIES ARE THE MOST LITERAL MEMBERS AND THE SHORTEST-LIVED. Each compares a
// shell fragment against the gate that ports it, which is the evidence RFC-0001 requires before a
// fragment is removed at all. They retire with the fragments they read (Plan-022's bar, and Plan-037's
// second phase), and this ops outlives them: the other entries compare pairs that are not going away.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineOps, parseOpsDefinition } from "@entelekheia/vibe-ops-core";

const collection = new URL("../ops.json", import.meta.url);

export default defineOps(parseOpsDefinition(readFileSync(collection, "utf8"), fileURLToPath(collection)));
