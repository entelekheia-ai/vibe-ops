// The module set the CLI ships with — the set `vibe-ops mcp` exposes as tools when a repository's config
// names no `modules` of its own, and the set a gate compares a declared list against. It lives in core
// rather than in the CLI so a gate can read it without importing the CLI, which would run `main()`.

export const BUILTIN_MODULES = [
  "check",
  "agents-md",
  "governance",
  "for-vibe-ops",
  "mirror",
  "exposure",
  "plan",
  "task",
  "log",
  "records",
  "harness",
  "config",
  "ownership",
  "setup",
] as const;

export type BuiltinModule = (typeof BUILTIN_MODULES)[number];
