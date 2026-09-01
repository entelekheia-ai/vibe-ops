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

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { activateGovernance, resolvePluginDir } from "@entelekheia/vibe-ops-core";
import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import { resolveTypeUnitAt } from "./type-unit.ts";

export type NormFacet = "template" | "authoring" | "migrations";

export interface NormAnswer {
  readonly type: string;
  readonly facet: NormFacet;
  /** Absolute path — a norm facet is usually outside the repository. */
  readonly path: string;
  readonly source: "repo" | "declared" | "package" | "pinned";
  readonly exists: boolean;
}

interface Candidate {
  readonly path: string;
  readonly source: NormAnswer["source"];
}

function facetOf(resolved: ReturnType<typeof resolveTypeUnitAt>, facet: NormFacet): string | undefined {
  if (resolved === undefined) return undefined;
  return facet === "template" ? resolved.templatePath : facet === "authoring" ? resolved.authoringPath : resolved.migrationsPath;
}

/** The pinned tree's flat layout — what a plugin install looked like before Plan-033 moved the norm. */
function pinnedFlat(sourceRoot: string, type: string, facet: NormFacet): string {
  if (facet === "template") return path.join(sourceRoot, "templates", `${type}.md`);
  if (facet === "authoring") return path.join(sourceRoot, "references", "records", `${type}.md`);
  return path.join(sourceRoot, "skills", "migrate", "migrations");
}

export async function resolveNormFacet(
  type: string,
  facet: NormFacet,
  repoRoot: string,
  config: VibeOpsConfig | undefined,
  sourceRoot: string | undefined,
): Promise<NormAnswer | undefined> {
  const candidates: Candidate[] = [];

  const pluginDir = resolvePluginDir(repoRoot);
  const repoUnitPath = facetOf(resolveTypeUnitAt(pluginDir, type), facet);
  if (repoUnitPath !== undefined) candidates.push({ path: repoUnitPath, source: "repo" });
  // The repository's own copies in the pre-unit layout — a repo carrying its own notes or templates
  // under its plugin surface still outranks every norm, which is the repository-first rule.
  candidates.push({ path: pinnedFlat(pluginDir, type, facet), source: "repo" });

  const declared = facet === "template" ? config?.records?.templates?.[type] : undefined;
  if (declared !== undefined) candidates.push({ path: path.resolve(repoRoot, declared), source: "declared" });

  const activated = await activateGovernance(type, config);
  if (activated !== undefined) {
    const relative =
      facet === "template" ? activated.unit.template : facet === "authoring" ? activated.unit.authoring : activated.unit.migrations;
    candidates.push({ path: path.resolve(activated.root, relative), source: "package" });
  }

  if (sourceRoot !== undefined) {
    const pinnedUnitPath = facetOf(resolveTypeUnitAt(sourceRoot, type), facet);
    if (pinnedUnitPath !== undefined) candidates.push({ path: pinnedUnitPath, source: "pinned" });
    candidates.push({ path: pinnedFlat(sourceRoot, type, facet), source: "pinned" });
  }

  if (candidates.length === 0) return undefined;
  const found = candidates.find((candidate) => existsSync(candidate.path)) ?? candidates[0]!;
  return { type, facet, path: found.path, source: found.source, exists: existsSync(found.path) };
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
