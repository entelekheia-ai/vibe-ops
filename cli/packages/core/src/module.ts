// The activatable contract. Anything that default-exports the result of defineModule() can be run as
// `vibe-ops <name>` or `vibe-ops @scope/pkg --command`, and is discoverable by the MCP server without
// a second declaration.
//
// Deliberately the same shape as eita's defineTrait: a validated `definition` describing what this is,
// plus one `run` function. The definition is what every other surface reads — help text, the MCP tool
// list, the config schema — so a module that describes itself wrongly is wrong everywhere at once,
// rather than in one surface that nobody checks.

import type { ModuleContext } from "./context.ts";

/** What a module reports back. `code` is the process exit code when run from the CLI. */
export interface ModuleResult {
  readonly code: number;
  /** Human-facing summary line. The CLI prints it; the MCP server returns it as tool text. */
  readonly summary?: string;
  /** Structured payload, returned verbatim by MCP. Must be JSON-serializable. */
  readonly data?: unknown;
}

/** One flag a module accepts. Parsed by the CLI and advertised as an MCP tool input. */
export interface ModuleFlag {
  readonly name: string;
  readonly type: "string" | "boolean";
  readonly description: string;
  readonly default?: string | boolean;
  /**
   * A `string` flag's value when the caller writes the bare `--name` with nothing after it. Node's
   * `parseArgs` rejects that on a `string` option, so the CLI rewrites `--name` to `--name=<implicit>`
   * before parsing — which is what lets `--fix` mean "everything" while `--fix pairing` still means one
   * gate. Unused on a `boolean` flag, which already has this for free.
   */
  readonly implicit?: string;
}

/**
 * One verb under a noun module — `vibe-ops plan status`, not a module of its own. A module that
 * declares `commands` is dispatched by its first positional argument; one that does not keeps today's
 * flat shape. `flags` here are merged with the module's own for this verb only, so `plan status` and
 * `plan close` do not have to share a single flag namespace.
 */
export interface ModuleCommand {
  readonly name: string;
  /** One line. Shown under the noun in `vibe-ops --help` and as this verb's MCP enum description. */
  readonly summary: string;
  readonly flags?: readonly ModuleFlag[];
  /** Overrides the module's own `destructive` for this verb only — `task close` confirms, `task resolve` does not. */
  readonly destructive?: boolean;
}

export interface ModuleDefinition {
  /** Invocation name: `vibe-ops <id>`. Lowercase, hyphenated. */
  readonly id: string;
  readonly version: string;
  /** One line. Shown in `vibe-ops --help` and used as the MCP tool description. */
  readonly summary: string;
  readonly flags?: readonly ModuleFlag[];
  /**
   * Verbs this module dispatches on its first positional argument — `vibe-ops plan status`. Absent
   * means the module has no noun/verb split and reads `context.args` itself, today's shape. Declaring
   * an empty array is rejected: it would make the module look command-shaped everywhere (an MCP
   * `command` enum with no members, `--help` printing an empty verb list) while having none.
   */
  readonly commands?: readonly ModuleCommand[];
  /**
   * Whether this module observes something worth recording. A module that declares `emits` gets an
   * eita emitter on its context; one that does not gets `undefined` and cannot record by accident.
   * Monitoring is opt-in per module precisely because most of them are actions, not observations.
   */
  readonly emits?: readonly string[];
  /** Set when the module must not run unattended — the CLI confirms before invoking it. */
  readonly destructive?: boolean;
}

export interface ModulePlugin {
  readonly definition: ModuleDefinition;
  run(context: ModuleContext): Promise<ModuleResult>;
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export function defineModule(
  definition: ModuleDefinition,
  run: (context: ModuleContext) => Promise<ModuleResult>,
): ModulePlugin {
  if (!ID_PATTERN.test(definition.id)) {
    throw new Error(`module id "${definition.id}" must be lowercase, starting with a letter`);
  }
  if (definition.summary.trim() === "") {
    throw new Error(`module "${definition.id}" declares no summary — it would be invisible in --help and in MCP`);
  }
  const seen = new Set<string>();
  for (const flag of definition.flags ?? []) {
    if (seen.has(flag.name)) throw new Error(`module "${definition.id}" declares --${flag.name} twice`);
    seen.add(flag.name);
  }
  if (definition.commands !== undefined) {
    if (definition.commands.length === 0) {
      throw new Error(
        `module "${definition.id}" declares an empty commands array — omit the field instead of a` +
          ` command-shaped module with no commands`,
      );
    }
    const seenCommands = new Set<string>();
    for (const command of definition.commands) {
      if (!ID_PATTERN.test(command.name)) {
        throw new Error(`module "${definition.id}" declares command "${command.name}" — must be lowercase, starting with a letter`);
      }
      if (seenCommands.has(command.name)) {
        throw new Error(`module "${definition.id}" declares command "${command.name}" twice`);
      }
      seenCommands.add(command.name);
      if (command.summary.trim() === "") {
        throw new Error(`module "${definition.id}" command "${command.name}" declares no summary`);
      }
      const seenCommandFlags = new Set<string>();
      for (const flag of command.flags ?? []) {
        if (seenCommandFlags.has(flag.name)) {
          throw new Error(`module "${definition.id}" command "${command.name}" declares --${flag.name} twice`);
        }
        seenCommandFlags.add(flag.name);
      }
    }
  }
  return { definition, run };
}
