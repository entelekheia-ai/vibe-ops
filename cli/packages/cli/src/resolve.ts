// Turning what the user typed into a module.
//
// Convention plus dynamic import, the same way eita resolves a trait — deliberately no registry file
// and no manifest listing the built-ins. A registry is a second place to forget: a module that exists
// but was never added to it is invisible, and the failure looks like the module being broken.
//
// Three accepted forms, in the order they are tested:
//   check                  -> @entelekheia/vibe-ops-module-check   (a built-in, or anyone following it)
//   @scope/pkg             -> @scope/pkg                            (a third party, taken verbatim)
//   ./path or /path        -> that path                             (a module being developed)

import type { ModulePlugin } from "@entelekheia/vibe-ops-core";

export const BUILTIN_PREFIX = "@entelekheia/vibe-ops-module-";

export function specifierFor(name: string): string {
  if (name.startsWith("@") || name.startsWith(".") || name.startsWith("/")) return name;
  return `${BUILTIN_PREFIX}${name}`;
}

export async function loadModule(name: string): Promise<ModulePlugin> {
  const specifier = specifierFor(name);
  let imported: { default?: ModulePlugin };
  try {
    imported = (await import(specifier)) as { default?: ModulePlugin };
  } catch (cause) {
    throw new Error(
      `cannot load "${name}" (resolved to ${specifier}). ` +
        `A built-in is a package named ${BUILTIN_PREFIX}<name>; a third-party module is invoked by its ` +
        `full package name, and must be installed.`,
      { cause },
    );
  }
  const plugin = imported.default;
  if (plugin?.definition === undefined || typeof plugin.run !== "function") {
    throw new Error(`${specifier} does not default-export a module — expected the result of defineModule()`);
  }
  return plugin;
}
