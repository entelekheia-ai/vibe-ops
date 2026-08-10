// Turning what the user typed into a module.
//
// Convention plus dynamic import, the same way eita resolves a trait — deliberately no registry file
// and no manifest listing the built-ins. A registry is a second place to forget: a module that exists
// but was never added to it is invisible, and the failure looks like the module being broken.
//
// Four accepted forms, in the order they are tested:
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

import type { ModulePlugin } from "@entelekheia/vibe-ops-core";

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

export async function loadModule(name: string): Promise<ModulePlugin> {
  const isBare = !name.startsWith("@") && !name.startsWith(".") && !name.startsWith("/");
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
