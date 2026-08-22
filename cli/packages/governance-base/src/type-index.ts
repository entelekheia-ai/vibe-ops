// The generated index over a plugin tree's type units — Plan-030 Track 1, item 5.
//
// ONE DEFINITION, TWO CALLERS. The `generate-type-index` script writes it; the `type-index-drift` gate
// rebuilds it and compares. A second copy of "what the index contains" would drift, and a drift here is
// invisible from either side because both answers look like a valid index.
//
// The version is the one field a manifest never declares — a `type.json`'s job is paths, and the
// template's own frontmatter already owns that number. So it is read here, from each unit's resolved
// template, and cached in the output. Safe only because the output is generated and drift-checked,
// never authored.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveTypeUnitAt } from "./type-unit.ts";
import type { TypeUnitSchema } from "./type-unit.ts";

export interface TypeIndexEntry {
  /** From the resolved template's own frontmatter. Absent when the template is missing or declares none. */
  readonly version?: number;
  /** Every path is relative to the plugin root, so the index is comparable across checkouts. */
  readonly template: string;
  readonly authoring: string;
  readonly migrations: string;
  readonly schema: TypeUnitSchema;
  readonly numbered: boolean;
  readonly pad: number;
  readonly depth: number;
  readonly dirs: readonly string[];
}

export type TypeIndex = Record<string, TypeIndexEntry>;

/** Where the generated index sits inside a plugin tree. */
export function typeIndexPath(pluginRoot: string): string {
  return path.join(pluginRoot, "types", "index.json");
}

/**
 * The version a template's own frontmatter declares for `type`, matched against the type rather than
 * accepted from any `<word>@<n>` — a template copied from its neighbour and left carrying the source's
 * token would otherwise report a version belonging to another document, which is the failure mode that
 * looks like an answer.
 */
function templateVersion(templatePath: string, type: string): number | undefined {
  let text: string;
  try {
    text = readFileSync(templatePath, "utf8");
  } catch {
    return undefined;
  }
  const match = new RegExp(`^vibe-ops-template: ${type}@(\\d+)$`, "m").exec(text);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

/**
 * Builds the index from every unit under `<pluginRoot>/types/`. A directory there IS a declared type —
 * no hardcoded list, which is the whole point of the unit. An empty or absent `types/` yields `{}`
 * rather than throwing: a repository shipping no type units is an ordinary state.
 *
 * Keys are emitted in sorted order so the serialised form is stable — the drift check compares text.
 */
export function buildTypeIndex(pluginRoot: string): TypeIndex {
  const typesDir = path.join(pluginRoot, "types");
  let names: readonly string[];
  try {
    names = readdirSync(typesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return {};
  }

  const index: TypeIndex = {};
  for (const name of names) {
    const resolved = resolveTypeUnitAt(pluginRoot, name);
    if (resolved === undefined) continue;
    const { unit } = resolved;
    const version = resolved.templateExists ? templateVersion(resolved.templatePath, unit.type) : undefined;
    index[unit.type] = {
      ...(version === undefined ? {} : { version }),
      template: path.relative(pluginRoot, resolved.templatePath),
      authoring: path.relative(pluginRoot, resolved.authoringPath),
      migrations: path.relative(pluginRoot, resolved.migrationsPath),
      schema: unit.schema,
      numbered: unit.numbered,
      pad: unit.pad,
      depth: unit.depth,
      dirs: unit.dirs,
    };
  }
  return index;
}

/** The exact bytes the committed index must hold — one serialiser, so the writer and the check agree. */
export function serialiseTypeIndex(index: TypeIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}
