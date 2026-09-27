// Which record types this repository is behind on, comparing what was PROMULGATED into it
// (`config.harness.applied`) against what the installed norm currently ships — since Plan-033 the
// activated governance packages first (ADR-0019), then a pinned tree (`harness.source`, `--source`,
// `CLAUDE_PLUGIN_ROOT`) in both its historic layouts.
//
// Moved out of the SessionStart hook (`cli/packages/cli/src/harness-status.ts`), which now calls this
// rather than carrying its own copy — the noun verb (`vibe-ops harness status`) and the hook read the
// same comparison, and a fix here reaches both instead of only the one someone remembered to edit.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { activateGovernance, templateCandidates } from "@entelekheia/vibe-ops-core";
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

/**
 * The whole `<type>@<something>` a template declares, in any spelling — so a `plan@0.1` can be REPORTED as
 * the declaration it is, while still not being handed to a comparison that only orders integers.
 */
async function tokenFromTemplate(file: string, type: string): Promise<string | undefined> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return undefined;
  }
  const match = new RegExp(`^vibe-ops-template: (${type}@\\S+)$`, "m").exec(text);
  return match?.[1];
}

/** Where this repository's own template for `type` is: what it declared, else the first candidate present. */
function localTemplatePath(repoRoot: string, type: VersionedType, config: VibeOpsConfig | undefined): string | undefined {
  const declared = config?.records?.templates?.[type as keyof NonNullable<NonNullable<VibeOpsConfig["records"]>["templates"]>];
  if (declared !== undefined) {
    const resolved = path.resolve(repoRoot, declared);
    return existsSync(resolved) ? resolved : undefined;
  }
  for (const candidate of templateCandidates(type)) {
    const resolved = path.resolve(repoRoot, candidate);
    if (existsSync(resolved)) return resolved;
  }
  return undefined;
}

/**
 * A template this comparison cannot order. Two causes, and they are reported apart because the sentence a
 * reader acts on differs: `token` absent means nothing classified the file's shape at all, while a `token`
 * present carries a declaration in the pre-integer spelling (`plan@0.1`), which is a version — just not one
 * with a successor this reader can compute. Neither is resolved to a number: that guess is wrong in both
 * directions, the same rule the `template-version-undeclared` finding follows.
 */
export interface UnorderedTemplate {
  readonly type: VersionedType;
  readonly token?: string;
}

export interface LocalVersions {
  /** The version each template on disk declares. A type with no template file is absent, not zero. */
  readonly declared: Partial<Record<VersionedType, number>>;
  /** Templates that EXIST and carry no orderable version — the population whose record check is suppressed. */
  readonly undeclared: readonly UnorderedTemplate[];
}

/**
 * What this repository's own templates declare — the GENERATOR, read off disk.
 *
 * It exists because `config.harness.applied` is a promulgation receipt, and a repository whose templates
 * were installed any other way has none: `harness status` then answered `behind: []` for a repository
 * whose generator was three versions back, which reads as clean. Measured 2026-09-26 across this
 * workspace: of six repositories reporting the empty answer, three had a drifted or unstamped generator —
 * `eita` was authoring `plan@0.1` records on 2026-09-25 against a `plan@3` norm, and the
 * `template-version` gate agreed with it, because that gate's ruler is this same local template by
 * design and it was reading `ok, 12 examined`.
 *
 * A template ABSENT stays absent, which is what keeps the precision the receipt-only comparison bought:
 * an unrelated repository with no `project/templates/` still says nothing.
 */
export async function localVersions(
  repoRoot: string,
  config: VibeOpsConfig | undefined,
): Promise<LocalVersions> {
  const declared: Partial<Record<VersionedType, number>> = {};
  const undeclared: UnorderedTemplate[] = [];
  for (const type of TYPES) {
    const file = localTemplatePath(repoRoot, type, config);
    if (file === undefined) continue;
    const version = await versionFromTemplate(file, type);
    if (version !== undefined) {
      declared[type] = version;
      continue;
    }
    undeclared.push({ type, token: await tokenFromTemplate(file, type) });
  }
  return { declared, undeclared };
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
  /**
   * Which reading `applied` came from, because the repair differs. `promulgated` is the receipt in
   * `config.harness.applied`: the records are behind and `/vibe-ops:migrate` converts them. `template` is
   * the stamp in this repository's own template file: the GENERATOR is behind, so every record it
   * produces from now on is born behind, and the template is replaced before any record is migrated.
   */
  readonly source: "promulgated" | "template";
}

/**
 * Which types are behind, from the two readings that can answer for a type: the promulgation receipt
 * first, then this repository's own template on disk.
 *
 * **A type neither reading answers for is NOT reported**, and that is what keeps precision at 1: the
 * repository has no receipt for it and no template file carrying it, so nothing here is out of date —
 * reporting it would make every unrelated repository the operator opens light up, and a signal that fires
 * everywhere is one nobody reads.
 *
 * The receipt wins where both answer, because it is the version someone agreed to; a template newer than
 * the receipt is a promulgation in flight, not a finding. Where only the template answers, it IS the
 * repository's version — see `localVersions` for the measurement that made this necessary.
 */
export function behindEntries(
  applied: Partial<Record<string, number>> | undefined,
  shipped: Partial<Record<VersionedType, number>>,
  local?: Partial<Record<VersionedType, number>>,
): readonly BehindEntry[] {
  const behind: BehindEntry[] = [];
  for (const type of TYPES) {
    const fromReceipt = applied?.[type];
    const here = fromReceipt ?? local?.[type];
    const there = shipped[type];
    if (here === undefined || there === undefined) continue;
    if (here < there) {
      behind.push({ type, applied: here, shipped: there, source: fromReceipt === undefined ? "template" : "promulgated" });
    }
  }
  return behind;
}

/**
 * The undeclared templates worth saying anything about: the ones whose type the installed norm actually
 * ships. A repository holding a `templates/plan.md` of its own invention, for a norm that ships no plan,
 * is not behind anything — and this reading runs at the start of every session in every repository the
 * operator opens, so a finding there would be the signal that fires everywhere and gets discounted.
 */
export function reportableUndeclared(
  undeclared: readonly UnorderedTemplate[],
  shipped: Partial<Record<VersionedType, number>>,
): readonly UnorderedTemplate[] {
  return undeclared.filter((entry) => shipped[entry.type] !== undefined);
}

/** The message, built here rather than inline so the test asserts the text a session actually receives. */
export function formatBehind(behind: readonly BehindEntry[], undeclared: readonly UnorderedTemplate[] = []): string {
  const lines = behind.map(
    (b) =>
      `  - ${b.type}: this repository is on ${b.type}@${b.applied}, installed is ${b.type}@${b.shipped}` +
      (b.source === "template" ? " — its own template, so new records are born behind" : ""),
  );
  const generators = behind.filter((b) => b.source === "template").map((b) => b.type);
  return [
    behind.length === 0
      ? "This repository's own governance templates carry no version this comparison can order:"
      : "A newer version of the governance templates is installed than this repository is on:",
    ...lines,
    ...undeclared.map((entry) =>
      entry.token === undefined
        ? `  - ${entry.type}: its template declares no version at all, so no record under it can be compared`
        : `  - ${entry.type}: its template declares ${entry.token}, which predates the integer stamps — no record under it can be compared`,
    ),
    "",
    ...(generators.length === 0 && undeclared.length === 0
      ? []
      : ["Replace the template before migrating any record — while the generator is stale, each new record is born stale too."]),
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
