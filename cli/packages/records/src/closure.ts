// The task dossier's `## Closure` box — the one marker that decides whether a dossier may be deleted.
// Read here once and used by both halves of Plan-011 Track 4: `task guard` (which refuses a hand
// deletion) and `task close` (which ticks it), so the two can never disagree about what "closed" means.
//
// The convention is not invented here. The task template ships the line itself — "- [ ] Run
// `/vibe-ops:close task` — do not just delete this file. Stays unchecked until closure actually runs" —
// and this is a reader for it. A dossier from a repository that never adopted the convention has no such
// line, and is nobody's business.
//
// Reads the block tree rather than matching `- \[ \]` against raw lines: `task_list_marker_unchecked` is
// a real node type, so a checkbox quoted inside a fenced example — which a task dossier full of shell
// transcripts is exactly the file most likely to contain — is structurally not one of these.

import type { Document } from "@entelekheia/vibe-ops-core";
import type Parser from "tree-sitter";

/**
 * Matches the closure line's own wording, tolerating both the skill name that ships today
 * (`/vibe-ops:close task`) and the split form Track 7 introduces (`/vibe-ops:close-task`). A dossier
 * written against either must read the same, since the two forms coexist in every repository that has
 * not migrated yet.
 */
const CLOSURE_LINE = /close[-\s]task/i;

/**
 * The plan's equivalent line, which lives in its `## Tracks` list rather than in a `## Closure` section:
 * "- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals … Stays unchecked until the plan is
 * actually closed". Ticked by `plan close` for the same reason `task close` ticks its own — left open, the
 * plan reports as incoherent to `plan status` forever, which is where it was found: every plan shipped
 * before 2026-08-12 carries the complaint.
 */
const PLAN_CLOSURE_LINE = /close[-\s]plan/i;

function closureItems(document: Document, marker: string, line = CLOSURE_LINE): readonly Parser.SyntaxNode[] {
  const root = document.tree?.rootNode;
  if (root === undefined) return [];
  return root
    .descendantsOfType(marker)
    .filter((node) => node.parent?.type === "list_item" && line.test(node.parent.text));
}

/**
 * Whether this dossier still has an unchecked box naming the closure command. `false` for a dossier that
 * has been closed, and equally for one that never carried the line — the caller must not treat absence of
 * the convention as a refusal.
 */
export function closureBoxOpen(document: Document): boolean {
  return closureItems(document, "task_list_marker_unchecked").length > 0;
}

/**
 * The dossier's text with its closure box ticked, or `undefined` when there is no open box to tick.
 *
 * Splices `[x]` over the marker node's own byte range rather than running a substitution over the line:
 * the node's span is exactly the three characters, so nothing else on a line that also contains a code
 * span, a link, or another bracketed pair can be caught by accident. The shell's `sed` anchored on
 * `close task` appearing after the box on the SAME line, which the template's own wrapped line satisfies
 * only because it wraps where it does.
 */
export function tickClosureBox(document: Document): string | undefined {
  const [marker] = closureItems(document, "task_list_marker_unchecked");
  if (marker === undefined) return undefined;
  return `${document.text.slice(0, marker.startIndex)}[x]${document.text.slice(marker.endIndex)}`;
}

/**
 * The plan's text with its own closure box ticked, or `undefined` when there is none open.
 *
 * Same splice, different line. A plan whose box stays open after the file has moved into `shipped/`
 * makes `plan status` report it as terminal-with-an-unchecked-track for the rest of its life, and the
 * only way anyone notices is by reading a complaint about a plan nobody is working on.
 */
export function tickPlanClosureBox(document: Document): string | undefined {
  const [marker] = closureItems(document, "task_list_marker_unchecked", PLAN_CLOSURE_LINE);
  if (marker === undefined) return undefined;
  return `${document.text.slice(0, marker.startIndex)}[x]${document.text.slice(marker.endIndex)}`;
}
