// The same textual keys resolve-governance.sh printed, rendered from a `ResolvedRecord` instead of
// being a second place that computes them. Exists so a terminal caller and the shell-parity assertion
// in Plan-011's Success criteria have something to read and diff, without any module hand-formatting
// its own copy.
//
// `log` reaches here too, and it is the reason the parameter is wider than `ResolvedRecord`. It has a
// directory and nothing else — no number, no template, no authority — and it used to print its one line
// from a hand-written string inside its own module, which made two places decide how a resolved location
// prints and let them disagree about the absent-value spelling (Plan-027 Track 1).

import type { ResolvedLocation, ResolvedRecord } from "./resolve.ts";

/**
 * Whether this resolution is of a numbered type. Everything below `DIR=` is about numbering or about the
 * template that governs it, so an unnumbered location stops after one line rather than printing six
 * `(none)` lines that assert nothing.
 */
function isNumbered(resolved: ResolvedRecord | ResolvedLocation): resolved is ResolvedRecord {
  return "next" in resolved;
}

export function formatResolved(record: ResolvedRecord | ResolvedLocation): string[] {
  const lines: string[] = [];
  lines.push(`DIR=${record.dir ?? "(none)"}`);
  if (!isNumbered(record)) return lines;

  const templateSuffix = record.templateSource !== undefined ? ` (${record.templateSource})` : "";
  lines.push(`TPL=${record.template !== undefined ? `${record.template}${templateSuffix}` : "(none)"}`);

  // `(unknown)`, never a version this did not read. The distinction is the point: an absent declaration
  // is a file nobody has classified, and printing a plausible number here would end that question.
  const declared = record.templateVersion;
  lines.push(
    `TPL_VERSION=${
      declared === undefined
        ? "(unknown)"
        : `${declared.type}@${declared.version}${declared.source === "comment" ? " (pre-frontmatter)" : ""}`
    }`,
  );

  lines.push(`AUTHORITY=${record.authority ?? "(default)"}`);
  lines.push(`PAD=${record.pad}`);
  lines.push(`EXISTING=${record.existing}`);
  lines.push(
    `NEXT=${
      typeof record.next === "string"
        ? record.next
        : `(unknown — ${record.existing} record(s) present, none numbered; follow AUTHORITY)`
    }`,
  );

  if (record.plan !== undefined) {
    lines.push(`PLAN_ACTIVE=${record.plan.active ?? "(unknown)"}`);
    lines.push(`PLAN_TERMINAL=${record.plan.terminal ?? "(unknown)"}`);
    lines.push(`LIVING=${record.plan.living !== undefined ? record.plan.living.join(", ") : "(unknown)"}`);
  }
  if (record.task !== undefined) {
    lines.push(`GH_REMOTE=${record.task.ghRemote ?? "(none)"}`);
    lines.push(`GH_AUTH=${record.task.ghAuth}`);
  }
  return lines;
}
