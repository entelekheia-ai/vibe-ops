// `vibe-ops plan status` — the coherence read record-header deliberately does not do (its own header
// says reading a header field's VALUE mechanically "is a different act with its own scope than this
// one"; this is that act, Plan-011 Track 3). Two shapes are findings, neither ranked against the other:
// a plan at its TERMINAL status with an unchecked track box, or a plan at its ACTIVE status with every
// track box checked — both say the `Status` field and the plan's own tracks disagree about whether the
// work is done.

import path from "node:path";
import type { Document, DocumentStore } from "@entelekheia/vibe-ops-core";
import type Parser from "tree-sitter";
import { findHeaderTable, valueOf } from "./header-table.ts";
import { DEPTH, listMarkdownFiles } from "./layout.ts";

export interface PlanStatusFinding {
  readonly file: string;
  readonly status: string;
  readonly tracksTotal: number;
  readonly tracksChecked: number;
  readonly reason: "terminal-with-open-tracks" | "active-with-all-tracks-checked";
}

/**
 * The `section` node (a heading with everything up to the next same-or-higher heading — the grammar
 * groups them, so the section boundary is declared by the document rather than inferred from a blank
 * line) whose level-2 heading reads exactly `headingText`.
 */
function findH2Section(root: Parser.SyntaxNode, headingText: string): Parser.SyntaxNode | undefined {
  for (const heading of root.descendantsOfType("atx_heading")) {
    if (!heading.children.some((child) => child.type === "atx_h2_marker")) continue;
    const inline = heading.children.find((child) => child.type === "inline");
    if (inline?.text.trim() === headingText) {
      return heading.parent?.type === "section" ? heading.parent : undefined;
    }
  }
  return undefined;
}

/**
 * Every `- [ ]`/`- [x]` under the `## Tracks` section — one checkbox per track, plus the closure line
 * ("Run `/vibe-ops:close-plan`") the `plan@0.2` template itself adds as the section's last item.
 *
 * Reads the block tree, not the text: `task_list_marker_checked`/`task_list_marker_unchecked` are real
 * node types, so a checkbox written inside a fenced example block is structurally not one of these and
 * is never counted. That is the same distinction `markdown-link` relies on for a link inside a code
 * span — the grammar separates them, so nothing has to strip anything first.
 */
export function trackCheckboxes(document: Document): { readonly total: number; readonly checked: number } {
  const root = document.tree?.rootNode;
  if (root === undefined) return { total: 0, checked: 0 };

  const section = findH2Section(root, "Tracks");
  if (section === undefined) return { total: 0, checked: 0 };

  let total = 0;
  let checked = 0;
  for (const marker of section.descendantsOfType(["task_list_marker_checked", "task_list_marker_unchecked"])) {
    total++;
    if (marker.type === "task_list_marker_checked") checked++;
  }
  return { total, checked };
}

/**
 * Sweeps every `.md` file under `dir` (the resolved plan directory, at the same depth as
 * `resolveRecord`'s own DEPTH for `plan`, so `shipped/` is included), reading each one's `Status` header value and its track
 * checkboxes. A file with no header table, no `Status` row, or no track checkboxes at all is silently
 * skipped — that is `AGENTS.md`/`README.md`, or a plan predating the `## Tracks` convention, never a
 * finding by omission.
 *
 * Takes the caller's `DocumentStore` rather than building one: the store is the per-run parse cache, and
 * a command that resolves and then sweeps must not parse the same template and the same plans twice.
 */
export function planStatusFindings(
  documents: DocumentStore,
  repoRoot: string,
  dir: string,
  active: string | undefined,
  terminal: string | undefined,
): readonly PlanStatusFinding[] {
  if (active === undefined || terminal === undefined || active === terminal) return [];

  const findings: PlanStatusFinding[] = [];
  // DEPTH["plan"] rather than 1: a shipped plan moves into `shipped/` and keeps its number, so the
  // coherence read has to still see it — a plan that vanished from this sweep on the day it shipped
  // would look coherent by having stopped being read.
  for (const relative of listMarkdownFiles(path.join(repoRoot, dir), DEPTH.plan)) {
    const file = `${dir}/${relative}`;
    const document = documents.get(file);
    if (document.tree === undefined) continue;

    const table = findHeaderTable(document.tree.rootNode);
    if (table === undefined) continue;
    const status = valueOf(table, "Status");
    if (status === undefined) continue;

    const { total, checked } = trackCheckboxes(document);
    if (total === 0) continue;

    if (status === terminal && checked < total) {
      findings.push({ file, status, tracksTotal: total, tracksChecked: checked, reason: "terminal-with-open-tracks" });
    } else if (status === active && checked === total) {
      findings.push({ file, status, tracksTotal: total, tracksChecked: checked, reason: "active-with-all-tracks-checked" });
    }
  }
  return findings;
}
