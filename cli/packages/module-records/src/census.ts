// The census: what version is every record in this repository, read the same way every other reader in
// Plan-012 reads it — through `readTemplateVersion`, which knows both the frontmatter form and the HTML
// comment that predates it.
//
// IT EXISTS TO REPLACE A REGEX. `/vibe-ops:migrate` Step 1 used to answer this with `rg -o
// 'vibe-ops-template (\S+)@([0-9.]+)'`, which demands a space where frontmatter writes a colon: measured
// on this repository it found 8 records out of 32. The companion query for the unstamped population was
// `--files-without-match 'vibe-ops-template'`, a plain substring match, so a record that merely discusses
// versioning counted as declared, and it never looked at `project/log/` at all. Neither failure is
// visible in its own output — both report a number.
//
// NOTHING IS INFERRED, and nothing is graded. A record that declares no version is `undefined` here and
// prints as `(unknown)`; it is never resolved to the oldest known shape, because that guess is wrong in
// both directions (see `template-version.ts`). No score, no grade, no "health": this repository reports
// what it saw and a reader decides what it is worth.

import path from "node:path";
import type { DocumentStore, RecordType, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import {
  depthFor,
  findLogDir,
  listMarkdownFiles,
  NOT_A_RECORD,
  readTemplateVersion,
  resolveRecord,
} from "@entelekheia/governance-base";

/** The four numbered types plus `log`, which has no number and so no `RecordType` of its own. */
export type CensusType = RecordType | "log";

export interface CensusEntry {
  /** Repository-relative, so a line is pasteable into an editor from wherever the command was run. */
  readonly file: string;
  /** Which directory it was found under — not what it declares, which may disagree and is the point. */
  readonly type: CensusType;
  /** `plan@3`, or absent when the record declares nothing. Never a guess. */
  readonly declared?: string;
  /** Which form carried the declaration. `comment` means it predates the move to frontmatter. */
  readonly source?: "frontmatter" | "comment";
}

const ORDER: readonly CensusType[] = ["adr", "rfc", "plan", "task", "log"];

/**
 * The types to census: the five this tooling ships, plus any the REPOSITORY declares a directory for.
 *
 * The shipped five alone were the whole list until Plan-029 opened the type union, and that made the
 * census the one surface where a contributed type stayed invisible — it type-checked, its tokens
 * expanded, its directory resolved, and then nothing counted it. A census that silently omits a
 * population is the failure this command exists to end: it was written to replace an `rg` that found 8
 * records out of 32 and reported a number either way.
 *
 * Declared types come last and in declaration order, so the shipped five keep the order every existing
 * reading used.
 */
function censusOrder(config: VibeOpsConfig | undefined): readonly CensusType[] {
  const declared = Object.keys(config?.records?.dirs ?? {}).filter((type) => !ORDER.includes(type));
  return [...ORDER, ...declared];
}

/** What a record declaring nothing prints as — never a version, in either direction. */
const UNKNOWN = "(unknown)";

function read(
  documents: DocumentStore,
  repoRoot: string,
  dir: string,
  type: CensusType,
  depth: number,
): CensusEntry[] {
  const entries: CensusEntry[] = [];
  for (const relative of listMarkdownFiles(path.join(repoRoot, dir), depth)) {
    const basename = path.basename(relative);
    if (NOT_A_RECORD.has(basename)) continue;
    const file = `${dir}/${relative}`;
    const declared = readTemplateVersion(documents.get(file));
    entries.push(
      declared === undefined
        ? { file, type }
        : { file, type, declared: `${declared.type}@${declared.version}`, source: declared.source },
    );
  }
  return entries;
}

/**
 * Every record in `repoRoot`, in a stable order: by type (adr, rfc, plan, task, log), then by path. Each
 * numbered type is located through `resolveRecord`, so a repository that declares its directories in
 * `vibeops.config.ts` is walked where it actually keeps them rather than where the defaults guess.
 *
 * A type with no directory contributes nothing and is not an error — a repository that keeps no RFCs is
 * an ordinary repository, not a broken one.
 */
export function census(
  repoRoot: string,
  config: VibeOpsConfig | undefined,
  documents: DocumentStore,
): readonly CensusEntry[] {
  const entries: CensusEntry[] = [];
  for (const type of censusOrder(config)) {
    const dir =
      type === "log"
        ? findLogDir(repoRoot)
        : resolveRecord(type, repoRoot, config, documents).dir;
    if (dir === undefined) continue;
    const found = read(documents, repoRoot, dir, type, depthFor(type));
    found.sort((a, b) => a.file.localeCompare(b.file));
    entries.push(...found);
  }
  return entries;
}

/**
 * The census as a terminal reads it: one line per record, grouped by type, then a tail counting the
 * population by what it declares. The tail is counts only — no score and no verdict, per RFC-0001.
 */
export function formatCensus(entries: readonly CensusEntry[]): readonly string[] {
  if (entries.length === 0) return ["no record directories in this repository"];

  const width = Math.max(...entries.map((entry) => entry.file.length));
  const lines: string[] = [];
  let group: CensusType | undefined;
  for (const entry of entries) {
    if (entry.type !== group) {
      if (group !== undefined) lines.push("");
      group = entry.type;
      lines.push(`${group}/`);
    }
    lines.push(`  ${entry.file.padEnd(width)}  ${entry.declared ?? UNKNOWN}`);
  }

  // `(unknown)` is printed even at zero. It is the number this verb exists to get right, and a line that
  // appears only when it is non-zero is indistinguishable from one nobody measured.
  const counts = new Map<string, number>([[UNKNOWN, 0]]);
  for (const entry of entries) {
    const key = entry.declared ?? UNKNOWN;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const keys = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  const keyWidth = Math.max(...keys.map((key) => key.length));
  lines.push("");
  lines.push(`${entries.length} records`);
  for (const key of keys) lines.push(`  ${key.padEnd(keyWidth)}  ${counts.get(key) ?? 0}`);
  return lines;
}
