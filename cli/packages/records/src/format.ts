// The same textual keys resolve-governance.sh printed, rendered from a `ResolvedRecord` instead of
// being a second place that computes them. Exists so a terminal caller and the shell-parity assertion
// in Plan-011's Success criteria have something to read and diff, without any module hand-formatting
// its own copy.

import type { ResolvedRecord } from "./resolve.ts";

export function formatResolved(record: ResolvedRecord): string[] {
  const lines: string[] = [];
  lines.push(`DIR=${record.dir ?? "(none)"}`);

  const templateSuffix = record.templateSource !== undefined ? ` (${record.templateSource})` : "";
  lines.push(`TPL=${record.template !== undefined ? `${record.template}${templateSuffix}` : "(none)"}`);

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
    lines.push(`LIVING=${record.plan.living !== undefined ? record.plan.living.join(", ") : "(unknown)"}`);
  }
  if (record.task !== undefined) {
    lines.push(`GH_REMOTE=${record.task.ghRemote ?? "(none)"}`);
    lines.push(`GH_AUTH=${record.task.ghAuth}`);
  }
  return lines;
}
