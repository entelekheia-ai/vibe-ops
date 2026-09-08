// Turning what the user typed into a module.
//
// A GOVERNANCE NOUN ROUTES THROUGH THE EFFECTIVE MAP FIRST (Plan-033, ADR-0019): shipped defaults
// overlaid by the repository's `config.types`, so `vibe-ops plan` imports whichever package the config
// binds — the config is the registry for the governances. Everything else keeps convention plus
// dynamic import, the same way eita resolves a trait — deliberately no registry file and no manifest
// listing the (non-governance) built-ins. A registry is a second place to forget: a module that exists
// but was never added to it is invisible, and the failure looks like the module being broken.
//
// Accepted forms, in the order they are tested:
//   plan                   -> the package `config.types`/the defaults bind for "plan"
//   check                  -> @entelekheia/vibe-ops-module-check   (a legacy built-in)
//                           -> @entelekheia/vibe-ops-<name>         (a gates/ops built-in, tried next)
//   @scope/pkg             -> @scope/pkg                            (a third party, taken verbatim)
//   ./path or /path        -> that path                             (a module being developed)
//
// A bare name tries BOTH built-in prefixes because the two generations of built-in coexist: `check` is
// still `module-check` (RFC-0001 leaves the seventeen shell fragments in place until they are shown to
// agree with their ported gates), while `agents-md` is `@entelekheia/vibe-ops-agents-md` — an ops, not
// a `module-`. Trying the legacy prefix first costs nothing once both fail: import() rejects fast on a
// name that resolves to nothing installed.

import { effectiveGovernanceBindings, setHostResolver } from "@entelekheia/vibe-ops-core";
import type { ModulePlugin, VibeOpsConfig } from "@entelekheia/vibe-ops-core";

// Core loads gates, ops and governance packages by name on this CLI's behalf, and a bare specifier
// resolves from the module that wrote it — core's own dist/, whose resolution only walks up. Where this
// executable carries its own copies (a bundled install, a pnpm store, a consumer pinning two versions)
// that is a different directory, and core reports the package as absent. Handing core this CLI's
// resolver makes it look here first; the fallback to its own resolution is unchanged.
setHostResolver((specifier) => import.meta.resolve(specifier));

export const BUILTIN_PREFIX = "@entelekheia/vibe-ops-module-";
export const OPS_PREFIX = "@entelekheia/vibe-ops-";

export function specifierFor(name: string): string {
  if (name.startsWith("@") || name.startsWith(".") || name.startsWith("/")) return name;
  return `${BUILTIN_PREFIX}${name}`;
}

async function importDefault(specifier: string): Promise<ModulePlugin | undefined> {
  try {
    const imported = (await import(specifier)) as { default?: ModulePlugin };
    return imported.default;
  } catch {
    return undefined;
  }
}

export async function loadModule(name: string, config?: VibeOpsConfig): Promise<ModulePlugin> {
  const isBare = !name.startsWith("@") && !name.startsWith(".") && !name.startsWith("/");

  // The governance map outranks the conventions: a bound noun is the repository's explicit routing,
  // and the shipped defaults make the five governances resolvable with no config at all. Falls through
  // when the bound package is not installed, so a misconfigured binding still reports through the
  // ordinary cannot-load path naming what was tried.
  if (isBare) {
    const binding = effectiveGovernanceBindings(config)[name];
    if (binding !== undefined) {
      const bound = await importDefault(binding.packageName);
      if (bound !== undefined && bound.definition !== undefined && typeof bound.run === "function") return bound;
    }
  }

  const specifier = specifierFor(name);
  let plugin = await importDefault(specifier);
  let resolved = specifier;

  if (plugin === undefined && isBare) {
    const opsSpecifier = `${OPS_PREFIX}${name}`;
    plugin = await importDefault(opsSpecifier);
    resolved = opsSpecifier;
  }

  if (plugin === undefined) {
    throw new Error(
      `cannot load "${name}"` +
        (isBare ? ` (tried ${specifier} and ${OPS_PREFIX}${name})` : ` (resolved to ${specifier})`) +
        `. A built-in is a package named ${BUILTIN_PREFIX}<name> or ${OPS_PREFIX}<name>; a third-party ` +
        `module is invoked by its full package name, and must be installed.`,
    );
  }
  if (plugin.definition === undefined || typeof plugin.run !== "function") {
    throw new Error(`${resolved} does not default-export a module — expected the result of defineModule() or defineOps()`);
  }
  return plugin;
}
