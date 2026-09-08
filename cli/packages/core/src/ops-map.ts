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

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { VibeOpsConfig } from "./config.ts";
import type { ModulePlugin } from "./module.ts";
import type { OpsDefinition } from "./ops.ts";
import { defineOps } from "./ops.ts";
import { parseOpsDefinition } from "./ops-load.ts";

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

/**
 * What to hand `import()` for one declared ops — a package name unchanged, a PATH resolved against the
 * repository being checked.
 *
 * A relative specifier is the shape a repository writing its own detectors uses, and it is the one that
 * silently means something else: `import("./ops/local.mjs")` inside a built module resolves against
 * THAT MODULE'S directory, so a consumer's own ops resolved to a path under `module-check/dist/` and was
 * reported missing. Measured 2026-09-08 against a scratch repository, and the reason a repository could
 * not compose a detector of its own at all — which is the whole point of the config being the registry.
 *
 * `repoRoot` rather than the config file's own directory: an ops is declared by the repository being
 * checked, and the cascade means the file carrying the declaration may sit above it.
 */
export function opsSpecifier(declared: string, repoRoot: string): string {
  if (!declared.startsWith(".") && !declared.startsWith("/")) return declared;
  return pathToFileURL(path.resolve(repoRoot, declared)).href;
}

/**
 * One declared ops as a runnable module, whichever of the two forms `config.ops` used.
 *
 * A DECLARATION IS NOT ALWAYS A PACKAGE, and every caller of `opsSpecifier` had assumed it was. The
 * package form resolves to a module whose default export `defineOps` already built; the PATH form —
 * the whole point of the config being the registry — is a repository's own collection, and that is
 * data. An `ops.json` is not importable as a module at all (a JSON specifier needs an import attribute
 * and throws without one), and a `.mjs` collection default-exports the definition rather than the
 * plugin, so `.run` is not a function on it.
 *
 * Both failures were invisible in a different way at each call site: `check --self-test` reported
 * "self-test could not run", which reads as a broken ops; `harness catalog` swallowed it and skipped
 * the ops, so its gates were reported as available-but-uncomposed while the gate was running them
 * every commit. Found by eita, whose `.vibe-ops/ops.json` is exactly this shape.
 */
export async function loadOpsPlugin(specifier: string): Promise<ModulePlugin> {
  if (specifier.startsWith("file:") && specifier.endsWith(".json")) {
    const file = fileURLToPath(specifier);
    return defineOps(parseOpsDefinition(readFileSync(file, "utf8"), file));
  }
  const loaded = (await import(specifier)) as { default: unknown };
  const value = loaded.default;
  if (value !== null && typeof value === "object" && typeof (value as ModulePlugin).run === "function") {
    return value as ModulePlugin;
  }
  // A collection authored in JavaScript: the definition, not the plugin. Passing it through defineOps is
  // exactly what the package form's own `src/index.ts` does, so the two forms compose identically here.
  if (value !== null && typeof value === "object" && Array.isArray((value as { gates?: unknown }).gates)) {
    return defineOps(value as OpsDefinition);
  }
  throw new Error(
    `${specifier} default-exports neither an ops plugin nor an ops definition — expected the result of ` +
      `defineOps(), or the definition it takes`,
  );
}
