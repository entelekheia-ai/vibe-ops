// Which installed packages declare a governance type, and which one owns a given name — Plan-029
// Track 2, implementing RFC-0003's "Resolution: scan, refuse, declare".
//
// THE RULE IS NOT NEGOTIABLE AND IT IS NOT AN ERROR PATH. One claimant resolves silently. Zero reports
// absence, because a repository may keep an artifact nothing installed knows about and the generic
// convention still answers for it. Two or more is a FINDING NAMING EVERY CLAIMANT — never a guess, and
// never an exception that aborts a run: an unresolvable type stops one entry, the same way an
// unwritable artifact destination produces a finding rather than killing the composition.
//
// WHY NOT LET INSTALL ORDER DECIDE. Two packages claiming `policy` is not a name clash a reader would
// notice; it is two governance regimes over one kind of artifact, each correct on its own terms. Picking
// by order, version or specificity produces a boundary nobody recorded and that changes when an
// unrelated package is installed. Only the repository knows which one governs it, which is what the
// `types` binding table is for.
//
// THE SCAN NEVER IMPORTS. It reads `package.json` and lists a directory, and that is deliberate: a type
// is data (RFC-0003), so learning that a package declares one must not run that package's code. It is
// also what lets the scan see a package that would fail to import at all.
//
// THE MARKER IS A MANIFEST FIELD, with precedent in this very package: `grammars.ts` reads a grammar's
// own `"tree-sitter"` array out of its `package.json`. The field points at a DIRECTORY rather than
// listing the type names, so the names come from the directory itself — a list beside the directory is
// a second copy to keep in step, which is the drift this whole plan exists to remove.
//
//   "vibeOps": { "types": "types" }     →  <packageRoot>/types/<name>/type.json

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** One package's claim on one type name. */
export interface TypeClaimant {
  /** The declaring package's own `name`, as written in its manifest. */
  readonly packageName: string;
  /** Absolute path to the package root. */
  readonly packageRoot: string;
  /** Absolute path to the directory holding `<type>/type.json`. */
  readonly typesDir: string;
}

/** What the scan concluded about one name. Never throws; `resolved` absent IS the answer. */
export interface TypeResolution {
  readonly type: string;
  /** Every package declaring this name, in the order the scan found them. */
  readonly claimants: readonly TypeClaimant[];
  /** The one that governs, when that is knowable. */
  readonly resolved?: TypeClaimant;
  /** The repository's binding, when it declared one — used even if it resolves to nothing. */
  readonly declared?: string;
  /** Why nothing resolved, in the words a finding needs. Absent when `resolved` is set. */
  readonly unresolved?: string;
}

const MANIFEST = "package.json";

interface RawManifest {
  readonly name?: unknown;
  readonly vibeOps?: { readonly types?: unknown };
}

/** A package's declared types directory, or `undefined` when it declares none. Reads, never imports. */
function declaredTypesDir(packageRoot: string): string | undefined {
  let raw: RawManifest;
  try {
    raw = JSON.parse(readFileSync(path.join(packageRoot, MANIFEST), "utf8")) as RawManifest;
  } catch {
    return undefined;
  }
  const declared = raw.vibeOps?.types;
  if (typeof declared !== "string" || declared === "") return undefined;
  return path.resolve(packageRoot, declared);
}

function manifestName(packageRoot: string): string {
  try {
    const raw = JSON.parse(readFileSync(path.join(packageRoot, MANIFEST), "utf8")) as RawManifest;
    return typeof raw.name === "string" ? raw.name : path.basename(packageRoot);
  } catch {
    return path.basename(packageRoot);
  }
}

/** Every package directory inside one `node_modules`: top level plus one level into each `@scope/`. */
function packageDirsIn(nodeModules: string): readonly string[] {
  let entries: readonly string[];
  try {
    entries = readdirSync(nodeModules, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  const dirs: string[] = [];
  for (const name of entries) {
    if (name === ".bin" || name === ".cache") continue;
    const full = path.join(nodeModules, name);
    if (!name.startsWith("@")) {
      dirs.push(full);
      continue;
    }
    try {
      for (const scoped of readdirSync(full, { withFileTypes: true })) {
        if (scoped.isDirectory() || scoped.isSymbolicLink()) dirs.push(path.join(full, scoped.name));
      }
    } catch {
      // A scope directory that cannot be listed contributes nothing, like any other unreadable path.
    }
  }
  return dirs;
}

/**
 * Every installed package declaring a types directory, searching `node_modules` from `fromDir` upward.
 *
 * UPWARD, because npm hoists: in this workspace every package's dependencies resolve from the ROOT
 * `node_modules`, one directory above `cli/`, and a scan anchored at one package would find nothing. The
 * walk stops at the filesystem root, and a directory that does not exist contributes nothing rather than
 * failing — an uninstalled tree is an ordinary state.
 *
 * A package found nearer wins over the same name found farther, which is the resolution order npm itself
 * uses. Two DIFFERENT packages claiming one type name are both kept; that is the ambiguity
 * `resolveTypeName` reports rather than silently collapses.
 */
export function scanTypePackages(fromDir: string): readonly TypeClaimant[] {
  const found: TypeClaimant[] = [];
  const seen = new Set<string>();

  let dir = path.resolve(fromDir);
  for (;;) {
    for (const packageRoot of packageDirsIn(path.join(dir, "node_modules"))) {
      const typesDir = declaredTypesDir(packageRoot);
      if (typesDir === undefined) continue;
      const packageName = manifestName(packageRoot);
      if (seen.has(packageName)) continue;
      seen.add(packageName);
      found.push({ packageName, packageRoot, typesDir });
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

/** The type names a claimant's directory actually holds — the directory IS the declaration. */
export function typesDeclaredBy(claimant: TypeClaimant): readonly string[] {
  try {
    return readdirSync(claimant.typesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Which package governs `type`, per RFC-0003's rule.
 *
 * `binding` is the repository's own declaration from `config.types` — a package name, matched against
 * each claimant's manifest name. **A declared binding is used even when it does not resolve**: the
 * caller then examines zero files against the name the repository chose, which is visible and
 * attributable, where a silent fallback to another claimant is neither. That is the same decision the
 * `<records:<type>>` token already implements for a declared-but-missing directory.
 */
export function resolveTypeName(
  type: string,
  claimants: readonly TypeClaimant[],
  binding?: string,
): TypeResolution {
  const claiming = claimants.filter((claimant) => typesDeclaredBy(claimant).includes(type));

  if (binding !== undefined) {
    const bound = claiming.find((claimant) => claimant.packageName === binding);
    if (bound !== undefined) return { type, claimants: claiming, resolved: bound, declared: binding };
    return {
      type,
      claimants: claiming,
      declared: binding,
      unresolved:
        `this repository binds "${type}" to ${binding}, which declares no such type` +
        (claiming.length > 0 ? ` — ${claiming.map((c) => c.packageName).join(", ")} do` : " and nothing installed does"),
    };
  }

  if (claiming.length === 1) return { type, claimants: claiming, resolved: claiming[0] };
  if (claiming.length === 0) {
    return { type, claimants: claiming, unresolved: `no installed package declares the type "${type}"` };
  }
  return {
    type,
    claimants: claiming,
    unresolved:
      `${claiming.length} installed packages declare the type "${type}" — ` +
      `${claiming.map((c) => c.packageName).join(", ")}. ` +
      `Declare which one governs it in vibeops.config.ts: types: { "${type}": "${claiming[0]!.packageName}" }`,
  };
}
