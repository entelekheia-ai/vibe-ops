// Which record types this repository is behind on, comparing what was PROMULGATED into it
// (`config.harness.applied`) against what the installed norm at `sourceRoot` currently ships.
//
// Moved out of the SessionStart hook (`cli/packages/cli/src/harness-status.ts`), which now calls this
// rather than carrying its own copy — the noun verb (`vibe-ops harness status`) and the hook read the
// same comparison, and a fix here reaches both instead of only the one someone remembered to edit.

import { readFile } from "node:fs/promises";
import path from "node:path";

/** The record types carrying a versioned template. `log` has one and is not a `RecordType`, hence the union. */
export const TYPES = ["adr", "rfc", "plan", "task", "log"] as const;
export type VersionedType = (typeof TYPES)[number];

/**
 * The version a shipped type ships, read from `<sourceRoot>/types/index.json` — Plan-030 Track 1. That
 * file is generated from every `types/<name>/type.json` and each template's own `vibe-ops-template: <type>@<n>`
 * frontmatter (`cli/packages/records/scripts/generate-type-index.ts`), never hand-edited, so this no
 * longer reads a template file directly. `undefined` when `sourceRoot` predates the index (an older
 * install shipping no `types/` at all), when the index has no entry for `type`, or when it declares no
 * version — a missing answer, never a guessed one, matching every other reader in this codebase.
 */
export async function shippedVersion(sourceRoot: string, type: VersionedType): Promise<number | undefined> {
  let text: string;
  try {
    text = await readFile(path.join(sourceRoot, "types", "index.json"), "utf8");
  } catch {
    return undefined;
  }
  let index: Partial<Record<string, { version?: unknown }>>;
  try {
    index = JSON.parse(text) as Partial<Record<string, { version?: unknown }>>;
  } catch {
    return undefined;
  }
  const version = index[type]?.version;
  return typeof version === "number" ? version : undefined;
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

/** Every type's shipped version, read from `sourceRoot` in one pass. Absent entries are types not shipped there. */
export async function shippedVersions(sourceRoot: string): Promise<Partial<Record<VersionedType, number>>> {
  const shipped: Partial<Record<VersionedType, number>> = {};
  for (const type of TYPES) {
    const version = await shippedVersion(sourceRoot, type);
    if (version !== undefined) shipped[type] = version;
  }
  return shipped;
}
