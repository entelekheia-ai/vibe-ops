#!/usr/bin/env node
// vibe-ops — the terminal surface.
//
//   vibe-ops check [--verbose]        a built-in module
//   vibe-ops @scope/pkg --command     a third-party module, by package name
//   vibe-ops mcp [--http --port N]    every module, as MCP tools
//   vibe-ops hook <surface> [args]    every surface that reads a hook payload on stdin:
//                                       ops <ops> [flags]  PostToolUse, an ops over the written file
//                                       plan-context       UserPromptSubmit, the plan format in plan mode
//                                       plan-file          PostToolUse, files an approved plan-mode plan
//                                       plan-status        PostToolUse, the coherence read on a written plan
//                                       new-context        UserPromptExpansion, before a typed /vibe-ops:new
//                                       task-guard         PreToolUse, refuses an unclosed dossier deletion
//                                       prefer-mcp         PreToolUse, TEMPORARY: names the MCP equivalent
//   vibe-ops --help

import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import { loadConfig } from "@entelekheia/vibe-ops-core";
import type { ModuleCommand } from "@entelekheia/vibe-ops-core";
import { loadModule } from "./resolve.ts";
import { runModule, repoRootFrom } from "./run.ts";
import { serveHttp, serveStdio } from "./mcp.ts";
import { applyImplicitFlags } from "./flags.ts";
import { runHook, HOOK_SURFACES } from "./hook.ts";
import { BUILTINS, exposedModules } from "./builtins.ts";

/**
 * A built-in declaring `commands` gets its verbs listed under it in `--help` — otherwise a noun module
 * looks identical to a flat one until someone reads its source. Best-effort: a built-in that fails to
 * load (a broken workspace link) is skipped rather than taking `--help` down with it.
 */
async function verbLinesFor(names: readonly string[]): Promise<string[]> {
  const lines: string[] = [];
  for (const name of names) {
    try {
      const { definition } = await loadModule(name);
      if (definition.commands === undefined) continue;
      lines.push(`  ${name} <${definition.commands.map((c) => c.name).join("|")}>`);
    } catch {
      // Not this function's job to explain a broken built-in — runNamed() will, if invoked directly.
    }
  }
  return lines;
}

async function usage(): Promise<void> {
  const verbLines = await verbLinesFor(BUILTINS);
  p.note(
    [
      "vibe-ops <module> [flags]     run a module (built-in: " + BUILTINS.join(", ") + ")",
      ...verbLines,
      "vibe-ops @scope/pkg [flags]   run a third-party module by package name",
      "vibe-ops ./path [flags]       run a module from a local path",
      "vibe-ops mcp [--http] [--port N]",
      "vibe-ops hook <surface>       reads a hook payload on stdin (" + HOOK_SURFACES.join(", ") + ")",
      "",
      "Configuration cascades from vibeops.config.ts in the repository up to your home directory.",
    ].join("\n"),
    "vibe-ops",
  );
}

/** Flags are parsed against what the module declares, so an unknown flag is caught rather than ignored. */
async function runNamed(name: string, argv: string[]): Promise<number> {
  const plugin = await loadModule(name);
  const commands = plugin.definition.commands;

  // A module declaring `commands` is dispatched by its first positional argument. Flag parsing happens
  // AFTER the command is known, because a command's own flags are only valid for that verb — `plan
  // status` and `plan close` do not share a flag namespace.
  let command: string | undefined;
  let rest = argv;
  let commandDef: ModuleCommand | undefined;
  if (commands !== undefined) {
    const [first, ...tail] = argv;
    commandDef = commands.find((c) => c.name === first);
    if (commandDef === undefined) {
      const names = commands.map((c) => c.name).join(", ");
      p.log.error(
        first === undefined
          ? `${plugin.definition.id} needs a command: ${names}`
          : `${plugin.definition.id} has no command "${first}" — valid: ${names}`,
      );
      return 2;
    }
    command = first;
    rest = tail;
  }

  const declaredFlags = [...(plugin.definition.flags ?? []), ...(commandDef?.flags ?? [])];
  const options: Record<string, { type: "string" | "boolean" }> = {};
  for (const flag of declaredFlags) options[flag.name] = { type: flag.type };

  let parsed;
  try {
    parsed = parseArgs({
      args: applyImplicitFlags(rest, declaredFlags),
      options,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    p.log.error(`${(error as Error).message}`);
    p.note(
      declaredFlags.map((f) => `--${f.name.padEnd(12)} ${f.description}`).join("\n") || "(no flags)",
      command !== undefined ? `${plugin.definition.id} ${command} flags` : `${plugin.definition.id} flags`,
    );
    return 2;
  }

  const destructive = commandDef?.destructive ?? plugin.definition.destructive;
  if (destructive === true && process.stdout.isTTY) {
    const label = command !== undefined ? `${plugin.definition.id} ${command}` : plugin.definition.id;
    const ok = await p.confirm({ message: `${label} makes irreversible changes. Continue?` });
    if (p.isCancel(ok) || !ok) {
      p.cancel("cancelled");
      return 130;
    }
  }

  const result = await runModule({
    plugin,
    flags: parsed.values as Record<string, string | boolean>,
    args: parsed.positionals,
    cwd: process.cwd(),
    surface: "cli",
    command,
    // The terminal's consent is the prompt above; without a TTY there is nobody to prompt, and this
    // surface keeps the behaviour it has always had — a skill invokes `task close` through a Bash tool,
    // never a terminal, and does its own previewing and confirming before it gets here. MCP is the
    // surface with no such story, which is why the gate in runModule exists and why only it is refused.
    confirmed: true,
    sink: (message) => process.stdout.write(`${message}\n`),
  });

  // A module that declares `--json` stops writing lines and returns `data` instead, and until now only
  // MCP ever rendered that field — so on a terminal `--json` printed NOTHING and exited 0, for every
  // module that has the flag. An empty success is the worst shape a query can have: it reads as "there
  // is nothing", which is a real answer, rather than as "this surface did not render it".
  //
  // Raw stdout, not `p.log`: the whole point of the flag is to be piped into `jq`, and the prompt
  // library's framing characters would corrupt it.
  if (parsed.values.json === true && result.data !== undefined) {
    process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
  }

  if (result.summary !== undefined) {
    if (result.code === 0) p.log.success(result.summary);
    else p.log.error(result.summary);
  }
  return result.code;
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "-h" || command === "--help") {
    await usage();
    return command === undefined ? 2 : 0;
  }

  if (command === "mcp") {
    const { values } = parseArgs({
      args: rest,
      options: { http: { type: "boolean" }, port: { type: "string", default: "7337" } },
      strict: true,
    });
    const { config } = await loadConfig(repoRootFrom(process.cwd()));
    const modules = exposedModules(config.modules);
    if (values.http === true) await serveHttp(modules, Number(values.port));
    else await serveStdio(modules);
    // Never returns. Both transports are event-driven, so returning an exit code here would let the
    // caller below tear the server down the instant it finished connecting.
    return await new Promise<number>(() => {});
  }

  if (command === "hook") {
    return runHook(rest);
  }

  return runNamed(command, rest);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
