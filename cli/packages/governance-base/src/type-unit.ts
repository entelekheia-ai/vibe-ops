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

/** One file a package writes into a repository, and where it lands there. */
export interface TypeUnitScaffoldFile {
  /** Relative to the scaffold directory. */
  readonly from: string;
  /** Relative to the target repository's root. */
  readonly to: string;
  /**
   * Which repository shape this file belongs to — RFC-0005 §4's `setup scaffold <shape> <target>`.
   * Absent means every shape, which is what most files are. A `package.json` is the counter-example and
   * the reason this exists: a single-package repository and an npm-workspaces monorepo need DIFFERENT
   * files at the SAME destination, so the choice cannot be made by the destination.
   */
  readonly shape?: string;
}

/**
 * What a package contributes to a scaffolded repository — Plan-040 Track 6.
 *
 * EVERY DESTINATION IS SPELLED OUT, which is the whole reason this is a list rather than "copy the
 * directory". Two facts make an implicit mapping wrong. A file that must land as `.gitignore` or
 * `.gitkeep` is STORED WITHOUT ITS LEADING DOT, because a real dotfile under this repository's own
 * `scaffold/` would be applied to this repository instead of shipped from it — the guardrail predates
 * this field and is the reason `agents/skills/gitkeep` exists under that name. And a file may be named
 * for what it is rather than for where it goes: `NOTICE.template` lands as `NOTICE`. A convention that
 * derives one from the other has to encode both exceptions; a `to` states it.
 */
export interface TypeUnitScaffold {
  /** The directory the `from` paths are relative to, relative to the manifest. */
  readonly dir: string;
  readonly files: readonly TypeUnitScaffoldFile[];
  /** The `{{NAME}}` placeholders these files carry, for the caller that substitutes them. Advisory the
   *  same way `targets` is: a file may carry none, and a name listed here that appears in no file is not
   *  an error — it is a package documenting what it can be asked for. */
  readonly placeholders?: readonly string[];
}

/** The status chain a record of this type moves through, and what the chain implies. */
export interface TypeUnitLifecycle {
  /** Every status, in order. */
  readonly chain: readonly string[];
  /** The status a record is worked at — what a "still open" reader asks for. */
  readonly active: string;
  /** Where the chain stops. */
  readonly terminal: string;
  /** Headings maintained while the work happens rather than written at the end. */
  readonly living?: readonly string[];
  /** Where a record goes once terminal, relative to the type's own directory. */
  readonly archive?: string;
  /** From this status on, the record may not be edited. Absent means it always may. */
  readonly immutableFrom?: string;
}

export interface TypeUnit {
  readonly type: string;
  /** How the type is written where a human reads it — `ADR` for `adr`, `Log` for `log`. Whether a type
   *  name is an acronym is a fact about the type, not something a renderer can infer. */
  readonly title?: string;
  /**
   * Relative to the manifest file. Absent only for a POLICY-ONLY unit — one that declares `facets`
   * and no record of its own (`base`, RFC-0005 §3: `governance-base` ships no record, only the policy
   * facets other packages used to read from `plugin/references/`). Every unit that carries no `facets`
   * still requires the three record facets below, unchanged — `requireString` still throws for one of
   * those, which is what keeps the existing "a required field missing throws" behaviour exactly as it
   * was for every record type this repository ships today.
   */
  readonly template?: string;
  /** Relative to the manifest file. Absent under the same policy-only condition as `template`. */
  readonly authoring?: string;
  /** Relative to the manifest file, a directory. Absent under the same policy-only condition. */
  readonly migrations?: string;
  /**
   * Named policy files this package serves through `records norm --facet policy --name <key>` —
   * Plan-040 Track 1. A map from a policy name to a path relative to the manifest file's directory,
   * the same convention `template`/`authoring`/`migrations` already use — which for every shipped
   * package (`type.json` at the package root) is the package root itself.
   */
  readonly facets?: Readonly<Record<string, string>>;
  /** Absent for a type whose artifacts carry no metadata — see the parser. */
  readonly schema?: TypeUnitSchema;
  /** The status chain and what it implies — Plan-040 Track 2. Absent while a type's readers still
   *  derive it from the template's own prose. */
  readonly lifecycle?: TypeUnitLifecycle;
  /** A style package's documented artefact list — advisory, RFC-0005 §2.1. */
  readonly targets?: readonly string[];
  /** What this package writes into a scaffolded repository — Plan-040 Track 6. */
  readonly scaffold?: TypeUnitScaffold;
  /**
   * A markdown fragment, relative to the manifest, holding what is true of this type and does not derive
   * from any field above — the closure ceremony, why a section is living, why a gap in the numbering is
   * expected. PROSE STAYS PROSE: rendering a governance document from data is what keeps it current with
   * the activated types, and the half that is genuinely a paragraph would be worse as fields. The package
   * that owns the type owns the paragraph.
   *
   * It sits beside `lifecycle` rather than inside it because a type may have prose and NO chain — the log
   * is write-once, so it has no status to be at, and nesting this would have made its section
   * unrepresentable.
   */
  readonly notes?: string;
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
 * `facets`, parsed and validated as a flat map of name → relative path. Present but malformed still
 * refuses — the same "a typo must not read as absence" rule `schema` follows below.
 */
function parseFacets(parsed: Record<string, unknown>, file: string): Readonly<Record<string, string>> | undefined {
  const value = parsed.facets;
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RecordsConfigError(`${file} declares an invalid facets — a type unit carries a map of name to relative path`);
  }
  const facets: Record<string, string> = {};
  for (const [name, path_] of Object.entries(value as Record<string, unknown>)) {
    if (typeof path_ !== "string" || path_ === "") {
      throw new RecordsConfigError(`${file} declares facets.${name} as something other than a non-empty path string`);
    }
    facets[name] = path_;
  }
  return facets;
}

/**
 * `lifecycle`, the status chain and what it implies — Plan-040 Track 2.
 *
 * WHY IT IS DATA HERE RATHER THAN PROSE PARSED FROM A TEMPLATE. Two documents describe every activated
 * type's lifecycle — `GOVERNANCE.md` and `agents/rules/governance.md` — and both were static files
 * scaffolded once, so a repository that activated a sixth type had two documents silently describing
 * five. Track 6 renders them from this field. Until then it is read where the chain is needed and
 * falls back to what the template says, which is what every reader does today.
 *
 * `chain` is the whole sequence in order. `active` is the status a record is worked at and defaults to
 * the second term; `terminal` is where it stops and defaults to the last. Both are declarable because a
 * chain with a branch (an RFC's Rejected) has neither at a fixed index.
 */
function parseLifecycle(parsed: Record<string, unknown>, file: string, type: string): TypeUnitLifecycle | undefined {
  const value = parsed.lifecycle;
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RecordsConfigError(`${file} declares an invalid lifecycle — a type unit carries an object or none`);
  }
  const raw = value as Record<string, unknown>;

  const chain = raw.chain;
  if (!Array.isArray(chain) || chain.length === 0 || chain.some((s) => typeof s !== "string" || s === "")) {
    throw new RecordsConfigError(`${file} declares lifecycle for ${type} with no chain — the ordered status names are what every other field reads`);
  }
  const statuses = chain as readonly string[];

  const declared = (field: "active" | "terminal"): string | undefined => {
    const status = raw[field];
    if (status === undefined) return undefined;
    if (typeof status !== "string" || !statuses.includes(status)) {
      throw new RecordsConfigError(`${file} declares lifecycle.${field} = ${JSON.stringify(status)}, which is not one of its own chain (${statuses.join(" → ")})`);
    }
    return status;
  };

  const living = raw.living;
  if (living !== undefined && (!Array.isArray(living) || living.some((s) => typeof s !== "string"))) {
    throw new RecordsConfigError(`${file} declares an invalid lifecycle.living — the living sections are a list of heading names`);
  }
  const archive = raw.archive;
  if (archive !== undefined && (typeof archive !== "string" || archive === "")) {
    throw new RecordsConfigError(`${file} declares an invalid lifecycle.archive — the archival directory is a relative path or absent`);
  }
  const immutableFrom = declared("terminal") === undefined ? undefined : raw.immutableFrom;
  if (immutableFrom !== undefined && (typeof immutableFrom !== "string" || !statuses.includes(immutableFrom))) {
    throw new RecordsConfigError(`${file} declares lifecycle.immutableFrom = ${JSON.stringify(immutableFrom)}, which is not one of its own chain`);
  }

  return {
    chain: statuses,
    active: declared("active") ?? statuses[Math.min(1, statuses.length - 1)]!,
    terminal: declared("terminal") ?? statuses[statuses.length - 1]!,
    ...(living === undefined ? {} : { living: living as readonly string[] }),
    ...(archive === undefined ? {} : { archive: archive as string }),
    ...(immutableFrom === undefined ? {} : { immutableFrom: immutableFrom as string }),
  };
}

/**
 * `scaffold`, what a package writes into a repository — Plan-040 Track 6.
 *
 * VALIDATED, BECAUSE THE FIRST SHAPE OF THIS FIELD WAS NOT. It shipped as a bare `"./scaffold"` string
 * that nothing read and nothing checked, so `"scafold"` parsed exactly as well as the real key and would
 * have stayed invisible until a reader existed. A declaration nobody validates is a declaration nobody
 * can rely on, which is the same argument this parser already makes for `schema` and `facets`.
 *
 * A `to` that is absolute, or that climbs out of the target with `..`, is refused here rather than at the
 * moment of writing: a scaffold entry is data a package ships, and the one thing it must never be able
 * to say is "write outside the repository I was pointed at".
 */
function parseScaffold(parsed: Record<string, unknown>, file: string): TypeUnitScaffold | undefined {
  const value = parsed.scaffold;
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RecordsConfigError(
      `${file} declares an invalid scaffold — a type unit carries { dir, files: [{ from, to }], placeholders? } or none`,
    );
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.dir !== "string" || raw.dir === "") {
    throw new RecordsConfigError(`${file} declares a scaffold with no dir — the directory its \`from\` paths are relative to`);
  }
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    throw new RecordsConfigError(`${file} declares a scaffold with no files — a contribution that writes nothing is an absent scaffold, not an empty one`);
  }

  const files = raw.files.map((entry, index) => {
    const candidate = entry as { from?: unknown; to?: unknown } | null;
    if (typeof candidate !== "object" || candidate === null || typeof candidate.from !== "string" || typeof candidate.to !== "string") {
      throw new RecordsConfigError(`${file} declares scaffold.files[${index}] as something other than { from, to }`);
    }
    if (candidate.from === "" || candidate.to === "") {
      throw new RecordsConfigError(`${file} declares scaffold.files[${index}] with an empty from or to`);
    }
    if (path.isAbsolute(candidate.to) || candidate.to.split("/").includes("..")) {
      throw new RecordsConfigError(
        `${file} declares scaffold.files[${index}].to = ${JSON.stringify(candidate.to)}, which leaves the repository it would be written into`,
      );
    }
    const shape = (candidate as { shape?: unknown }).shape;
    if (shape !== undefined && (typeof shape !== "string" || shape === "")) {
      throw new RecordsConfigError(`${file} declares scaffold.files[${index}].shape as something other than a shape name`);
    }
    return { from: candidate.from, to: candidate.to, ...(shape === undefined ? {} : { shape: shape as string }) };
  });

  const placeholders = raw.placeholders;
  if (placeholders !== undefined && (!Array.isArray(placeholders) || placeholders.some((p) => typeof p !== "string" || p === ""))) {
    throw new RecordsConfigError(`${file} declares an invalid scaffold.placeholders — a list of {{NAME}} names, or none`);
  }

  return {
    dir: raw.dir,
    files,
    ...(placeholders === undefined ? {} : { placeholders: placeholders as readonly string[] }),
  };
}

/**
 * `targets`, a style package's documented list of artefacts it ships a fragment for — RFC-0005 §2.1.
 * ADVISORY BY DECISION: an undeclared target is served with a warning, never refused, because the
 * artefacts that are not record types (`readme`, `research-private`) outgrow any list a package can
 * ratify. Validated for shape only, so a typo in the list is still visible.
 */
function parseTargets(parsed: Record<string, unknown>, file: string): readonly string[] | undefined {
  const value = parsed.targets;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((t) => typeof t !== "string" || t === "")) {
    throw new RecordsConfigError(`${file} declares an invalid targets — a list of artefact names this package documents a fragment for`);
  }
  return value as readonly string[];
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
  return parseUnitObject(parsed, file);
}

/**
 * Every unit a manifest declares — one for the ordinary shape, several when it declares `units`.
 *
 * A PACKAGE MAY SHIP SEVERAL UNITS, WHICH IS WHAT "ONE ARTIFACT, ONE PACKAGE" BECOMES (RFC-0005 §2, the
 * ADR succeeding ADR-0019). The rule it widens is still one artifact, one UNIT — what changes is that a
 * package may carry more than one of them, because two artifacts can be the same subject read twice:
 * `knowledge` ships `log` (a trap at a path in this repository) and `learning` (a fact that holds beyond
 * it), and splitting them into two packages would publish the promotion test twice.
 *
 * The two forms are exclusive. A manifest declaring both a top-level `type` and a `units` array is
 * refused rather than merged: which one activation should answer with would then be a guess, and a guess
 * that reads as an answer is the failure this parser exists to prevent.
 */
export function parseTypeManifest(text: string, file: string): readonly TypeUnit[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new RecordsConfigError(`${file} is not valid JSON: ${(error as Error).message}`);
  }

  const units = parsed.units;
  if (units === undefined) return [parseUnitObject(parsed, file)];

  if (!Array.isArray(units) || units.length === 0) {
    throw new RecordsConfigError(`${file} declares an invalid units — a manifest carries a non-empty array of type units`);
  }
  if (parsed.type !== undefined) {
    throw new RecordsConfigError(`${file} declares both type and units — a manifest is one unit or several, never both`);
  }

  const parsedUnits = units.map((unit, index) => {
    if (typeof unit !== "object" || unit === null || Array.isArray(unit)) {
      throw new RecordsConfigError(`${file} declares units[${index}] as something other than a type unit object`);
    }
    return parseUnitObject(unit as Record<string, unknown>, file);
  });

  const seen = new Set<string>();
  for (const unit of parsedUnits) {
    if (seen.has(unit.type)) {
      throw new RecordsConfigError(`${file} declares the type "${unit.type}" twice — each unit in a manifest names a different type`);
    }
    seen.add(unit.type);
  }
  return parsedUnits;
}

function parseUnitObject(parsed: Record<string, unknown>, file: string): TypeUnit {
  const type = requireString(parsed, "type", file);
  const facets = parseFacets(parsed, file);

  // A unit declaring `facets` and NO record field at all is POLICY-ONLY (RFC-0005 §3: `base` ships no
  // record, only the policy files that used to live under `plugin/references/`) — its three record
  // facets are absent together, which is the whole of the relaxation.
  //
  // ALL THREE OR NONE, deliberately. Keying this on `facets` being present would relax the requirement
  // for a manifest that has both, and `governance-classification` is one today: dropping its `authoring`
  // would then parse in silence, and the completeness fragment checks authoring for the four record
  // types only, so nothing downstream would notice. A unit that carries a record carries all three.
  const declaresRecord = parsed.template !== undefined || parsed.authoring !== undefined || parsed.migrations !== undefined;
  const policyOnly = facets !== undefined && Object.keys(facets).length > 0 && !declaresRecord;
  const template = policyOnly ? undefined : requireString(parsed, "template", file);
  const authoring = policyOnly ? undefined : requireString(parsed, "authoring", file);
  const migrations = policyOnly ? undefined : requireString(parsed, "migrations", file);

  // OPTIONAL, because not every governed type has records carrying metadata. A licence and a
  // classification policy are data the tooling owns and hands out; neither has a header table nor
  // frontmatter, and declaring a carrier for them would have the governance ops derive a metadata check
  // over a file that has none — `ops-derive` already reads an absent schema as "derives no entry".
  // Present but malformed is still refused: a typo must not read as absence.
  const schema = parsed.schema as Partial<TypeUnitSchema> | undefined;
  if (schema !== undefined && (!CARRIERS.has(schema.carrier as TypeUnitCarrier) || !Array.isArray(schema.required))) {
    throw new RecordsConfigError(
      `${file} declares an invalid schema — a type unit carries { carrier: "table" | "frontmatter", required: [...] } or none`,
    );
  }

  const lifecycle = parseLifecycle(parsed, file, type);
  const targets = parseTargets(parsed, file);
  const scaffold = parseScaffold(parsed, file);

  const notes = parsed.notes;
  if (notes !== undefined && (typeof notes !== "string" || notes === "")) {
    throw new RecordsConfigError(`${file} declares an invalid notes — a path to a markdown fragment, or none`);
  }

  const title = parsed.title;
  if (title !== undefined && (typeof title !== "string" || title === "")) {
    throw new RecordsConfigError(`${file} declares an invalid title — how the type is written for a reader, or none`);
  }

  return {
    type,
    ...(title === undefined ? {} : { title: title as string }),
    ...(lifecycle === undefined ? {} : { lifecycle }),
    ...(targets === undefined ? {} : { targets }),
    ...(scaffold === undefined ? {} : { scaffold }),
    ...(notes === undefined ? {} : { notes: notes as string }),
    ...(template === undefined ? {} : { template }),
    ...(authoring === undefined ? {} : { authoring }),
    ...(migrations === undefined ? {} : { migrations }),
    ...(facets === undefined ? {} : { facets }),
    ...(schema === undefined
      ? {}
      : { schema: { carrier: schema.carrier as TypeUnitCarrier, required: schema.required as readonly string[] } }),
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

/** `relative` is absent for a policy-only unit's record facets — reported as a non-existent "" path,
 *  never a throw, the same "declared-but-missing does not throw" rule the module header states. */
function resolveFacet(manifestFile: string, relative: string | undefined): { path: string; exists: boolean } {
  if (relative === undefined) return { path: "", exists: false };
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
