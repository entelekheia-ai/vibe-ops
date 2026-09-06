// The module set this CLI ships with, and therefore the set `vibe-ops mcp` exposes as tools when a
// repository's config does not name its own. The list itself is core's (`BUILTIN_MODULES`), so the
// `modules-omits-builtin` gate can read it without importing this package — bin.ts runs `main()` at
// import time, so anything importing from there would start the CLI.

import { BUILTIN_MODULES } from "@entelekheia/vibe-ops-core";

export const BUILTINS = BUILTIN_MODULES;

/** The modules `vibe-ops mcp` would serve here — the config's list, or the built-ins. */
export function exposedModules(configured: readonly string[] | undefined): readonly string[] {
  return configured ?? BUILTINS;
}
