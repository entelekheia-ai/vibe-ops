// The report shape: what a module returns in `data` when its answer is a list of findings. Two producers
// already return it — `runOps` (every ops) and `check` — and the terminal draws a report block for any
// `data` this file recognises. A module joins by returning the shape; nothing registers it.
//
// The two producers name a finding's origin differently: `runOps` says `gate`, `check` says `check`
// (it re-keys the ops' findings when it merges them). Both are accepted and normalised to `id`, so a
// reader never has to know which producer it is looking at.

export interface ReportFinding {
  /** The gate or check that produced it, as the producer named it. */
  readonly id: string;
  readonly level: "fail" | "warn";
  readonly evidence: string;
  readonly file?: string;
  readonly line?: number;
}

export interface ReportSkip {
  readonly id: string;
  readonly reason: string;
}

export interface Report {
  readonly findings: readonly ReportFinding[];
  readonly skipped: readonly ReportSkip[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function idOf(entry: Record<string, unknown>): string | undefined {
  const id = entry["check"] ?? entry["gate"];
  return typeof id === "string" && id !== "" ? id : undefined;
}

function readFinding(entry: unknown): ReportFinding | undefined {
  if (!isRecord(entry)) return undefined;
  const id = idOf(entry);
  const { level, evidence, file, line } = entry;
  if (id === undefined || (level !== "fail" && level !== "warn") || typeof evidence !== "string") return undefined;
  if (file !== undefined && typeof file !== "string") return undefined;
  if (line !== undefined && typeof line !== "number") return undefined;
  return {
    id,
    level,
    evidence,
    ...(file === undefined ? {} : { file }),
    ...(line === undefined ? {} : { line }),
  };
}

function readSkip(entry: unknown): ReportSkip | undefined {
  if (!isRecord(entry)) return undefined;
  const id = idOf(entry);
  const { reason } = entry;
  if (id === undefined || typeof reason !== "string") return undefined;
  return { id, reason };
}

/**
 * The report a module's `data` carries, normalised, or `undefined` when `data` is not one.
 *
 * Strict on purpose: one malformed entry rejects the whole payload rather than dropping that entry. A
 * report drawn with a finding silently missing reads as a cleaner run than the one that happened, which
 * is worse than falling back to the summary line. Empty lists are a report — a clean run is one.
 */
export function readReport(data: unknown): Report | undefined {
  if (!isRecord(data)) return undefined;
  const { findings, skipped } = data;
  if (!Array.isArray(findings) || !Array.isArray(skipped)) return undefined;
  const readFindings = findings.map(readFinding);
  const readSkips = skipped.map(readSkip);
  if (readFindings.includes(undefined) || readSkips.includes(undefined)) return undefined;
  return { findings: readFindings as ReportFinding[], skipped: readSkips as ReportSkip[] };
}

/** Whether `data` is a report — `readReport` without the normalised copy. */
export function isReport(data: unknown): boolean {
  return readReport(data) !== undefined;
}
