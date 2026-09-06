// vibeops.config.* resolution — repository first, then upward, ending at the user's home directory.
//
// The cascade is the same shape a linter or tsconfig uses, and it exists for the same reason: the
// per-repo file holds what is true of that repo, the home file holds the operator's own preferences,
// and neither should have to restate the other. Nearest wins per key; the search does NOT stop at the
// git root, because the home-directory file is the whole point of having a cascade at all.
//
// THREE LAYERS PER DIRECTORY (RFC-0004 §1), named `local`, `declared`, `managed` — in that precedence
// order, nearest first. `vibeops.config.local.*` is clone-local and version-control-ignored, written by
// the operator; `vibeops.config.*` is committed, written by a person by hand; `vibeops.config.json` is
// committed too, but written only by this tooling — it is DATA, parsed rather than imported, and it is a
// THIRD half of `loadOne`, never a fourth name in the committed half, because within a half the first
// match wins and a directory holding both `vibeops.config.ts` and `vibeops.config.json` would otherwise
// silently drop one of them. Unlike the other two, `managed` is read only at the nearest ancestor holding
// a `.git` entry (§2) — a `vibeops.config.json` found anywhere else in the walk is reported in `leave`
// and never read, because a machine-written file governing every repository under `$HOME` would be an
// accident nobody can see.
//
// The directory walk still outranks the layer: a nearer `local`/`declared` beats a farther `managed`, and
// a nearer `managed` beats a farther `declared`, home included. Getting the directory/layer priority
// backwards produces a plausible-looking cascade in which a stale personal file in the home directory
// silently governs every repository, and it is asserted against in this package's tests.
//
// `.ts` is loaded by dynamic import and relies on Node's native type stripping (>=22.18), so a config
// file costs no dependency and no build step. `.js`/`.mjs` work identically.

import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Candidate filenames for one directory, nearest-wins order — every local variant before every declared
 * one. Extension order within each half is a first-match tiebreak, unchanged from when there was one
 * half: a directory holding both `.ts` and `.mjs` of the same kind is a mistake, and this picks one
 * rather than merging two files that were never meant to coexist.
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
 * The `managed` layer (RFC-0004 §1) — the one config file this tooling WRITES, as opposed to reads.
 * Promulgation records what it applied to a clone, and that has to land somewhere a program can edit
 * without rewriting a person's file: `local` and `declared` are executable, and a program editing
 * someone's TypeScript to change one key is a class of bug this repository does not need.
 *
 * Read only at the nearest ancestor of the search's start directory that holds a `.git` entry (§2) — see
 * `findGitToplevel`. `writeManagedConfig` is the only writer.
 */
export const MANAGED_FILENAME = "vibeops.config.json";

/**
 * The RETIRED state layer (RFC-0004 §1, ADR-0015 amended). Never read by the cascade: a file by this name
 * at the repository toplevel is reported in `leave` so every reader can name it, and `harness sync` is the
 * one thing that still opens it — once, to seed `harness.applied` from it and then empty and delete it
 * (§6 step 7). Exported for that reader alone.
 */
export const STATE_FILENAME = "vibeops.config.local.json";

/**
 * A record type, by name. **An open name, not a union** (Plan-029 Track 1): a repository may keep an
 * artifact this tooling does not ship, and a package may contribute one, so `records: { dirs: { policy:
 * … } }` has to type-check. It did not — the closed union of four literals was the single compile-time
 * wall, and RFC-0003's whole model stops at it.
 *
 * PLAIN `string`, NOT A BRANDED ONE, and that is a decision rather than a shortcut. A brand protects
 * against passing an arbitrary string where a domain value belongs; here an arbitrary string IS a valid
 * type name, and every name arrives from outside the type system anyway — a config key, a directory
 * name, a frontmatter stamp, a package's declaration. Branding would put a cast at every one of those
 * boundaries and buy nothing back.
 *
 * The alias keeps its name so the signatures that read `RecordType` still say what they mean. The four
 * this tooling ships are no longer the definition of what a type CAN be; they are the defaults
 * `@entelekheia/governance-base` consults for those four names, with a generic convention answering for
 * every other (`recordDirCandidates`/`templateCandidates` in `files.ts`).
 */
export type RecordType = string;

/**
 * Overrides the built-in search order `@entelekheia/governance-base` uses to find a record type's
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
 * Which installed package governs a type name, declared ONLY where the scan alone is ambiguous — the
 * same doctrine as `records.dirs`, which an ordinary repository never writes either.
 *
 * Keyed by the LOCAL short name, and that is the point rather than a convenience. A fully qualified name
 * in every stamp would let two packages each manage "their own" `policy` in one repository without
 * either being detectably wrong, which is the governance failure the binding exists to prevent. One
 * short name admits one owner, and changing owner is a line somebody edits in review.
 *
 * The value is the governing package's name. A binding that resolves to nothing is USED ANYWAY: the
 * caller examines zero files against the name the repository chose, which is visible and attributable,
 * where quietly falling back to another claimant is neither.
 */
export interface TypesConfig {
  readonly [localName: string]: string;
}

/**
 * Which version of each record type was PROMULGATED into this clone — not which version any given
 * artifact was written against, which is what that artifact's own `vibe-ops-template:` line says. The two
 * answer different questions and diverge exactly when something has not been migrated yet, which is the
 * case worth detecting; storing one would not give you the other.
 *
 * `applied` and `boundary` come from the `managed` layer alone (RFC-0004 §3) — see the comment on
 * `merge`'s `harness` case for how that is enforced without a fourth merge rule. A `local` or `declared`
 * file holding either key is not consulted, even though nothing here stops a person from writing one.
 *
 * ABSENCE IS A STATE, AND IT IS NOT ZERO. No `harness` key at all means never promulgated to; a key with
 * no entry for `plan` means the same about plans specifically. Neither is "version 0", and a reader that
 * defaults them to a number reports every untouched repository as catastrophically behind — which is how a
 * signal earns being ignored.
 */
export interface HarnessConfig {
  readonly applied?: Partial<Record<RecordType, number>>;
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
   * The classes the repository consented to, one entry per norm file promulgation has written here —
   * `{ "<repository-relative path>": "<class>" }`, recorded by `harness sync` in the same commit as the
   * files it describes. A receipt, never a decision: it changes no effective class (that is `ownership`),
   * it is only what `boundaryRefusals` compares the installed declaration against, so that a bump that
   * widens a path this tooling writes stops on that path and a bump that widens nothing promulgates.
   * `class` is a string here because core does not know the vocabulary. `managed`-only, like `applied`.
   */
  readonly agreed?: Readonly<Record<string, string>>;
  /**
   * Where this repository's norm comes from — the root a `needsSource` module reads templates and
   * ownership declarations from. Highest-priority tier of the three the CLI resolves (declared config,
   * then `--source`, then `CLAUDE_PLUGIN_ROOT`): a repository or operator that has said so explicitly
   * outranks an invocation flag or an environment variable set by the surrounding hook wiring.
   *
   * Unlike `applied`/`boundary`, `source` stays hand-written and unwritable, and folds through the
   * ordinary `local`/`declared`/`managed` cascade like any other key — it is not restricted to `managed`.
   */
  readonly source?: string;
}

/**
 * One reclassification of a path in the composed ownership boundary (Plan-031) — always toward LESS
 * tooling authority, applied as the composition's last layer. `class` is a string here because core does
 * not know the class vocabulary (the harness owns it and validates on composition); `reason` is required
 * by that validation — a bare class is refused, a reclassification is a ledger entry.
 *
 * Written by a person in a `declared` file, or by this tooling in the `managed` layer through
 * `writeManagedConfig` (RFC-0004 §4). `origin` distinguishes the two: absent on a freshly parsed file,
 * populated as `<layer>:<file>` once `loadConfig` has merged it, so a consumer such as
 * `composedOwnership` can report where a narrowing came from without re-deriving it.
 */
export interface OwnershipNarrowing {
  readonly match: string;
  readonly class: string;
  readonly reason: string;
  /** Set by `loadConfig`; a raw per-file declaration never carries this. See the type doc above. */
  readonly origin?: string;
}

export interface VibeOpsConfig {
  /** Which package governs a type name, where the scan alone cannot say. See `TypesConfig`. */
  readonly types?: TypesConfig;
  /** The repository's own layer of the ownership boundary. See `OwnershipNarrowing`. */
  readonly ownership?: readonly OwnershipNarrowing[];
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

/** The three named layers a config file can belong to (RFC-0004 §1), nearest-wins in this order. */
export type ConfigLayer = "local" | "declared" | "managed";

export interface LoadedConfig {
  readonly config: VibeOpsConfig;
  /** Every file that contributed, nearest first. Empty when nothing was found. */
  readonly sources: readonly string[];
  /** Which layer each entry in `sources` belongs to — a `check-global.ts`-style caller narrows on this
   *  rather than pattern-matching a filename. Same order as `sources`, same length. */
  readonly layers: readonly { readonly file: string; readonly layer: ConfigLayer }[];
  /** A file present but outside the target state — the convergence policy's `leave` verb applied to a
   *  file rather than a key: a `managed` file found off the repository toplevel. Never read. */
  readonly leave: readonly { readonly file: string; readonly reason: string }[];
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

/** Directories from `start` up to and including the filesystem root — no home directory appended. */
function ancestorsOf(start: string): string[] {
  const dirs: string[] = [];
  let current = path.resolve(start);
  for (;;) {
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

/** Directories from `start` up to and including the filesystem root, plus the home directory. */
export function searchPath(start: string, home: string = homedir()): readonly string[] {
  const dirs = ancestorsOf(start);
  if (!dirs.includes(home)) dirs.push(home);
  return dirs;
}

/**
 * The nearest ancestor of `start`, inclusive, holding a `.git` entry — directory or file, because a
 * linked worktree and a submodule both use a file (RFC-0004 §2). A filesystem probe, no git shell-out.
 * Walks only the ancestor chain of `start`; the home directory is never consulted here even when it
 * holds its own `.git` — the toplevel answers "what repository is `start` inside", not "does home have
 * one too".
 */
async function findGitToplevel(start: string): Promise<string | undefined> {
  for (const dir of ancestorsOf(start)) {
    if (await exists(path.join(dir, ".git"))) return dir;
  }
  return undefined;
}

async function loadFile(candidate: string): Promise<{ file: string; config: VibeOpsConfig } | undefined> {
  if (!(await exists(candidate))) return undefined;

  // A `.json` file is data, so it is parsed rather than imported: no default export to demand, no code to
  // execute, and a malformed one names itself instead of failing as an opaque module error. Both the
  // managed layer and the legacy state file are `.json`.
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

/** `origin` is set on every ownership entry a `local`/`declared`/`managed` file contributes, never on a
 *  legacy-state one — the legacy file is not one of the three named layers (RFC-0004 §3). */
function tagOwnershipOrigin(config: VibeOpsConfig, layer: ConfigLayer, file: string): VibeOpsConfig {
  if (config.ownership === undefined) return config;
  const origin = `${layer}:${file}`;
  return { ...config, ownership: config.ownership.map((entry) => ({ ...entry, origin })) };
}

/**
 * `harness.applied`/`harness.boundary`/`harness.agreed` are `managed`-only (RFC-0004 §3): a `local` or
 * `declared` file holding any of them must not reach the general merge, or `merge`'s existing "nearer wins whole" rule
 * would let it win over a farther `managed` file, which is exactly the arbitration this RFC ends. Strip
 * happens here, at load time, so `merge` itself needs no third argument telling it which layer it is
 * looking at — it just sees `harness.applied`/`boundary` as always absent from a non-managed contribution.
 * `harness.source` is untouched: it is not restricted to `managed`.
 */
function withoutManagedOnlyHarnessFields(config: VibeOpsConfig): VibeOpsConfig {
  if (config.harness === undefined) return config;
  const { source } = config.harness;
  return { ...config, harness: source === undefined ? undefined : { source } };
}

interface FoundEntry {
  readonly file: string;
  readonly layer: ConfigLayer;
  readonly config: VibeOpsConfig;
}

/**
 * Every config file in one directory that is eligible to be read, nearest-wins order: the operator's
 * `local` file, then the committed `declared` one, then — only when `dir` is the git toplevel — the
 * `managed` one. A `managed` file found in a directory that is not the toplevel is reported in `leave`
 * and never read (RFC-0004 §2). Returns every match rather than the first per half — returning the first
 * is what would make a nearer file REPLACE the one it is meant to layer over, which is the whole point.
 *
 * The legacy state file is handled by the caller, not here: it is not one of the three named layers, and
 * folding it into this function's return shape would make it look like a fourth one.
 */
async function loadOne(
  dir: string,
  isGitToplevel: boolean,
): Promise<{ found: readonly FoundEntry[]; leave: readonly { file: string; reason: string }[] }> {
  const found: FoundEntry[] = [];
  const leave: { file: string; reason: string }[] = [];

  for (const name of FILENAMES.slice(0, LOCAL_FILENAME_COUNT)) {
    const one = await loadFile(path.join(dir, name));
    if (one !== undefined) {
      found.push({ file: one.file, layer: "local", config: tagOwnershipOrigin(one.config, "local", one.file) });
      break;
    }
  }
  for (const name of FILENAMES.slice(LOCAL_FILENAME_COUNT)) {
    const one = await loadFile(path.join(dir, name));
    if (one !== undefined) {
      found.push({ file: one.file, layer: "declared", config: tagOwnershipOrigin(one.config, "declared", one.file) });
      break;
    }
  }

  const managed = await loadFile(path.join(dir, MANAGED_FILENAME));
  if (managed !== undefined) {
    if (isGitToplevel) {
      found.push({ file: managed.file, layer: "managed", config: tagOwnershipOrigin(managed.config, "managed", managed.file) });
    } else {
      leave.push({ file: managed.file, reason: "vibeops.config.json is read only at the repository toplevel" });
    }
  }

  return { found, leave };
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
    // Per key, like `records.dirs` rather than whole like `harness.applied`: two bindings naming two
    // different types are independent facts, so a home file binding one must not be discarded by a repo
    // binding another. Whole-key would make the nearer file's silence about a type an answer.
    types:
      nearer.types === undefined && further.types === undefined ? undefined : { ...further.types, ...nearer.types },
    // Concatenated, further first: narrowings are last-match-wins inside the composition, so the nearer
    // file's entry lands later and prevails over a home-directory one for the same match. Each entry
    // already carries its `<layer>:<file>` origin (`tagOwnershipOrigin`, applied before this function
    // ever sees it), so concatenation is enough to keep it — merge does not need to know layers or files.
    ownership:
      nearer.ownership === undefined && further.ownership === undefined
        ? undefined
        : [...(further.ownership ?? []), ...(nearer.ownership ?? [])],
    // `applied`/`boundary` win WHOLE, deliberately unlike `settings` and `records`: merging per record
    // type would let a map written for one repository answer for another one further down the path, and
    // "this clone is on plan@3" is a fact about a single working tree, where a half-inherited answer is
    // worse than none. They read as `managed`-only (RFC-0004 §3) not because this function treats
    // `managed` specially — it does not, and cannot, since it only ever sees two already-merged
    // `VibeOpsConfig` values with no layer attached — but because `withoutManagedOnlyHarnessFields` has
    // already stripped both keys from every `local`/`declared` contribution before it reaches here. The
    // whole-key rule this function applies is exactly the rule described when `applied` was the only
    // entry and the file that carried it was clone-local state rather than a committed layer; what moved
    // is which files are still in the running by the time this runs, not the arithmetic here.
    harness:
      nearer.harness === undefined && further.harness === undefined
        ? undefined
        : {
            applied: nearer.harness?.applied ?? further.harness?.applied,
            boundary: nearer.harness?.boundary ?? further.harness?.boundary,
            agreed: nearer.harness?.agreed ?? further.harness?.agreed,
            source: nearer.harness?.source ?? further.harness?.source,
          },
  };
}

export async function loadConfig(start: string, home: string = homedir()): Promise<LoadedConfig> {
  const toplevel = await findGitToplevel(start);
  const sources: string[] = [];
  const layers: { file: string; layer: ConfigLayer }[] = [];
  const leave: { file: string; reason: string }[] = [];
  let config: VibeOpsConfig = {};
  let seeded = false;

  for (const dir of searchPath(start, home)) {
    const { found, leave: dirLeave } = await loadOne(dir, dir === toplevel);
    leave.push(...dirLeave);

    // The retired state layer is never read (RFC-0004 §1): named in `leave` at the toplevel, the one place
    // it was ever written, so a reader can say what the file is and `harness sync` can retire it.
    if (dir === toplevel && (await exists(path.join(dir, STATE_FILENAME)))) {
      leave.push({
        file: path.join(dir, STATE_FILENAME),
        reason: "vibeops.config.local.json is the retired state layer — never read; the next harness sync moves its map into vibeops.config.json and deletes it",
      });
    }

    for (const entry of found) {
      sources.push(entry.file);
      layers.push({ file: entry.file, layer: entry.layer });
      const contribution = entry.layer === "managed" ? entry.config : withoutManagedOnlyHarnessFields(entry.config);
      config = seeded ? merge(config, contribution) : contribution;
      seeded = true;
    }
  }

  return { config, sources, layers, leave };
}

/** A module's own slice of `settings`, never the whole object. */
export function settingsFor<T = Record<string, unknown>>(config: VibeOpsConfig, id: string): T | undefined {
  return config.settings?.[id] as T | undefined;
}

/**
 * Loads exactly one layer file by its full path, reusing the same JSON-vs-import logic `loadOne` applies
 * per candidate — for a caller that already knows which file it wants (`config list --show-origin`
 * attributing an effective key to the file behind it) rather than the merged cascade `loadConfig` returns.
 * `undefined` when the file does not exist; throws the same way `loadFile` does on unparseable JSON or a
 * `.ts`/`.mjs`/`.js` file with no default export.
 */
export async function loadLayerFile(file: string): Promise<VibeOpsConfig | undefined> {
  const found = await loadFile(file);
  return found?.config;
}

// ---------------------------------------------------------------------------------------------------------
// The managed layer's writer (RFC-0004 §4).
// ---------------------------------------------------------------------------------------------------------

/** The writable key set is closed: `types`, `ownership`, `harness.applied`, `harness.boundary`,
 *  `harness.agreed`. Nothing else — `harness.source` stays hand-written and unwritable, like every other
 *  `VibeOpsConfig` key. */
export interface ManagedConfigPatch {
  readonly types?: TypesConfig;
  readonly ownership?: readonly OwnershipNarrowing[];
  readonly harness?: Pick<HarnessConfig, "applied" | "boundary" | "agreed">;
}

export interface WriteManagedConfigOptions {
  /** Dotted key paths to delete after `patch` merges — `"types.plan"`, `"harness.applied"`,
   *  `"harness.boundary"`. A spread cannot express deletion, and the Track-4 migration needs it. */
  readonly remove?: readonly string[];
}

/** One line per RFC-0004 §4: `R1` shadowed by the toplevel's own `declared` file; `R2` the on-disk managed
 *  file is not valid JSON; `R3` `dir` is not a repository; `R4` a key outside the closed writable set;
 *  `R5` a `types` name already bound, in `managed`, to a different package. */
export type ManagedWriteRefusal = "R1" | "R2" | "R3" | "R4" | "R5";

export type WriteManagedConfigResult =
  | {
      readonly ok: true;
      readonly file: string;
      /** One entry per other layer that still holds a key this write just touched — the toplevel's own
       *  `local` file is the only one that can, since `declared` was already checked by R1 and nothing
       *  farther out-ranks a toplevel `managed` file (RFC-0004 §3: "a nearer managed beats a farther
       *  declared, home included"). Empty when nothing shadows the write. */
      readonly shadowedBy: readonly { readonly layer: ConfigLayer; readonly file: string }[];
    }
  | {
      readonly ok: false;
      readonly refusal: ManagedWriteRefusal;
      /** Names the file, or the two packages for R5, per RFC-0004 §4. */
      readonly message: string;
    };

function isWritablePath(segments: readonly string[]): boolean {
  const [top, second] = segments;
  if (top === "types") return segments.length === 1 || segments.length === 2;
  if (top === "ownership") return segments.length === 1;
  if (top === "harness") return segments.length === 2 && (second === "applied" || second === "boundary" || second === "agreed");
  return false;
}

/** Flattens a patch object's keys into the same `["harness","applied"]`-shaped segments `isWritablePath`
 *  and the `remove` list use, so both are validated the same way regardless of how a caller built them
 *  (a well-typed `ManagedConfigPatch`, or a loosely-typed object from an untyped caller). */
function collectPatchPaths(patch: Record<string, unknown>): string[][] {
  const paths: string[][] = [];
  for (const [key, value] of Object.entries(patch)) {
    if ((key === "harness" || key === "types") && value !== null && typeof value === "object") {
      const sub = Object.keys(value as Record<string, unknown>);
      if (sub.length === 0) paths.push([key]);
      else for (const name of sub) paths.push([key, name]);
    } else {
      paths.push([key]);
    }
  }
  return paths;
}

async function loadLayerAt(
  dir: string,
  names: readonly string[],
): Promise<{ file: string; config: VibeOpsConfig } | undefined> {
  for (const name of names) {
    const found = await loadFile(path.join(dir, name));
    if (found !== undefined) return found;
  }
  return undefined;
}

const loadDeclaredAt = (dir: string) => loadLayerAt(dir, FILENAMES.slice(LOCAL_FILENAME_COUNT));
const loadLocalAt = (dir: string) => loadLayerAt(dir, FILENAMES.slice(0, LOCAL_FILENAME_COUNT));

/** Does `holder`'s config already carry a value for a key this patch would write — same granularity as
 *  R1: `types.<name>` per name, `ownership` per identical `match`, `harness.applied`/`harness.boundary`
 *  each whole. */
function holdsPatchedKey(holder: VibeOpsConfig, patch: ManagedConfigPatch): boolean {
  if (patch.types !== undefined && Object.keys(patch.types).some((name) => holder.types?.[name] !== undefined)) {
    return true;
  }
  if (
    patch.ownership !== undefined &&
    patch.ownership.some((entry) => holder.ownership?.some((existing) => existing.match === entry.match) === true)
  ) {
    return true;
  }
  if (patch.harness?.applied !== undefined && holder.harness?.applied !== undefined) return true;
  if (patch.harness?.boundary !== undefined && holder.harness?.boundary !== undefined) return true;
  if (patch.harness?.agreed !== undefined && holder.harness?.agreed !== undefined) return true;
  return false;
}

function applyPatch(current: Record<string, unknown>, patch: ManagedConfigPatch): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current };
  if (patch.types !== undefined) {
    next.types = { ...(current.types as TypesConfig | undefined), ...patch.types };
  }
  if (patch.ownership !== undefined) {
    const existing = (current.ownership as OwnershipNarrowing[] | undefined) ?? [];
    const merged = [...existing];
    for (const entry of patch.ownership) {
      const i = merged.findIndex((e) => e.match === entry.match);
      if (i === -1) merged.push(entry);
      else merged[i] = entry;
    }
    next.ownership = merged;
  }
  if (patch.harness !== undefined) {
    next.harness = { ...(current.harness as HarnessConfig | undefined), ...patch.harness };
  }
  return next;
}

/** Deletes each dotted path (already validated by `isWritablePath`), dropping an emptied `types`/`harness`
 *  object entirely so its absence reads as absence rather than as `{}`. */
function applyRemove(obj: Record<string, unknown>, removePaths: readonly string[][]): Record<string, unknown> {
  let next = obj;
  for (const segments of removePaths) {
    if (segments.length === 1) {
      const { [segments[0]!]: _dropped, ...rest } = next;
      next = rest;
      continue;
    }
    const [top, key] = segments as [string, string];
    const child = next[top];
    if (child === undefined || typeof child !== "object") continue;
    const { [key]: _dropped, ...restChild } = child as Record<string, unknown>;
    if (Object.keys(restChild).length === 0) {
      const { [top]: _empty, ...rest } = next;
      next = rest;
    } else {
      next = { ...next, [top]: restChild };
    }
  }
  return next;
}

/**
 * The only writer of the `managed` layer (RFC-0004 §4). `dir` is the directory written in — the isolated
 * worktree during a sync, the repository root otherwise — and must itself hold a `.git` entry: a write
 * never lands above the toplevel, and read/write must target the same file, so this does not search
 * upward for one the way `findGitToplevel` does for reads.
 *
 * Refuses rather than throws for every one of R1–R5: they are routine, expected outcomes a surveying
 * skill maps to the convergence policy's own verbs (`adopt` for R1/R5, `leave` for R3), not exceptional
 * control flow — see the flowchart in RFC-0004 §4. A malformed on-disk managed file (R2) is the one
 * exception in spirit but not in shape: it is just as much a returned outcome as the other four.
 */
export async function writeManagedConfig(
  dir: string,
  patch: ManagedConfigPatch,
  options: WriteManagedConfigOptions = {},
): Promise<WriteManagedConfigResult> {
  const resolvedDir = path.resolve(dir);

  // R3 — no repository. A write never lands above the toplevel, so `dir` must already be one.
  if (!(await exists(path.join(resolvedDir, ".git")))) {
    return { ok: false, refusal: "R3", message: `${resolvedDir} is not a repository: no .git entry, so the managed layer cannot be written here` };
  }

  const removePaths = (options.remove ?? []).map((p) => p.split("."));
  const patchPaths = collectPatchPaths(patch as unknown as Record<string, unknown>);

  // R4 — the writable set is closed.
  for (const segments of [...patchPaths, ...removePaths]) {
    if (!isWritablePath(segments)) {
      return {
        ok: false,
        refusal: "R4",
        message: `${segments.join(".")} is not writable — the managed layer accepts only types, ownership, harness.applied, harness.boundary and harness.agreed`,
      };
    }
  }

  const file = path.join(resolvedDir, MANAGED_FILENAME);
  let current: Record<string, unknown> = {};
  if (await exists(file)) {
    const text = await readFile(file, "utf8");
    try {
      current = JSON.parse(text) as Record<string, unknown>;
    } catch (error) {
      // R2 — unparseable, naming the file.
      return { ok: false, refusal: "R2", message: `${file} is not valid JSON: ${(error as Error).message}` };
    }
  }

  // R1 — shadowed by the toplevel's own `declared` layer. `local` is never consulted here: one clone must
  // not block a repository-wide write.
  const declared = await loadDeclaredAt(resolvedDir);
  if (declared !== undefined && holdsPatchedKey(declared.config, patch)) {
    return { ok: false, refusal: "R1", message: `already declared in ${declared.file}; refusing to shadow a hand-written value` };
  }

  // R5 — a managed `types` binding cannot be silently rebound to a different package.
  if (patch.types !== undefined) {
    const currentTypes = (current.types as TypesConfig | undefined) ?? {};
    for (const [name, pkg] of Object.entries(patch.types)) {
      const existing = currentTypes[name];
      if (existing !== undefined && existing !== pkg) {
        return {
          ok: false,
          refusal: "R5",
          message: `${name} is already bound to ${existing} in the managed layer; refusing to rebind it to ${pkg} — that binding change is a migrate, not a write`,
        };
      }
    }
  }

  const written = applyRemove(applyPatch(current, patch), removePaths);
  await writeFile(file, `${JSON.stringify(written, undefined, 2)}\n`, "utf8");

  const local = await loadLocalAt(resolvedDir);
  const shadowedBy =
    local !== undefined && holdsPatchedKey(local.config, patch) ? [{ layer: "local" as const, file: local.file }] : [];

  return { ok: true, file, shadowedBy };
}
