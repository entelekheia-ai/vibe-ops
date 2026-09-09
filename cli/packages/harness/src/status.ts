// Which record types this repository is behind on, comparing what was PROMULGATED into it
// (`config.harness.applied`) against what the installed norm currently ships — since Plan-033 the
// activated governance packages first (ADR-0019), then a pinned tree (`harness.source`, `--source`,
// `CLAUDE_PLUGIN_ROOT`) in both its historic layouts.
//
// Moved out of the SessionStart hook (`cli/packages/cli/src/harness-status.ts`), which now calls this
// rather than carrying its own copy — the noun verb (`vibe-ops harness status`) and the hook read the
// same comparison, and a fix here reaches both instead of only the one someone remembered to edit.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { activateGovernance } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

/** The record types carrying a versioned template. `log` has one and is not a `RecordType`, hence the union. */
export const TYPES = ["adr", "rfc", "plan", "task", "log"] as const;
export type VersionedType = (typeof TYPES)[number];

/** The `vibe-ops-template: <type>@<n>` a template file declares, or nothing — never a guess. */
async function versionFromTemplate(file: string, type: string): Promise<number | undefined> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return undefined;
  }
  const match = new RegExp(`^vibe-ops-template: ${type}@(\\d+)$`, "m").exec(text);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

async function pinnedVersion(sourceRoot: string, type: VersionedType): Promise<number | undefined> {
  try {
    const text = await readFile(path.join(sourceRoot, "types", "index.json"), "utf8");
    const index = JSON.parse(text) as Partial<Record<string, { version?: unknown }>>;
    const version = index[type]?.version;
    if (typeof version === "number") return version;
  } catch {
    // No index — the oldest layout; fall through to the template itself.
  }
  return versionFromTemplate(path.join(sourceRoot, "templates", `${type}.md`), type);
}

async function packageVersion(type: VersionedType, config: VibeOpsConfig | undefined): Promise<number | undefined> {
  const activated = await activateGovernance(type, config);
  // A policy-only package (`base`) activates with no template — nothing versioned to compare here.
  if (activated === undefined || activated.unit.template === undefined) return undefined;
  return versionFromTemplate(path.resolve(activated.root, activated.unit.template), type);
}

/**
 * The version a shipped type ships. **A resolved pinned tree answers first**: `sourceRoot` exists only
 * because someone declared it (or the plugin harness provided it), and a declaration that lost to the
 * bundled default would be a declaration that does nothing. The activated governance package (ADR-0019)
 * answers for everything the pin does not cover — including the pin's own newer layout gaps, and the
 * npm-only install where there is no pin at all. `undefined` when nothing answers — a missing answer,
 * never a guessed one, matching every other reader here.
 */
export async function shippedVersion(
  type: VersionedType,
  config: VibeOpsConfig | undefined,
  sourceRoot: string | undefined,
): Promise<number | undefined> {
  if (sourceRoot !== undefined) {
    const pinned = await pinnedVersion(sourceRoot, type);
    if (pinned !== undefined) return pinned;
  }
  return packageVersion(type, config);
}

/** One norm, whole — the pinned tree alone. What `sync` stamps when a pin is being promulgated. */
export async function shippedVersionsFromPinned(sourceRoot: string): Promise<Partial<Record<VersionedType, number>>> {
  const shipped: Partial<Record<VersionedType, number>> = {};
  for (const type of TYPES) {
    const version = await pinnedVersion(sourceRoot, type);
    if (version !== undefined) shipped[type] = version;
  }
  return shipped;
}

/** One norm, whole — the activated packages alone. What `sync` stamps when they are the norm. */
export async function shippedVersionsFromPackages(
  config: VibeOpsConfig | undefined,
): Promise<Partial<Record<VersionedType, number>>> {
  const shipped: Partial<Record<VersionedType, number>> = {};
  for (const type of TYPES) {
    const version = await packageVersion(type, config);
    if (version !== undefined) shipped[type] = version;
  }
  return shipped;
}

export interface BehindEntry {
  readonly type: VersionedType;
  readonly applied: number;
  readonly shipped: number;
}

/**
 * Which types are behind. A type absent from `applied` is NOT reported: absence means this clone has never
 * been promulgated to for that type, which is a different state from being on an old version and is not
 * this hook's news — reporting it would make every unrelated repository the operator opens light up, and a
 * signal that fires everywhere is one nobody reads. Comparing only what someone actually promulgated keeps
 * precision at 1 by construction.
 */
export function behindEntries(
  applied: Partial<Record<string, number>> | undefined,
  shipped: Partial<Record<VersionedType, number>>,
): readonly BehindEntry[] {
  if (applied === undefined) return [];
  const behind: BehindEntry[] = [];
  for (const type of TYPES) {
    const here = applied[type];
    const there = shipped[type];
    if (here === undefined || there === undefined) continue;
    if (here < there) behind.push({ type, applied: here, shipped: there });
  }
  return behind;
}

/** The message, built here rather than inline so the test asserts the text a session actually receives. */
export function formatBehind(behind: readonly BehindEntry[]): string {
  const lines = behind.map((b) => `  - ${b.type}: this repository is on ${b.type}@${b.applied}, installed is ${b.type}@${b.shipped}`);
  return [
    "A newer version of the governance templates is installed than was promulgated into this repository:",
    ...lines,
    "",
    "Run /vibe-ops:migrate to bring existing records up to the current template, one recorded jump at a time.",
    "Nothing has been changed — this is a reading, not a repair.",
  ].join("\n");
}

/** Every type's shipped version in one pass. Absent entries are types nothing ships. */
export async function shippedVersions(
  config: VibeOpsConfig | undefined,
  sourceRoot: string | undefined,
): Promise<Partial<Record<VersionedType, number>>> {
  const shipped: Partial<Record<VersionedType, number>> = {};
  for (const type of TYPES) {
    const version = await shippedVersion(type, config, sourceRoot);
    if (version !== undefined) shipped[type] = version;
  }
  return shipped;
}
