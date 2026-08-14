// vibeops.config.ts resolution — repository first, then upward, ending at the user's home directory.
//
// The cascade is the same shape a linter or tsconfig uses, and it exists for the same reason: the
// per-repo file holds what is true of that repo, the home file holds the operator's own preferences,
// and neither should have to restate the other. Nearest wins per key; the search does NOT stop at the
// git root, because the home-directory file is the whole point of having a cascade at all.
//
// TWO FILES PER DIRECTORY, LAYERED. `vibeops.config.local.*` is clone-local and version-control-ignored;
// `vibeops.config.*` is the committed one. Within a directory the local file wins per key, and BOTH
// contribute — so a committed config can ship fully populated while a clone overrides only what is true
// of that machine, which is the .env/.env.example split applied to configuration. The pair repeats at
// every level, which is what finally gives the home directory the personal-override file this module's
// consumers have been describing in prose with no mechanism behind it.
//
// The directory walk still outranks the pair: a nearer COMMITTED file beats a farther LOCAL one. Getting
// that backwards produces a plausible-looking cascade in which a stale personal file in the home
// directory silently governs every repository, and it is asserted against in this package's tests.
//
// `.ts` is loaded by dynamic import and relies on Node's native type stripping (>=22.18), so a config
// file costs no dependency and no build step. `.js`/`.mjs` work identically.

import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Candidate filenames for one directory, nearest-wins order — every local variant before every committed
 * one. Extension order within each half is a first-match tiebreak, unchanged from when there was one half:
 * a directory holding both `.ts` and `.mjs` of the same kind is a mistake, and this picks one rather than
 * merging two files that were never meant to coexist.
 */
const FILENAMES = [
  "vibeops.config.local.ts",
  "vibeops.config.local.mjs",
  "vibeops.config.local.js",
  "vibeops.config.ts",
  "vibeops.config.mjs",
  "vibeops.config.js",
] as const;

/** Where the local half of the list ends — the boundary `loadOne` splits on to take one file from each. */
const LOCAL_FILENAME_COUNT = 3;

/**
 * The one config file this tooling WRITES, as opposed to reads. Promulgation records what it applied to a
 * clone, and that has to land somewhere a program can edit without rewriting a person's file: the three
 * local variants above are all executable, and a program editing someone's TypeScript to change one key
 * is a class of bug this repository does not need.
 *
 * It is a THIRD layer, not a fourth entry in the local half, and the difference is load-bearing. Within a
 * half the first match wins, so adding it there would make a clone holding both this file and a
 * `vibeops.config.local.ts` silently lose one of them — the machine's state or the operator's overrides,
 * depending on the order chosen. Neither is acceptable, and the failure would be invisible. Layered, they
 * compose: the operator keeps declaring preferences in a file they own, this one carries only what was
 * promulgated, and it ranks nearest because it is the most specific statement about this clone.
 */
const STATE_FILENAME = "vibeops.config.local.json";

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

/**
 * Which version of each record type was PROMULGATED into this clone — not which version any given
 * artifact was written against, which is what that artifact's own `vibe-ops-template:` line says. The two
 * answer different questions and diverge exactly when something has not been migrated yet, which is the
 * case worth detecting; storing one would not give you the other.
 *
 * Belongs in `vibeops.config.local.*`: it is true of one clone on one machine, and committing it would
 * make every promulgation a diff in a file the repository owns.
 *
 * ABSENCE IS A STATE, AND IT IS NOT ZERO. No `harness` key at all means never promulgated to; a key with
 * no entry for `plan` means the same about plans specifically. Neither is "version 0", and a reader that
 * defaults them to a number reports every untouched repository as catastrophically behind — which is how a
 * signal earns being ignored.
 */
export interface HarnessConfig {
  readonly applied?: Partial<Record<RecordType | "log", number>>;
  /**
   * Which version of the ownership declaration this clone has agreed to — the boundary between what
   * promulgation may overwrite and what belongs to the repository.
   *
   * It is stored separately from `applied` because it answers a question about CONSENT rather than about
   * currency. A declaration that reclassifies a path from "written once, then yours" to "this tooling
   * overwrites it" converts something the repository owned into something it does not, and a promulgation
   * that read the newer boundary to decide what it may overwrite here would be assuming an agreement that
   * was never made. So `sync` compares this against the installed declaration and refuses only the paths
   * whose class WIDENED, leaving the rest to promulgate normally. Narrowing needs no consent: it can only
   * reduce what this tooling may do.
   *
   * Absent means never agreed to any boundary, which is the ordinary state of a clone nothing has been
   * promulgated into — not agreement to version zero.
   */
  readonly boundary?: number;
  /**
   * Where this repository's norm comes from — the root a `needsSource` module reads templates and
   * ownership declarations from. Highest-priority tier of the three the CLI resolves (declared config,
   * then `--source`, then `CLAUDE_PLUGIN_ROOT`): a repository or operator that has said so explicitly
   * outranks an invocation flag or an environment variable set by the surrounding hook wiring.
   */
  readonly source?: string;
}

export interface VibeOpsConfig {
  /** Module ids to treat as enabled without an explicit flag. */
  readonly modules?: readonly string[];
  /** See `HarnessConfig`. Written by promulgation, read by the session hook; absent until either runs. */
  readonly harness?: HarnessConfig;
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

async function loadFile(candidate: string): Promise<{ file: string; config: VibeOpsConfig } | undefined> {
  if (!(await exists(candidate))) return undefined;

  // The state file is data, so it is parsed rather than imported: no default export to demand, no code to
  // execute, and a malformed one names itself instead of failing as an opaque module error.
  if (candidate.endsWith(".json")) {
    const text = await readFile(candidate, "utf8");
    try {
      return { file: candidate, config: JSON.parse(text) as VibeOpsConfig };
    } catch (error) {
      throw new Error(`${candidate} is not valid JSON: ${(error as Error).message}`);
    }
  }

  const module = (await import(pathToFileURL(candidate).href)) as { default?: VibeOpsConfig };
  if (module.default === undefined) {
    throw new Error(`${candidate} has no default export — a config file must \`export default { ... }\``);
  }
  return { file: candidate, config: module.default };
}

/**
 * Every config file in one directory, nearest-wins order: the machine-written state file, then the
 * operator's local file, then the committed one. Returns all of them rather than the first match —
 * returning the first is what would make a nearer file REPLACE the one it is meant to layer over, which
 * is the whole point.
 */
async function loadOne(dir: string): Promise<readonly { file: string; config: VibeOpsConfig }[]> {
  const local = FILENAMES.slice(0, LOCAL_FILENAME_COUNT);
  const committed = FILENAMES.slice(LOCAL_FILENAME_COUNT);
  const found: { file: string; config: VibeOpsConfig }[] = [];
  for (const half of [[STATE_FILENAME], local, committed]) {
    for (const name of half) {
      const one = await loadFile(path.join(dir, name));
      if (one === undefined) continue;
      found.push(one);
      break;
    }
  }
  return found;
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
    // `applied` wins WHOLE, deliberately unlike `settings` and `records`: merging per record type would
    // let a map written for one repository answer for another one further down the path, and "this clone
    // is on plan@3" is a fact about a single working tree, where a half-inherited answer is worse than
    // none. The rule is about the MAP, though, not about the key it lives under — `harness` as a whole
    // used to win whole, which was the same thing while `applied` was the only entry and stopped being so
    // the moment a machine-written state file could sit nearer than the file an operator declares
    // `source` in. Whole-key would have had the state file silently discard that.
    harness:
      nearer.harness === undefined && further.harness === undefined
        ? undefined
        : {
            applied: nearer.harness?.applied ?? further.harness?.applied,
            boundary: nearer.harness?.boundary ?? further.harness?.boundary,
            source: nearer.harness?.source ?? further.harness?.source,
          },
  };
}

export async function loadConfig(start: string, home: string = homedir()): Promise<LoadedConfig> {
  const sources: string[] = [];
  let config: VibeOpsConfig = {};
  for (const dir of searchPath(start, home)) {
    for (const found of await loadOne(dir)) {
      sources.push(found.file);
      config = sources.length === 1 ? found.config : merge(config, found.config);
    }
  }
  return { config, sources };
}

/** Where a repository's machine-written harness state lives. Absolute, given the repository root. */
export function statePath(repoRoot: string): string {
  return path.join(repoRoot, STATE_FILENAME);
}

/**
 * Record what promulgation applied to this clone, touching only the keys handed in.
 *
 * The rest of the file is read and written back unchanged, so an operator can put other keys in it and a
 * later promulgation will not eat them — and, more to the point, no *other* file is touched at all. The
 * ownership declaration classes `vibeops.config.local.*` as belonging to the repository precisely so that
 * promulgation updates its own key through the module that owns it rather than rewriting a file it does
 * not own. This function is that module's half of the bargain.
 */
export async function writeHarnessState(repoRoot: string, harness: HarnessConfig): Promise<string> {
  const file = statePath(repoRoot);
  let current: VibeOpsConfig = {};
  if (await exists(file)) {
    const text = await readFile(file, "utf8");
    try {
      current = JSON.parse(text) as VibeOpsConfig;
    } catch (error) {
      // Refused rather than overwritten: the file is small and hand-editable, so a syntax error in it is
      // far likelier to be someone's work in progress than corruption worth discarding.
      throw new Error(`${file} is not valid JSON, so it will not be rewritten: ${(error as Error).message}`);
    }
  }
  const merged: VibeOpsConfig = { ...current, harness: { ...current.harness, ...harness } };
  await writeFile(file, `${JSON.stringify(merged, undefined, 2)}\n`, "utf8");
  return file;
}

/** A module's own slice of `settings`, never the whole object. */
export function settingsFor<T = Record<string, unknown>>(config: VibeOpsConfig, id: string): T | undefined {
  return config.settings?.[id] as T | undefined;
}
