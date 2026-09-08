// Which ops a repository composes — Plan-038 Track 6, the same answer ADR-0019 already gave for
// governance types: the config is the registry.
//
// THERE WAS NO ANSWER BEFORE THIS FILE. An ops ran if its package happened to resolve, so what a
// repository checked was a property of its node_modules rather than of anything it had said. Two
// consequences, both measured: `mirror` and `exposure` are in no package's dependency list and worked
// here only through workspace symlinks, and three separate hand-kept copies of "the five ops" had drifted
// into module-check and the harness.
//
// THE DEFAULTS ARE THE PORTABLE THREE, AND THAT IS THE PRODUCT STATEMENT. `governance`, `agents-md` and
// `exposure` name nothing outside the repository being checked. `mirror` and `for-vibe-ops` name this
// repository's own paths in every entry, so this repository declares them in its own config like any
// other consumer would — which is what keeps the extension mechanism honest: the tool's own needs go
// through the door it gives everyone else.
//
// FALSE REMOVES, AND IT IS THE ONLY WAY TO DROP A DEFAULT. `{...DEFAULT_OPS, ...config.ops}` cannot
// express an absence, and an array that replaces the defaults wholesale makes adding one ops mean
// restating all of them — which is how this repository's own `modules` list fell five nouns behind
// (measured 2026-09-06 by the gate written that day).
//
// ACTIVATION IMPORTS, exactly as `governance-map.ts` argues: a config binding is the repository's
// explicit trust declaration, and the import is dynamic, so core gains no compile-time edge to any ops.

import type { VibeOpsConfig } from "./config.ts";

/** The shipped composition — the ops that name nothing outside the repository being checked. */
export const DEFAULT_OPS: Readonly<Record<string, string>> = {
  governance: "@entelekheia/vibe-ops-governance",
  "agents-md": "@entelekheia/vibe-ops-agents-md",
  exposure: "@entelekheia/vibe-ops-exposure",
};

/**
 * The effective composition: shipped defaults overlaid per key by `config.ops`, with `false` removing a
 * default outright. Key order is defaults first, then whatever the repository added — so a run reports
 * the portable three in a stable order and a repository's own additions after them.
 */
export function effectiveOps(config: VibeOpsConfig | undefined): Readonly<Record<string, string>> {
  const merged: Record<string, string> = {};
  for (const [name, value] of Object.entries({ ...DEFAULT_OPS, ...config?.ops })) {
    if (value === false) continue;
    merged[name] = value;
  }
  return merged;
}
