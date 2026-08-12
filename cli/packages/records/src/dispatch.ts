// The dispatch: given a record and the template it was written against, which handling applies — and
// whether a verb may proceed at all. Plan-012's Design section specifies this as a flowchart, and the
// union below is that flowchart with one member per terminal box, deliberately: a caller that handles
// every member has handled every branch, and adding a branch later stops compiling until it does.
//
// THE LOAD-BEARING BRANCH IS `unknown`. An absent declaration is reported, never resolved to the oldest
// known shape. That guess is wrong in both directions — a record already written in the current shape
// receives a migration that does not apply to it, and a genuinely old one looks handled when it was
// guessed at. It is the same failure as defaulting an absent condition to zero: the output is
// indistinguishable from a correct one.
//
// WHAT "HANDLING EXISTS" MEANS, concretely. A record behind the current version is handleable when a
// contiguous chain of migration notes leads from its version to the current one — that chain is the
// documented path from the shape the record has to the shape the verb knows. A gap in the chain is a
// jump nobody wrote down, and inventing it is the thing `/vibe-ops:migrate` already refuses to do. So
// the same evidence answers both questions, and there is one place to look when either is wrong.
//
// NO VERSION VOCABULARY ON THE COMMON PATH. `describe()` returns `undefined` for a current record, and
// that is a contract rather than a convenience: a caller that logs its return value unconditionally
// prints nothing when nothing is owed. The transparency constraint is enforced by the shape of the
// return type, not by remembering to check.

import { readdirSync } from "node:fs";
import path from "node:path";
import type { Document } from "@entelekheia/vibe-ops-core";
import { readTemplateVersion, type DeclaredVersion } from "./template-version.ts";

/**
 * Component-wise, so the `0.x` labels that predate the integers order correctly against them: `0.2`
 * reads as [0, 2] and sorts below `3`. Returns <0 when `a` is behind `b`, 0 when equal, >0 when ahead.
 *
 * Exported because the `template-version` gate asks the same question. Two comparators would drift, and
 * a drift here is invisible: both answers look like a version ordering.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** One migration note, as its filename declares itself. */
export interface MigrationNote {
  readonly type: string;
  readonly from: string;
  readonly to: string;
  readonly file: string;
}

const NOTE = /^([a-z][a-z0-9-]*?)-([0-9]+(?:\.[0-9]+)*)-to-([0-9]+(?:\.[0-9]+)*)\.md$/;

/**
 * Every migration note in `dir`, parsed from its own filename. A directory that does not exist yields
 * none — a repository with no migration notes is an ordinary state, not an error, and it simply means
 * no older version is handleable.
 */
export function readMigrationNotes(dir: string): readonly MigrationNote[] {
  let entries: readonly string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const notes: MigrationNote[] = [];
  for (const entry of entries) {
    const matched = NOTE.exec(entry);
    if (matched === null) continue;
    const [, type, from, to] = matched;
    if (type === undefined || from === undefined || to === undefined) continue;
    notes.push({ type, from, to, file: path.join(dir, entry) });
  }
  return notes;
}

/**
 * The contiguous chain of notes from `from` to `to`, or the point where it breaks.
 *
 * Walks forward one note at a time and never combines jumps: `0.1 → 3` is two notes or it is nothing,
 * because a combined note stops matching either jump the next time a version moves. When several notes
 * leave the same version the shortest forward step wins, which keeps the walk deterministic without
 * needing the notes to be totally ordered.
 */
function chain(
  notes: readonly MigrationNote[],
  type: string,
  from: string,
  to: string,
): { readonly complete: true; readonly notes: readonly MigrationNote[] } | { readonly complete: false; readonly stuckAt: string } {
  const forType = notes.filter((note) => note.type === type);
  const walked: MigrationNote[] = [];
  let position = from;

  while (compareVersions(position, to) < 0) {
    const candidates = forType
      .filter((note) => compareVersions(note.from, position) === 0 && compareVersions(note.to, position) > 0)
      .sort((a, b) => compareVersions(a.to, b.to));
    const next = candidates[0];
    if (next === undefined) return { complete: false, stuckAt: position };
    walked.push(next);
    position = next.to;
    // A note overshooting the current version still lands the record somewhere the verb does not know.
    if (compareVersions(position, to) > 0) return { complete: false, stuckAt: next.to };
  }

  return { complete: true, notes: walked };
}

/** One member per terminal box of Plan-012's dispatch flowchart. */
export type Dispatch =
  /** The record is written against the current template. Nothing is said about versions anywhere. */
  | { readonly kind: "current"; readonly declared: DeclaredVersion }
  /** Older, and a documented path to the current shape exists. The verb proceeds and says one line. */
  | {
      readonly kind: "behind";
      readonly declared: DeclaredVersion;
      readonly current: DeclaredVersion;
      readonly notes: readonly MigrationNote[];
    }
  /** Older, and the path breaks. The verb stops and names the jump nobody wrote down. */
  | {
      readonly kind: "unhandled";
      readonly declared: DeclaredVersion;
      readonly current: DeclaredVersion;
      readonly stuckAt: string;
    }
  /** Newer than the template: the tooling is behind, which is not something to guess through. */
  | { readonly kind: "ahead"; readonly declared: DeclaredVersion; readonly current: DeclaredVersion }
  /** A record declaring one type's token while being handled as another. */
  | { readonly kind: "mismatch"; readonly declared: DeclaredVersion; readonly current: DeclaredVersion }
  /** No declaration. Reported as unknown; never resolved to the oldest known shape. */
  | { readonly kind: "unknown"; readonly current: DeclaredVersion }
  /** The template itself declares nothing, so no record under it can be compared. */
  | { readonly kind: "uncomparable"; readonly reason: string };

export interface DispatchOptions {
  /** The record being acted on. */
  readonly record: Document;
  /**
   * What the current shape is — the template's own declaration, as `resolveRecord` reports it. Absent
   * when the repository has no template for the type, or the template declares no version.
   */
  readonly current: DeclaredVersion | undefined;
  /** Where the migration notes live. Absent or empty means no older version is handleable. */
  readonly migrationsDir?: string;
}

/**
 * Which handling applies to `record`, following Plan-012's flowchart. Reads only; decides nothing about
 * what the caller does with the answer beyond `blocks()` below.
 */
export function dispatchRecord(options: DispatchOptions): Dispatch {
  const { record, current, migrationsDir } = options;

  if (current === undefined) {
    return {
      kind: "uncomparable",
      reason: "the template declares no version, so no record under it can be compared",
    };
  }

  const declared = readTemplateVersion(record);
  if (declared === undefined) return { kind: "unknown", current };
  if (declared.type !== current.type) return { kind: "mismatch", declared, current };

  const order = compareVersions(declared.version, current.version);
  if (order === 0) return { kind: "current", declared };
  if (order > 0) return { kind: "ahead", declared, current };

  const notes = migrationsDir === undefined ? [] : readMigrationNotes(migrationsDir);
  const walked = chain(notes, current.type, declared.version, current.version);
  return walked.complete
    ? { kind: "behind", declared, current, notes: walked.notes }
    : { kind: "unhandled", declared, current, stuckAt: walked.stuckAt };
}

/**
 * Whether the dispatch stops the verb. `behind` does not: an older record with a documented path is
 * acted on, with its format named. Everything else that is not `current` is a state the verb would have
 * to assume its way through, and assuming is what this plan removes.
 */
export function blocks(dispatch: Dispatch): boolean {
  return dispatch.kind !== "current" && dispatch.kind !== "behind";
}

/**
 * The one line an operator sees, or `undefined` when the record is current — in which case the verb says
 * nothing about versions at all. `file` is named in every line, because a batch verb reports on several
 * records and a bare version is not actionable without knowing which file carried it.
 *
 * A line that is produced must reach `data` as well as the log: `--json` suppresses every logged line, so
 * an alert living only in the log does not arrive on that surface. The `undefined` above is what keeps
 * the transparency constraint on both channels at once — no line, no key.
 */
export function describe(dispatch: Dispatch, file: string): string | undefined {
  switch (dispatch.kind) {
    case "current":
      return undefined;
    case "behind": {
      const { declared, current, notes } = dispatch;
      // THE LINE ROUTES, it does not merely warn. Naming the jumps (`0.1→0.2, 0.2→3`) told a reader the
      // record was old and left them to find out what that meant; naming the documents is the routing
      // the dispatch exists for, and `--handling` is the same answer for a record nobody is closing.
      const documents = notes.map((note) => path.basename(note.file)).join(", ");
      return (
        `${file}: written against ${declared.type}@${declared.version}, current is ${current.version} — ` +
        `that shape is described by ${documents} (vibe-ops records handling ${file})`
      );
    }
    case "unhandled": {
      const { declared, current, stuckAt } = dispatch;
      return (
        `${file}: written against ${declared.type}@${declared.version} and there is no handling for it — ` +
        `no migration note leaves ${declared.type}@${stuckAt} toward ${current.version}` +
        ` (expected ${declared.type}-${stuckAt}-to-<next>.md)`
      );
    }
    case "ahead":
      return (
        `${file}: declares ${dispatch.declared.type}@${dispatch.declared.version}, ahead of the template's ` +
        `${dispatch.current.version} — the tooling is behind this record, not the other way round`
      );
    case "mismatch":
      return `${file}: declares ${dispatch.declared.type}@${dispatch.declared.version} but is being handled as ${dispatch.current.type}`;
    case "unknown":
      return (
        `${file}: declares no template version — it is not assumed to be the oldest shape. ` +
        `Declare \`${dispatch.current.type}@<version>\` in its frontmatter, then run this again`
      );
    case "uncomparable":
      return `${file}: ${dispatch.reason}`;
  }
}
