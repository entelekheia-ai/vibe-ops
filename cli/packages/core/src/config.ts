// vibeops.config.ts resolution — repository first, then upward, ending at the user's home directory.
//
// The cascade is the same shape a linter or tsconfig uses, and it exists for the same reason: the
// per-repo file holds what is true of that repo, the home file holds the operator's own preferences,
// and neither should have to restate the other. Nearest wins per key; the search does NOT stop at the
// git root, because the home-directory file is the whole point of having a cascade at all.
//
// `.ts` is loaded by dynamic import and relies on Node's native type stripping (>=22.18), so a config
// file costs no dependency and no build step. `.js`/`.mjs` work identically.

import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { access } from "node:fs/promises";
import path from "node:path";

const FILENAMES = ["vibeops.config.ts", "vibeops.config.mjs", "vibeops.config.js"] as const;

/** The four governance record types `@entelekheia/vibe-ops-records` resolves. */
export type RecordType = "adr" | "rfc" | "plan" | "task";

/**
 * Overrides the built-in search order `@entelekheia/vibe-ops-records` uses to find a record type's
 * directory and template. Top-level rather than a `settings` slice: `plan`, `task` and `log` all read
 * through the one resolver, and a per-module slice would be three copies of the same answer.
 *
 * The built-in order is unchanged and matches every ordinary repository, so declaring this at all is
 * the exception, not the rule — this repository's own `vibeops.config.ts` is the first one to need it,
 * because its canonical templates ARE the distributable at `plugin/templates/` rather than living under
 * a `project/templates/` this repository does not have.
 */
export interface RecordsConfig {
  readonly dirs?: Partial<Record<RecordType, string>>;
  readonly templates?: Partial<Record<RecordType, string>>;
}

export interface VibeOpsConfig {
  /** Module ids to treat as enabled without an explicit flag. */
  readonly modules?: readonly string[];
  /** Per-module settings, keyed by module id. A module reads its own slice and nothing else. */
  readonly settings?: Readonly<Record<string, unknown>>;
  /** Where observations go when a module declares `emits`. Absent disables emission entirely. */
  readonly artifactDir?: string;
  /** See `RecordsConfig`. Absent means every record type resolves by search, as it always has. */
  readonly records?: RecordsConfig;
}

export interface LoadedConfig {
  readonly config: VibeOpsConfig;
  /** Every file that contributed, nearest first. Empty when nothing was found. */
  readonly sources: readonly string[];
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

/** Directories from `start` up to and including the filesystem root, plus the home directory. */
export function searchPath(start: string, home: string = homedir()): readonly string[] {
  const dirs: string[] = [];
  let current = path.resolve(start);
  for (;;) {
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (!dirs.includes(home)) dirs.push(home);
  return dirs;
}

async function loadOne(dir: string): Promise<{ file: string; config: VibeOpsConfig } | undefined> {
  for (const name of FILENAMES) {
    const candidate = path.join(dir, name);
    if (!(await exists(candidate))) continue;
    const module = (await import(pathToFileURL(candidate).href)) as { default?: VibeOpsConfig };
    if (module.default === undefined) {
      throw new Error(`${candidate} has no default export — a config file must \`export default { ... }\``);
    }
    return { file: candidate, config: module.default };
  }
  return undefined;
}

/**
 * Merge is shallow per top-level key, and one level deep for `settings` so that a repo overriding one
 * module's settings does not silently discard the home file's settings for every other module.
 */
function merge(nearer: VibeOpsConfig, further: VibeOpsConfig): VibeOpsConfig {
  const records =
    nearer.records === undefined && further.records === undefined
      ? undefined
      : {
          dirs: { ...further.records?.dirs, ...nearer.records?.dirs },
          templates: { ...further.records?.templates, ...nearer.records?.templates },
        };
  return {
    modules: nearer.modules ?? further.modules,
    artifactDir: nearer.artifactDir ?? further.artifactDir,
    settings: { ...further.settings, ...nearer.settings },
    records,
  };
}

export async function loadConfig(start: string, home: string = homedir()): Promise<LoadedConfig> {
  const sources: string[] = [];
  let config: VibeOpsConfig = {};
  for (const dir of searchPath(start, home)) {
    const found = await loadOne(dir);
    if (found === undefined) continue;
    sources.push(found.file);
    config = sources.length === 1 ? found.config : merge(config, found.config);
  }
  return { config, sources };
}

/** A module's own slice of `settings`, never the whole object. */
export function settingsFor<T = Record<string, unknown>>(config: VibeOpsConfig, id: string): T | undefined {
  return config.settings?.[id] as T | undefined;
}
