// Building a ModuleContext and running a module. Shared by the terminal and by MCP, so a module
// behaves identically on both — the only difference is the `surface` it is told about and where its
// log lines go.

import { createEmitter, loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext, ModulePlugin, ModuleResult, Surface, VibeOpsConfig } from "@entelekheia/vibe-ops-core";
import { spawnSync } from "node:child_process";
import path from "node:path";

export interface RunOptions {
  readonly plugin: ModulePlugin;
  readonly flags: Record<string, string | boolean>;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly surface: Surface;
  readonly sink: (message: string) => void;
  /** The verb dispatched, for a module declaring `commands`. See `ModuleContext.command`. */
  readonly command?: string;
  /**
   * That the caller has already obtained consent for a `destructive` command. The terminal sets it after
   * its own prompt; MCP has no prompt to run, so it sets it only from an explicit `confirm` in the tool
   * input. Absent on a destructive command, the run is refused rather than performed.
   */
  readonly confirmed?: boolean;
}

export function repoRootFrom(cwd: string): string {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  const found = (result.stdout ?? "").trim();
  return found === "" ? path.resolve(cwd) : found;
}

/**
 * Where the installed norm lives, for a `needsSource` module. Most-intentional wins: a repository or
 * operator that declared `harness.source` in config outranks the `--source` flag on this one invocation,
 * which in turn outranks `CLAUDE_PLUGIN_ROOT` — the implicit fallback the hook wiring already provides.
 * `undefined` when none of the three resolve; a module reading `context.sourceRoot` must treat that as
 * "nothing to compare against", not as an error.
 */
export function resolveSourceRoot(
  config: VibeOpsConfig,
  flagValue: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return config.harness?.source ?? flagValue ?? env["CLAUDE_PLUGIN_ROOT"];
}

export async function runModule(options: RunOptions): Promise<ModuleResult> {
  const { plugin, flags, args, cwd, surface, sink, command, confirmed } = options;

  // Authoritative here, not only in the terminal's own dispatch — the terminal validates early to pick
  // the right flag set to parse, but MCP hands `command` straight through with no such gate, so an
  // unknown or missing verb must be caught once, in the one place both surfaces call through.
  const commands = plugin.definition.commands;
  const commandDef = commands?.find((c) => c.name === command);
  if (commands !== undefined) {
    const names = commands.map((c) => c.name);
    if (command === undefined || commandDef === undefined) {
      return {
        code: 2,
        summary:
          command === undefined
            ? `${plugin.definition.id} needs a command: ${names.join(", ")}`
            : `${plugin.definition.id} has no command "${command}" — valid: ${names.join(", ")}`,
      };
    }
  }

  // A destructive run under MCP has no terminal to prompt at, and a caller that never saw a prompt has
  // not consented to anything. The terminal's own confirmation is a TTY prompt and is passed in as
  // `confirmed`; MCP's is an explicit `confirm: true` in the tool input. Neither surface may skip it by
  // being the surface it is — this is the one gate that must not live in `bin.ts`, because bin.ts is
  // exactly the file MCP does not go through.
  if ((commandDef?.destructive ?? plugin.definition.destructive) === true && confirmed !== true) {
    return {
      code: 2,
      summary:
        surface === "mcp"
          ? `${plugin.definition.id} ${String(command ?? "")} is destructive — re-send with confirm: true to run it`.trim()
          : `${plugin.definition.id} ${String(command ?? "")} is destructive and was not confirmed`.trim(),
    };
  }

  // A module declaring `repoFromFirstArg` is asking for its first positional to name the repository.
  // Resolved here and nowhere else: this is the layer that knows the working directory, and the module
  // contract forbids the module from reading it. The argument is consumed, so the module never sees a
  // positional it is not supposed to interpret.
  const takesRepoArg = plugin.definition.repoFromFirstArg === true && args.length > 0;
  const repoRoot = takesRepoArg ? repoRootFrom(path.resolve(cwd, args[0]!)) : repoRootFrom(cwd);
  const remainingArgs = takesRepoArg ? args.slice(1) : args;
  const { config } = await loadConfig(repoRoot);

  // Defaults come from the definition, so a module reads context.flags without re-deriving them and
  // a flag it never declared cannot silently arrive.
  const resolved: Record<string, string | boolean> = {};
  for (const flag of plugin.definition.flags ?? []) {
    if (flag.default !== undefined) resolved[flag.name] = flag.default;
  }
  Object.assign(resolved, flags);

  // Emission is doubly opt-in: the module declares `emits`, and the config names a destination.
  // Either alone produces no emitter, so nothing is ever recorded to a place nobody chose.
  const emit =
    plugin.definition.emits && config.artifactDir
      ? createEmitter({
          artifactDir: path.resolve(repoRoot, config.artifactDir),
          moduleId: plugin.definition.id,
          moduleVersion: plugin.definition.version,
          repoRoot,
          declared: plugin.definition.emits,
          now: () => new Date().toISOString(),
        })
      : undefined;

  // Only for a module that asked for it — the same opt-in shape `emits` already has. `flags.source` is
  // read raw here, before defaults are applied above, because there is no sensible default for it.
  const sourceRoot =
    plugin.definition.needsSource === true
      ? resolveSourceRoot(config, typeof flags["source"] === "string" ? flags["source"] : undefined)
      : undefined;

  const context: ModuleContext = {
    repoRoot,
    flags: resolved,
    args: remainingArgs,
    command,
    config,
    settings: settingsFor(config, plugin.definition.id),
    surface,
    sourceRoot,
    emit,
    log: sink,
    warn: (message) => sink(`warning: ${message}`),
  };

  return plugin.run(context);
}
