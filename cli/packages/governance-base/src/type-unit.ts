// The type unit — one manifest per record type, declaring where its facets live rather than moving them.
// Plan-030 Track 1. `type.json` is data, never executable: a package contributing a type must be
// readable without importing it, the same constraint the scan in Plan-029 Track 2 places on its marker.
//
// RESOLUTION IS TWO ROOTS, REPOSITORY FIRST — the same order `migrationsDir()` in
// `cli/packages/module-plan/src/index.ts` already implements, for the same reason: a repository may
// version its own types, and the alternative would impose a shape at the moment somebody updated an
// unrelated package, on tooling that does not run continuously.
//
// A DECLARED-BUT-MISSING FACET DOES NOT THROW. This is deliberately unlike `RecordsConfigError` in
// `layout.ts`, which fires when a `vibeops.config.ts`-declared path is missing — that path is about to be
// WRITTEN TO by a verb, so aborting is correct. A `type.json`'s `template`/`authoring`/`migrations` paths
// are read by many read-only callers (`/new`, gates, `records resolve`), and RFC-0003's own rule governs
// this case: a declared binding is used even when it does not resolve, visible and attributable, where a
// silent fallback is neither. Only a manifest that fails to PARSE throws — a manifest that parses but
// points somewhere empty is a normal, reportable state, and it is the mechanism `log`'s declared debt
// (no `authoring` file yet) needs: `resolveTypeUnit` reports `authoringExists: false`, never a crash.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolvePluginDir } from "@entelekheia/vibe-ops-core";
import { RecordsConfigError } from "./layout.ts";

export type TypeUnitCarrier = "table" | "frontmatter";

export interface TypeUnitSchema {
  readonly carrier: TypeUnitCarrier;
  readonly required: readonly string[];
}

export interface TypeUnit {
  readonly type: string;
  /** Relative to the manifest file. */
  readonly template: string;
  /** Relative to the manifest file. */
  readonly authoring: string;
  /** Relative to the manifest file, a directory. */
  readonly migrations: string;
  readonly schema: TypeUnitSchema;
  readonly numbered: boolean;
  readonly pad: number;
  readonly depth: number;
  readonly dirs: readonly string[];
}

const CARRIERS = new Set<TypeUnitCarrier>(["table", "frontmatter"]);

function requireString(parsed: Record<string, unknown>, field: string, file: string): string {
  const value = parsed[field];
  if (typeof value !== "string" || value === "") {
    throw new RecordsConfigError(`${file} declares no ${field} — a type unit must name it`);
  }
  return value;
}

/**
 * Parses and validates a `type.json`'s content. Follows the one existing "parse JSON, validate shape,
 * throw a clear error naming the file" precedent in this codebase —
 * `cli/packages/module-harness/src/ownership.ts`'s `readOwnership()` — rather than a schema library:
 * neither `core` nor `records` depends on one, and the only occurrence of `zod` in this workspace is
 * `cli`'s MCP tool shapes.
 */
export function parseTypeUnit(text: string, file: string): TypeUnit {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new RecordsConfigError(`${file} is not valid JSON: ${(error as Error).message}`);
  }

  const type = requireString(parsed, "type", file);
  const template = requireString(parsed, "template", file);
  const authoring = requireString(parsed, "authoring", file);
  const migrations = requireString(parsed, "migrations", file);

  const schema = parsed.schema as Partial<TypeUnitSchema> | undefined;
  if (schema === undefined || !CARRIERS.has(schema.carrier as TypeUnitCarrier) || !Array.isArray(schema.required)) {
    throw new RecordsConfigError(
      `${file} declares no valid schema — a type unit must carry { carrier: "table" | "frontmatter", required: [...] }`,
    );
  }

  return {
    type,
    template,
    authoring,
    migrations,
    schema: { carrier: schema.carrier as TypeUnitCarrier, required: schema.required as readonly string[] },
    numbered: typeof parsed.numbered === "boolean" ? parsed.numbered : true,
    pad: typeof parsed.pad === "number" ? parsed.pad : 3,
    depth: typeof parsed.depth === "number" ? parsed.depth : 1,
    dirs: Array.isArray(parsed.dirs) ? (parsed.dirs as readonly string[]) : [`project/${type}`, type, `docs/${type}`],
  };
}

export interface ResolvedTypeUnit {
  readonly unit: TypeUnit;
  /** Absolute path to the `type.json` that resolved. */
  readonly manifestFile: string;
  readonly source: "repo" | "norm";
  readonly templatePath: string;
  readonly templateExists: boolean;
  readonly authoringPath: string;
  readonly authoringExists: boolean;
  readonly migrationsPath: string;
  readonly migrationsExists: boolean;
}

function manifestPathIn(root: string, type: string): string {
  return path.join(root, "types", type, "type.json");
}

function resolveFacet(manifestFile: string, relative: string): { path: string; exists: boolean } {
  const resolved = path.resolve(path.dirname(manifestFile), relative);
  return { path: resolved, exists: existsSync(resolved) };
}

/**
 * Resolves a type's unit under one root's `types/<type>/type.json`, or `undefined` when that root
 * declares nothing for it. The single-root primitive `resolveTypeUnit` composes over two roots, and the
 * generated index (`generate-type-index.ts`) uses this directly — generation reads one root (the plugin
 * tree being built), never falls through to another.
 */
export function resolveTypeUnitAt(root: string, type: string): ResolvedTypeUnit | undefined {
  const manifestFile = manifestPathIn(root, type);
  if (!existsSync(manifestFile)) return undefined;

  const unit = parseTypeUnit(readFileSync(manifestFile, "utf8"), manifestFile);
  const template = resolveFacet(manifestFile, unit.template);
  const authoring = resolveFacet(manifestFile, unit.authoring);
  const migrations = resolveFacet(manifestFile, unit.migrations);

  return {
    unit,
    manifestFile,
    source: "repo",
    templatePath: template.path,
    templateExists: template.exists,
    authoringPath: authoring.path,
    authoringExists: authoring.exists,
    migrationsPath: migrations.path,
    migrationsExists: migrations.exists,
  };
}

/**
 * Resolves a type's unit, repository first, installed norm second — mirroring `migrationsDir()`
 * exactly. Returns `undefined` when neither root declares the type, which is a legitimate state, never
 * an error: a type this repository does not ship is simply not resolvable here.
 */
export function resolveTypeUnit(
  repoRoot: string,
  sourceRoot: string | undefined,
  type: string,
): ResolvedTypeUnit | undefined {
  const fromRepo = resolveTypeUnitAt(resolvePluginDir(repoRoot), type);
  if (fromRepo !== undefined) return fromRepo;
  if (sourceRoot === undefined) return undefined;
  const fromNorm = resolveTypeUnitAt(sourceRoot, type);
  return fromNorm === undefined ? undefined : { ...fromNorm, source: "norm" };
}
