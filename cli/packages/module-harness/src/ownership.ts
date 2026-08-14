// The ownership declaration, read. It shipped with Plan-025 Track 1 and nothing consumed it until now:
// `sync` is its first reader, which is why every rule the prose states has to become a function here
// rather than a habit at the call site.
//
// Three classes, from `<sourceRoot>/ownership.json`:
//   norm — this tooling owns it; promulgation overwrites it
//   seed — written once when absent, never overwritten; the repository owns it from then on
//   repo — never written, and promulgation that would touch one stops and reports
//
// A PATH WITH NO MATCHING ENTRY IS NOT PERMISSION. Absence means the declaration has not been extended to
// cover it, and the answer is to report rather than to assume — which is why `classOf` returns undefined
// instead of defaulting, and why the `repo` class names source and test directories explicitly even
// though nothing would ever try to write them.

import { readFile } from "node:fs/promises";
import path from "node:path";

export type OwnershipClass = "norm" | "seed" | "repo";

export interface OwnershipEntry {
  readonly match: string;
  readonly class: OwnershipClass;
  readonly why: string;
}

export interface Ownership {
  readonly version: number;
  readonly paths: readonly OwnershipEntry[];
}

/** Where the declaration lives inside an installed norm. */
export function ownershipPath(sourceRoot: string): string {
  return path.join(sourceRoot, "ownership.json");
}

export async function readOwnership(sourceRoot: string): Promise<Ownership> {
  const file = ownershipPath(sourceRoot);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new Error(`no ownership declaration at ${file} — promulgation has no boundary to respect and will not run`);
  }
  const parsed = JSON.parse(text) as Partial<Ownership>;
  if (typeof parsed.version !== "number" || !Array.isArray(parsed.paths)) {
    throw new Error(`${file} declares no version or no paths — it cannot be used as a boundary`);
  }
  return { version: parsed.version, paths: parsed.paths };
}

/**
 * The class declared for a repository-relative path, or `undefined` when nothing matches.
 *
 * Last match wins, so a later, more specific entry can narrow an earlier broad one — the file is ordered
 * norm, then seed, then repo, and `repo` being last is what makes it able to carve an exception out of a
 * directory an earlier entry claimed. `path.matchesGlob` is native, so this costs no dependency; every
 * pattern form the shipped declaration uses — brace alternation, `**`, `*`, a character class — was
 * verified against it on 2026-08-14.
 */
export function classOf(ownership: Ownership, file: string): OwnershipClass | undefined {
  let found: OwnershipClass | undefined;
  for (const entry of ownership.paths) {
    if (path.matchesGlob(file, entry.match)) found = entry.class;
  }
  return found;
}

/** The entry that decided a path's class — for a report that has to say WHY, not only what. */
export function entryFor(ownership: Ownership, file: string): OwnershipEntry | undefined {
  let found: OwnershipEntry | undefined;
  for (const entry of ownership.paths) {
    if (path.matchesGlob(file, entry.match)) found = entry;
  }
  return found;
}

/**
 * Whether moving a path from `was` to `now` gives this tooling authority it did not have.
 *
 * Only widening needs consent, and the asymmetry is the whole design. `seed → norm` converts a file the
 * repository owned into one promulgation overwrites; `repo → anything` converts a file it was never to
 * touch into one it may write. Every other move reduces what this tooling may do and can be applied
 * silently — refusing those too would block a repository on a declaration change that made it safer,
 * which is how a gate gets switched off in its first week.
 *
 * A path that gains an entry where it had none is NOT a widening: absence was never permission, so
 * nothing is being taken away from the repository by naming it.
 */
export function widens(was: OwnershipClass | undefined, now: OwnershipClass | undefined): boolean {
  if (was === undefined || now === undefined) return false;
  const authority: Record<OwnershipClass, number> = { repo: 0, seed: 1, norm: 2 };
  return authority[now] > authority[was];
}
