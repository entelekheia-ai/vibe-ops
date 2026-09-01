// `vibe-ops plan status` — the coherence read record-header deliberately does not do (its own header
// says reading a header field's VALUE mechanically "is a different act with its own scope than this
// one"; this is that act, Plan-011 Track 3). Two shapes are findings, neither ranked against the other:
// a plan at its TERMINAL status with an unchecked track box, or a plan at its ACTIVE status with every
// track box checked — both say the `Status` field and the plan's own tracks disagree about whether the
// work is done.

import path from "node:path";
import type { Document, DocumentStore } from "@entelekheia/vibe-ops-core";
import type Parser from "tree-sitter";
import { findHeaderTable, trackCheckboxes, valueOf } from "@entelekheia/governance-base";
import { depthFor, listMarkdownFiles } from "@entelekheia/governance-base";

export interface PlanStatusFinding {
  readonly file: string;
  readonly status: string;
  readonly tracksTotal: number;
  readonly tracksChecked: number;
  readonly reason: "terminal-with-open-tracks" | "active-with-all-tracks-checked";
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
  for (const relative of listMarkdownFiles(path.join(repoRoot, dir), depthFor("plan"))) {
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
