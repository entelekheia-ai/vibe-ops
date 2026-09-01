// What a module is handed. One object, so a module never reaches for process.argv, process.cwd() or
// the filesystem layout on its own — everything positional is resolved once, by the CLI, and a module
// running under MCP gets the identical shape as one running from a terminal.

import type { VibeOpsConfig } from "./config.ts";
import type { Emitter } from "./emit.ts";

/**
 * How the caller reached this module. A module that prints, prompts, or asks for confirmation must
 * branch on it: under `mcp` there is no terminal, and writing to stdout corrupts the stdio transport.
 * `hook` is the same constraint for a different reason — stdout there is one line of hook-protocol
 * JSON, so a module printing through `log`/`warn` would corrupt that instead.
 */
export type Surface = "cli" | "mcp" | "hook";

export interface ModuleContext {
  /** Absolute path to the repository being acted on. */
  readonly repoRoot: string;
  /** Parsed flags, already validated against the module's declared `flags`. */
  readonly flags: Readonly<Record<string, string | boolean>>;
  /** Positional arguments after the module name (or after the command, when one was dispatched). */
  readonly args: readonly string[];
  /**
   * The verb dispatched, when the module declares `commands` — `"status"` for `vibe-ops plan status`.
   * Absent for a module with no `commands`, which is every module before this field existed.
   */
  readonly command?: string;
  readonly config: VibeOpsConfig;
  /** This module's slice of `config.settings`, resolved by id. */
  readonly settings: unknown;
  /**
   * Where the installed norm lives, for a module that declares `needsSource: true`. Resolved once by
   * `runModule`, highest-priority match wins: `config.harness.source`, then the `--source` flag, then
   * `process.env.CLAUDE_PLUGIN_ROOT`. Undefined when none of the three resolve — a module reading this
   * must treat that as "nothing to compare against", not as an error.
   */
  readonly sourceRoot?: string;
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
