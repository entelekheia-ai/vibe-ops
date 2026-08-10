// Building a ModuleContext and running a module. Shared by the terminal and by MCP, so a module
// behaves identically on both — the only difference is the `surface` it is told about and where its
// log lines go.

import { createEmitter, loadConfig, settingsFor } from "@entelekheia/vibe-ops-core";
import type { ModuleContext, ModulePlugin, ModuleResult, Surface } from "@entelekheia/vibe-ops-core";
import { spawnSync } from "node:child_process";
import path from "node:path";

export interface RunOptions {
  readonly plugin: ModulePlugin;
  readonly flags: Record<string, string | boolean>;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly surface: Surface;
  readonly sink: (message: string) => void;
}

export function repoRootFrom(cwd: string): string {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  const found = (result.stdout ?? "").trim();
  return found === "" ? path.resolve(cwd) : found;
}

export async function runModule(options: RunOptions): Promise<ModuleResult> {
  const { plugin, flags, args, cwd, surface, sink } = options;
  const repoRoot = repoRootFrom(cwd);
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

  const context: ModuleContext = {
    repoRoot,
    flags: resolved,
    args,
    config,
    settings: settingsFor(config, plugin.definition.id),
    surface,
    emit,
    log: sink,
    warn: (message) => sink(`warning: ${message}`),
  };

  return plugin.run(context);
}
