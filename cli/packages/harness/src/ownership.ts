// The ownership declaration, read. It shipped with Plan-025 Track 1 and nothing consumed it until now:
// `sync` is its first reader, which is why every rule the prose states has to become a function here
// rather than a habit at the call site.
//
// Four classes, from `<sourceRoot>/ownership.json`:
//   norm   — this tooling owns it; promulgation overwrites it
//   shaped — the tooling owns the STRUCTURE, the repository owns the CONTENT, permanently (Plan-031):
//            migration may restructure per a recorded note; nothing may rewrite what is written under it
//   seed   — written once when absent, never overwritten; the repository owns it from then on
//   repo   — never written, and promulgation that would touch one stops and reports
//
// A PATH WITH NO MATCHING ENTRY IS NOT PERMISSION. Absence means the declaration has not been extended to
// cover it, and the answer is to report rather than to assume — which is why `classOf` returns undefined
// instead of defaulting, and why the `repo` class names source and test directories explicitly even
// though nothing would ever try to write them.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activateGovernance, effectiveGovernanceBindings } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export type OwnershipClass = "norm" | "shaped" | "seed" | "repo";

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
  // The order IS the semantics (Plan-031): authority strictly decreasing right to left. `shaped`
  // sits between `seed` and `norm` — more authority than write-once (migration may restructure it
  // forever), less than ownership of the whole file (its content is never this tooling's).
  const authority: Record<OwnershipClass, number> = { repo: 0, seed: 1, shaped: 2, norm: 3 };
  return authority[now] > authority[was];
}

// One level up from src/ (or dist/) — the harness package's own root, where the BASE half of the
// boundary ships. The same import.meta.url shape every data-carrying package here uses.
const HARNESS_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function maybeReadOwnership(root: string): Promise<Ownership | undefined> {
  try {
    return await readOwnership(root);
  } catch {
    return undefined;
  }
}

/**
 * The boundary composed from the packages (Plan-033): the harness's own BASE fragment — everything the
 * scaffold writes that belongs to no single artifact — plus each activated governance's fragment for
 * its artifact. `version` is the max across fragments, and the per-entry widening check downstream is
 * unchanged; finer semantics are Plan-031's subject. `undefined` when nothing contributes, which the
 * caller reports as having no norm to promulgate rather than promulgating without a boundary.
 *
 * DELIBERATELY NOT MIXED WITH A PINNED TREE. Promulgation takes one norm whole: a pinned tree that
 * carries its own ownership.json is used wholesale by the caller, never blended with fragments —
 * reading templates from one norm under another norm's permission is the exact thing this file exists
 * to prevent.
 */
export async function composedOwnership(config: VibeOpsConfig | undefined): Promise<Ownership | undefined> {
  const paths: OwnershipEntry[] = [];
  let version = 0;
  const base = await maybeReadOwnership(HARNESS_ROOT);
  if (base !== undefined) {
    version = Math.max(version, base.version);
    paths.push(...base.paths);
  }
  for (const type of Object.keys(effectiveGovernanceBindings(config))) {
    const activated = await activateGovernance(type, config);
    if (activated === undefined) continue;
    const fragment = await maybeReadOwnership(activated.root);
    if (fragment === undefined) continue;
    version = Math.max(version, fragment.version);
    paths.push(...fragment.paths);
  }
  return paths.length === 0 ? undefined : { version, paths };
}
