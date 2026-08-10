// The programmatic API. A third-party package builds against this to define and run modules without
// going through the terminal.
export { loadModule, specifierFor, BUILTIN_PREFIX } from "./resolve.ts";
export { runModule, repoRootFrom } from "./run.ts";
export type { RunOptions } from "./run.ts";
export { buildServer, serveStdio, serveHttp } from "./mcp.ts";
