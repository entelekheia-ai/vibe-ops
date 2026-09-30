// The report block: what a person at a terminal sees at the end of a run whose `data` is a report.
//
// Reached only from `render.ts`, and only once it has chosen rich — this file never decides whether to
// draw, only what the drawing looks like, so it can be reworked without touching the plain path a
// machine reads. It returns lines rather than writing them, which keeps it testable without a stream.
//
// The last line is always the module's own summary, verbatim. For `check` that is `N checks, M failed`,
// the text consumer gates grep for; the glyph in front of it is the only thing the block adds to it.

import type { Report, ReportFinding } from "@entelekheia/vibe-ops-core";

export type Paint = (style: "bold" | "dim" | "red" | "yellow" | "green", text: string) => string;

export interface ReportHeader {
  /** What ran, e.g. `vibe-ops check`. */
  readonly title: string;
  /** What the run analysed: the anchor — the repository's name, even from a linked working tree. */
  readonly where: string;
  readonly summary: string;
  readonly code: number;
}

export const GLYPH = { fail: "✖", warn: "⚠", skip: "⊘", ok: "✔" } as const;

function location(finding: ReportFinding): string | undefined {
  if (finding.file === undefined) return undefined;
  return finding.line === undefined ? finding.file : `${finding.file}:${String(finding.line)}`;
}

/**
 * The evidence with its own leading `file: ` removed when the location is already drawn on the line above
 * — `check` folds the file into `evidence` for its `--json` readers and carries it beside as well.
 */
function withoutLocation(finding: ReportFinding): string {
  if (finding.file === undefined) return finding.evidence;
  const prefix = `${finding.file}: `;
  return finding.evidence.startsWith(prefix) ? finding.evidence.slice(prefix.length) : finding.evidence;
}

/** Findings grouped by the gate or check that produced them, failures first, in the order each id first appeared. */
function grouped(findings: readonly ReportFinding[]): { id: string; level: "fail" | "warn"; items: ReportFinding[] }[] {
  const groups = new Map<string, { id: string; level: "fail" | "warn"; items: ReportFinding[] }>();
  for (const finding of findings) {
    const group = groups.get(finding.id) ?? { id: finding.id, level: finding.level, items: [] };
    // One failing entry makes the whole group a failure: the group heading must never read milder than
    // the worst thing under it.
    if (finding.level === "fail") group.level = "fail";
    group.items.push(finding);
    groups.set(finding.id, group);
  }
  const all = [...groups.values()];
  return [...all.filter((group) => group.level === "fail"), ...all.filter((group) => group.level === "warn")];
}

export function renderReport(report: Report, header: ReportHeader, paint: Paint): string[] {
  const fails = report.findings.filter((finding) => finding.level === "fail").length;
  const warns = report.findings.length - fails;
  const skips = report.skipped.length;

  const counts = [
    paint(fails > 0 ? "red" : "dim", `${GLYPH.fail} ${String(fails)} fail`),
    paint(warns > 0 ? "yellow" : "dim", `${GLYPH.warn} ${String(warns)} warn`),
    paint("dim", `${GLYPH.skip} ${String(skips)} skip`),
  ].join("    ");

  const lines = ["", `  ${paint("dim", "result of")} ${paint("bold", header.title)} ${paint("dim", `– ${header.where}`)}`, "", `  ${counts}`];

  for (const group of grouped(report.findings)) {
    const colour = group.level === "fail" ? "red" : "yellow";
    const count = group.items.length > 1 ? paint("dim", ` (${String(group.items.length)})`) : "";
    lines.push("", `  ${paint(colour, GLYPH[group.level])} ${paint("bold", group.id)}${count}`);
    for (const item of group.items) {
      const where = location(item);
      if (where !== undefined) lines.push(`    ${where}`);
      lines.push(`    ${paint("dim", withoutLocation(item))}`);
    }
  }

  // Skips are counted, not listed: a clean run with declared disablements is still a clean run, and the
  // list is one `--verbose` away. The count keeps them from vanishing.
  const ok = header.code === 0;
  lines.push("", `  ${ok ? paint("green", GLYPH.ok) : paint("red", GLYPH.fail)} ${header.summary}`, "");
  return lines;
}
