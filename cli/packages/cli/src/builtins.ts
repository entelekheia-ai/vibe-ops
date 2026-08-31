// The module set this CLI ships with, and therefore the set `vibe-ops mcp` exposes as tools when a
// repository's config does not name its own. Its own file rather than a constant in `bin.ts`: bin.ts
// runs `main()` at import time, so anything importing the list from there would start the CLI.

export const BUILTINS = ["check", "agents-md", "governance", "self", "mirror", "classification", "plan", "task", "log", "records", "harness"] as const;

/** The modules `vibe-ops mcp` would serve here — the config's list, or the built-ins. */
export function exposedModules(configured: readonly string[] | undefined): readonly string[] {
  return configured ?? BUILTINS;
}
