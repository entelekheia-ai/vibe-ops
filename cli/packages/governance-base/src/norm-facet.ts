// `records norm` — where the NORM's copy of a type's facet is, resolved for whoever asks. Plan-033:
// this is the verb the Claude plugin's skills call instead of reading `${CLAUDE_PLUGIN_ROOT}` paths,
// and the first instance of the CLI as proxy between the plugin and the modular governance.
//
// RESOLUTION ORDER IS THE REPOSITORY'S, THEN THE ACTIVATED PACKAGE'S, THEN THE PIN'S — the same
// precedence every other reader applies (ADR-0019): a repository versioning its own types wins; the
// governance package bound through the config answers next; a pinned tree (`harness.source`, `--source`,
// `CLAUDE_PLUGIN_ROOT`) is the legacy fallback, tried in BOTH its layouts — a `types/<t>/type.json`
// unit, and the flat plugin shape older installs still have.
//
// AN ANSWER THAT DOES NOT EXIST IS STILL AN ANSWER. The best candidate is returned with
// `exists: false` rather than silently skipped to a worse one that happens to exist — the same
// visible-and-attributable rule `<records:<type>>` follows for a declared-but-missing directory.
//
// `policy` IS A FOURTH FACET (Plan-040 Track 1) with no legacy flat-layout path — it did not exist
// before this facet, so there is no `pinnedFlat` shape to fall back to. It reads `--name` against the
// resolved unit's `facets` map instead of a fixed field, which is why it needs the type's FULL unit
// (`resolveTypeUnitAt`'s `.unit.facets`, `activated.unit.facets`) rather than one precomputed path —
// the other three facets read one fixed field and never needed the unit itself.

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { activateGovernance, resolvePluginDir } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import { resolveTypeUnitAt } from "./type-unit.ts";

export type NormFacet = "template" | "authoring" | "migrations" | "policy";

export interface NormAnswer {
  readonly type: string;
  readonly facet: NormFacet;
  /** Present only when `facet` is `"policy"` — which of the unit's `facets` was asked for. */
  readonly name?: string;
  /** Absolute path — a norm facet is usually outside the repository. */
  readonly path: string;
  readonly source: "repo" | "declared" | "package" | "pinned";
  readonly exists: boolean;
}

interface Candidate {
  readonly path: string;
  readonly source: NormAnswer["source"];
}

/** `undefined` for `facet === "policy"` — that path is resolved by `policyPathFrom`, against `name`. */
function facetOf(resolved: ReturnType<typeof resolveTypeUnitAt>, facet: NormFacet): string | undefined {
  if (resolved === undefined) return undefined;
  if (facet === "template") return resolved.templatePath === "" ? undefined : resolved.templatePath;
  if (facet === "authoring") return resolved.authoringPath === "" ? undefined : resolved.authoringPath;
  if (facet === "migrations") return resolved.migrationsPath === "" ? undefined : resolved.migrationsPath;
  return undefined;
}

/** A named policy facet, resolved against the manifest that declared it — `undefined` when the unit
 *  declares no `facets`, or none under this name. */
function policyPathFrom(resolved: ReturnType<typeof resolveTypeUnitAt>, name: string | undefined): string | undefined {
  if (resolved === undefined || name === undefined) return undefined;
  const relative = resolved.unit.facets?.[name];
  return relative === undefined ? undefined : path.resolve(path.dirname(resolved.manifestFile), relative);
}

/** The pinned tree's flat layout — what a plugin install looked like before Plan-033 moved the norm.
 *  `policy` has none: it is a new facet, never shipped in the flat layout. */
function pinnedFlat(sourceRoot: string, type: string, facet: NormFacet): string | undefined {
  if (facet === "template") return path.join(sourceRoot, "templates", `${type}.md`);
  if (facet === "authoring") return path.join(sourceRoot, "references", "records", `${type}.md`);
  if (facet === "migrations") return path.join(sourceRoot, "skills", "migrate", "migrations");
  return undefined;
}

export async function resolveNormFacet(
  type: string,
  facet: NormFacet,
  repoRoot: string,
  config: VibeOpsConfig | undefined,
  sourceRoot: string | undefined,
  /** Which of the unit's `facets` to serve — required when, and meaningful only when, `facet === "policy"`. */
  name?: string,
): Promise<NormAnswer | undefined> {
  const candidates: Candidate[] = [];

  const pluginDir = resolvePluginDir(repoRoot);
  const repoUnit = resolveTypeUnitAt(pluginDir, type);
  const repoUnitPath = facet === "policy" ? policyPathFrom(repoUnit, name) : facetOf(repoUnit, facet);
  if (repoUnitPath !== undefined) candidates.push({ path: repoUnitPath, source: "repo" });
  // The repository's own copies in the pre-unit layout — a repo carrying its own notes or templates
  // under its plugin surface still outranks every norm, which is the repository-first rule. `policy`
  // has no such layout (see `pinnedFlat`), so it contributes nothing here.
  const repoFlat = pinnedFlat(pluginDir, type, facet);
  if (repoFlat !== undefined) candidates.push({ path: repoFlat, source: "repo" });

  const declared = facet === "template" ? config?.records?.templates?.[type] : undefined;
  if (declared !== undefined) candidates.push({ path: path.resolve(repoRoot, declared), source: "declared" });

  const activated = await activateGovernance(type, config);
  if (activated !== undefined) {
    if (facet === "policy") {
      const relative = name === undefined ? undefined : activated.unit.facets?.[name];
      if (relative !== undefined) candidates.push({ path: path.resolve(activated.root, relative), source: "package" });
    } else {
      const relative =
        facet === "template" ? activated.unit.template : facet === "authoring" ? activated.unit.authoring : activated.unit.migrations;
      if (relative !== undefined) candidates.push({ path: path.resolve(activated.root, relative), source: "package" });
    }
  }

  if (sourceRoot !== undefined) {
    const pinnedUnit = resolveTypeUnitAt(sourceRoot, type);
    const pinnedUnitPath = facet === "policy" ? policyPathFrom(pinnedUnit, name) : facetOf(pinnedUnit, facet);
    if (pinnedUnitPath !== undefined) candidates.push({ path: pinnedUnitPath, source: "pinned" });
    const pinnedFlatPath = pinnedFlat(sourceRoot, type, facet);
    if (pinnedFlatPath !== undefined) candidates.push({ path: pinnedFlatPath, source: "pinned" });
  }

  if (candidates.length === 0) return undefined;
  const found = candidates.find((candidate) => existsSync(candidate.path)) ?? candidates[0]!;
  return {
    type,
    facet,
    ...(facet === "policy" ? { name } : {}),
    path: found.path,
    source: found.source,
    exists: existsSync(found.path),
  };
}

/**
 * What a type's unit declares, read the same repo/package/pinned ladder `resolveNormFacet` reads —
 * whether it has a record template at all, and which policy names it serves. Used by `records norm`
 * to refuse `--facet template` on a policy-only type and `--facet policy --name <x>` on an unknown
 * name, naming what the type actually declares rather than reporting a bare "does not exist".
 */
export interface NormTypeDescription {
  readonly hasTemplate: boolean;
  readonly facetNames: readonly string[];
}

export async function describeNormType(
  type: string,
  repoRoot: string,
  config: VibeOpsConfig | undefined,
  sourceRoot: string | undefined,
): Promise<NormTypeDescription | undefined> {
  const pluginDir = resolvePluginDir(repoRoot);
  const repoUnit = resolveTypeUnitAt(pluginDir, type);
  if (repoUnit !== undefined) {
    return { hasTemplate: repoUnit.unit.template !== undefined, facetNames: Object.keys(repoUnit.unit.facets ?? {}) };
  }
  const activated = await activateGovernance(type, config);
  if (activated !== undefined) {
    return { hasTemplate: activated.unit.template !== undefined, facetNames: Object.keys(activated.unit.facets ?? {}) };
  }
  if (sourceRoot !== undefined) {
    const pinnedUnit = resolveTypeUnitAt(sourceRoot, type);
    if (pinnedUnit !== undefined) {
      return { hasTemplate: pinnedUnit.unit.template !== undefined, facetNames: Object.keys(pinnedUnit.unit.facets ?? {}) };
    }
  }
  return undefined;
}

/** The note files a migrations directory holds — what `--print` means for a directory facet. */
export function listMigrationNotes(dir: string): readonly string[] {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .sort()
      .map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

/**
 * The migration notes directory for one type — the facet resolution above, asked for `migrations` and
 * reduced to an existing directory or nothing. The closing verbs dispatch on this; `undefined` means no
 * older version is handleable, which is reported rather than guessed at.
 */
export async function migrationsDirFor(
  type: string,
  repoRoot: string,
  config: VibeOpsConfig | undefined,
  sourceRoot: string | undefined,
): Promise<string | undefined> {
  const answer = await resolveNormFacet(type, "migrations", repoRoot, config, sourceRoot);
  return answer !== undefined && answer.exists ? answer.path : undefined;
}
