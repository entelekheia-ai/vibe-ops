#!/usr/bin/env node
// vibe-ops — the terminal surface.
//
//   vibe-ops check [--verbose]        a built-in module
//   vibe-ops @scope/pkg --command     a third-party module, by package name
//   vibe-ops mcp [--http --port N]    every module, as MCP tools
//   vibe-ops --help

import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import { loadConfig } from "@entelekheia/vibe-ops-core";
import { loadModule } from "./resolve.ts";
import { runModule, repoRootFrom } from "./run.ts";
import { serveHttp, serveStdio } from "./mcp.ts";

const BUILTINS = ["check", "agents-md"] as const;

function usage(): void {
  p.note(
    [
      "vibe-ops <module> [flags]     run a module (built-in: " + BUILTINS.join(", ") + ")",
      "vibe-ops @scope/pkg [flags]   run a third-party module by package name",
      "vibe-ops ./path [flags]       run a module from a local path",
      "vibe-ops mcp [--http] [--port N]",
      "",
      "Configuration cascades from vibeops.config.ts in the repository up to your home directory.",
    ].join("\n"),
    "vibe-ops",
  );
}

/** Flags are parsed against what the module declares, so an unknown flag is caught rather than ignored. */
async function runNamed(name: string, argv: string[]): Promise<number> {
  const plugin = await loadModule(name);
  const options: Record<string, { type: "string" | "boolean" }> = {};
  for (const flag of plugin.definition.flags ?? []) options[flag.name] = { type: flag.type };

  let parsed;
  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true, strict: true });
  } catch (error) {
    p.log.error(`${(error as Error).message}`);
    p.note(
      (plugin.definition.flags ?? []).map((f) => `--${f.name.padEnd(12)} ${f.description}`).join("\n") || "(no flags)",
      `${plugin.definition.id} flags`,
    );
    return 2;
  }

  if (plugin.definition.destructive === true && process.stdout.isTTY) {
    const ok = await p.confirm({ message: `${plugin.definition.id} makes irreversible changes. Continue?` });
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
    sink: (message) => process.stdout.write(`${message}\n`),
  });

  if (result.summary !== undefined) {
    if (result.code === 0) p.log.success(result.summary);
    else p.log.error(result.summary);
  }
  return result.code;
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === "-h" || command === "--help") {
    usage();
    return command === undefined ? 2 : 0;
  }

  if (command === "mcp") {
    const { values } = parseArgs({
      args: rest,
      options: { http: { type: "boolean" }, port: { type: "string", default: "7337" } },
      strict: true,
    });
    const { config } = await loadConfig(repoRootFrom(process.cwd()));
    const modules = config.modules ?? BUILTINS;
    if (values.http === true) await serveHttp(modules, Number(values.port));
    else await serveStdio(modules);
    // Never returns. Both transports are event-driven, so returning an exit code here would let the
    // caller below tear the server down the instant it finished connecting.
    return await new Promise<number>(() => {});
  }

  return runNamed(command, rest);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
