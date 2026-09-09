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

/** An entry with the fragment it came from — `harness` (the base), a package name, or `repository`. */
export interface ComposedEntry extends OwnershipEntry {
  readonly origin: string;
}

/** One match claimed by two or more fragments that disagree. Peers, never precedence. */
export interface DoubleClaim {
  readonly match: string;
  readonly claimants: readonly { readonly origin: string; readonly class: OwnershipClass }[];
}

/** A repository narrowing the composition could not apply, and exactly why. */
export interface RefusedNarrowing {
  readonly match: string;
  readonly why: string;
}

export interface ComposedBoundary extends Ownership {
  readonly paths: readonly ComposedEntry[];
  /** Doubly-claimed matches no repository entry resolved — a finding for every reader of this boundary. */
  readonly conflicts: readonly DoubleClaim[];
  /** Narrowings refused — a widening, a class the vocabulary lacks, or a missing reason. */
  readonly refusedNarrowings: readonly RefusedNarrowing[];
}

const CLASSES: ReadonlySet<string> = new Set(["norm", "shaped", "seed", "repo"]);
const AUTHORITY: Record<OwnershipClass, number> = { repo: 0, seed: 1, shaped: 2, norm: 3 };

/**
 * The boundary composed from the packages (Plan-033), with Plan-031's semantics: the harness's own
 * BASE fragment plus each activated governance's fragment, **origin kept per entry**, identical
 * matches that disagree reported as conflicts, and the repository's own hand-written narrowings
 * (`config.ownership`) applied as the LAST layer — refused, naming the fragment, when one would widen.
 * `version` is the max across fragments. `undefined` when nothing contributes, which the caller
 * reports as having no norm to promulgate rather than promulgating without a boundary.
 *
 * Fragments are PEERS: nothing here ranks one package over another. A conflict is resolved only by the
 * repository's entry on that exact match — which counts as resolution, not widening, up to the highest
 * authority any claimant declared. Overlapping-but-unequal globs are deliberately not compared
 * (RFC-0003 defers them until a real overlap exists); identical matches cover the case that exists.
 *
 * DELIBERATELY NOT MIXED WITH A PINNED TREE. Promulgation takes one norm whole: a pinned tree that
 * carries its own ownership.json is used wholesale by the caller, never blended with fragments —
 * reading templates from one norm under another norm's permission is the exact thing this file exists
 * to prevent.
 */
export async function composedOwnership(config: VibeOpsConfig | undefined): Promise<ComposedBoundary | undefined> {
  const paths: ComposedEntry[] = [];
  let version = 0;
  const base = await maybeReadOwnership(HARNESS_ROOT);
  if (base !== undefined) {
    version = Math.max(version, base.version);
    paths.push(...base.paths.map((entry) => ({ ...entry, origin: "harness" })));
  }
  const bindings = effectiveGovernanceBindings(config);
  // ONE FRAGMENT PER PACKAGE, NOT PER BOUND TYPE. A fragment belongs to a package; this loop walks type
  // NAMES, and a package shipping several units (ADR-0020) is named by each of them — so binding both
  // `log` and `learning` pushed `governance-knowledge`'s whole fragment twice. It read as harmless
  // because a duplicate is identical match plus identical class, which the conflict check below treats
  // as peers agreeing; what it actually produces is every entry of that package counted twice in the
  // composed boundary and in everything reported from it.
  const seenPackages = new Set<string>();
  for (const type of Object.keys(bindings)) {
    const packageName = bindings[type]!.packageName;
    if (seenPackages.has(packageName)) continue;
    const activated = await activateGovernance(type, config);
    if (activated === undefined) continue;
    const fragment = await maybeReadOwnership(activated.root);
    seenPackages.add(packageName);
    if (fragment === undefined) continue;
    version = Math.max(version, fragment.version);
    paths.push(...fragment.paths.map((entry) => ({ ...entry, origin: packageName })));
  }
  if (paths.length === 0) return undefined;

  // Identical matches from different origins that disagree on class. Same match, same class is
  // harmless agreement between peers and is not a finding.
  const byMatch = new Map<string, ComposedEntry[]>();
  for (const entry of paths) {
    const claim = byMatch.get(entry.match) ?? [];
    claim.push(entry);
    byMatch.set(entry.match, claim);
  }
  const contested = [...byMatch.entries()].filter(
    ([, claims]) => new Set(claims.map((c) => c.class)).size > 1,
  );

  // The repository's layer, last. Refusals name what stopped each entry; an applied entry lands after
  // every fragment entry, so last-match-wins makes it the answer for its match.
  const refusedNarrowings: RefusedNarrowing[] = [];
  const resolvedMatches = new Set<string>();
  for (const narrowing of config?.ownership ?? []) {
    if (!CLASSES.has(narrowing.class)) {
      refusedNarrowings.push({ match: narrowing.match, why: `"${narrowing.class}" is not a class this vocabulary has` });
      continue;
    }
    if (typeof narrowing.reason !== "string" || narrowing.reason.trim() === "") {
      refusedNarrowings.push({ match: narrowing.match, why: "a reclassification without a reason is refused — it is a ledger entry" });
      continue;
    }
    const now = narrowing.class as OwnershipClass;
    const claims = byMatch.get(narrowing.match) ?? [];
    const widest = claims.reduce<ComposedEntry | undefined>(
      (best, claim) => (best === undefined || AUTHORITY[claim.class] > AUTHORITY[best.class] ? claim : best),
      undefined,
    );
    if (widest !== undefined && AUTHORITY[now] > AUTHORITY[widest.class]) {
      refusedNarrowings.push({
        match: narrowing.match,
        why: `"${now}" would widen past "${widest.class}", which ${widest.origin} declared — only that fragment may grant more authority`,
      });
      continue;
    }
    paths.push({ match: narrowing.match, class: now, why: narrowing.reason, origin: "repository" });
    resolvedMatches.add(narrowing.match);
  }

  const conflicts: DoubleClaim[] = contested
    .filter(([match]) => !resolvedMatches.has(match))
    .map(([match, claims]) => ({
      match,
      claimants: claims.map((claim) => ({ origin: claim.origin, class: claim.class })),
    }));

  return { version, paths, conflicts, refusedNarrowings };
}
