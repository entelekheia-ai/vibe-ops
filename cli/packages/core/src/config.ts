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

export interface VibeOpsConfig {
  /** Module ids to treat as enabled without an explicit flag. */
  readonly modules?: readonly string[];
  /** Per-module settings, keyed by module id. A module reads its own slice and nothing else. */
  readonly settings?: Readonly<Record<string, unknown>>;
  /** Where observations go when a module declares `emits`. Absent disables emission entirely. */
  readonly artifactDir?: string;
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
  return {
    modules: nearer.modules ?? further.modules,
    artifactDir: nearer.artifactDir ?? further.artifactDir,
    settings: { ...further.settings, ...nearer.settings },
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
