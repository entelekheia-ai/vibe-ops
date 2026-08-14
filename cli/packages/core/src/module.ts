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
  /**
   * Human-facing summary line. The CLI prints it; the MCP server returns it as tool text.
   *
   * **Required, and the empty result is the reason.** A run that found nothing used to return neither
   * `summary` nor `data`, so both surfaces printed nothing at all — and an empty string is not read as
   * "this surface rendered no report", it is read as "there is nothing", which is a different and often
   * false answer. Measured across the session corpus: four abandoned calls returned empty, and in every
   * one the caller distrusted the silence and re-derived the answer by hand rather than believing it.
   *
   * So a summary states what was looked for and where, even — especially — when the answer is none:
   * `"no incoherent plan among 12 in project/plans"` rather than nothing at all. There is deliberately
   * no `count` field beside it; a report array carries its own length, and the summary carries the
   * population.
   */
  readonly summary: string;
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
  /**
   * That this module's first positional argument names the repository to act on, so the CLI resolves
   * `repoRoot` from it instead of from the working directory, and removes it from `args`.
   *
   * It exists because a module may not touch `process.cwd()` — everything positional is resolved once,
   * by the CLI — and a relative path like `.` or `../other` cannot be resolved without it. `vibe-ops
   * check .` was therefore accepting an argument it silently ignored, keying off the working directory
   * instead: harmless for `.`, and wrong for every other value. Declaring the intent here lets the one
   * layer that legitimately knows the working directory do the resolution.
   *
   * Only for a module whose subject IS a repository. A module whose positionals are file paths
   * (`task close <dossier>…`) must not set it.
   */
  readonly repoFromFirstArg?: boolean;
  /**
   * That this module reads from the installed norm, not only from the repository it acts on, and needs
   * `context.sourceRoot` resolved. Set by a module comparing the target against what is installed —
   * `harness status` is the first. Absent means `sourceRoot` is never populated, even if a `--source`
   * flag or `CLAUDE_PLUGIN_ROOT` happen to be present, the same opt-in shape `emits` already has.
   */
  readonly needsSource?: boolean;
}

/**
 * The `--source` flag every `needsSource` module gets, without declaring it itself. One definition so the
 * terminal's parser, its `--help` output, and the MCP tool schema describe the same flag rather than three
 * hand-written copies drifting apart.
 */
export const SOURCE_FLAG: ModuleFlag = {
  name: "source",
  type: "string",
  description: "Root of the installed norm to compare against. Falls back to config.harness.source, then CLAUDE_PLUGIN_ROOT.",
};

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
