// What a module is handed. One object, so a module never reaches for process.argv, process.cwd() or
// the filesystem layout on its own — everything positional is resolved once, by the CLI, and a module
// running under MCP gets the identical shape as one running from a terminal.

import type { VibeOpsConfig } from "./config.ts";
import type { Emitter } from "./emit.ts";

/**
 * How the caller reached this module. A module that prints, prompts, or asks for confirmation must
 * branch on it: under `mcp` there is no terminal, and writing to stdout corrupts the stdio transport.
 */
export type Surface = "cli" | "mcp";

export interface ModuleContext {
  /** Absolute path to the repository being acted on. */
  readonly repoRoot: string;
  /** Parsed flags, already validated against the module's declared `flags`. */
  readonly flags: Readonly<Record<string, string | boolean>>;
  /** Positional arguments after the module name. */
  readonly args: readonly string[];
  readonly config: VibeOpsConfig;
  /** This module's slice of `config.settings`, resolved by id. */
  readonly settings: unknown;
  readonly surface: Surface;
  /**
   * Present only when the module's definition declares `emits`. Absent means this module was never
   * meant to record anything, so there is nothing to remember not to call.
   */
  readonly emit?: Emitter;
  /** Never process.stdout directly: under MCP these are buffered into the tool result instead. */
  readonly log: (message: string) => void;
  readonly warn: (message: string) => void;
}
