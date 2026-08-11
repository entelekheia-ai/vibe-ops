// The MCP surface. Every module is a tool, derived from the same `definition` the terminal reads —
// there is no second list to keep in step.
//
// STATELESS by construction. A new McpServer and a new transport are built per request, with
// `sessionIdGenerator: undefined`, and nothing is retained between calls. That is the point: these
// modules act on a repository on disk, so the repository IS the state. A session would add a second,
// weaker copy of it that goes stale the moment anything else writes to the tree.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { ModulePlugin } from "@entelekheia/vibe-ops-core";
import { loadModule } from "./resolve.ts";
import { runModule } from "./run.ts";
import { createServer } from "node:http";

function shapeFor(plugin: ModulePlugin): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {
    repo: z.string().optional().describe("Path inside the repository to act on. Defaults to the server's cwd."),
  };
  const { commands } = plugin.definition;
  if (commands !== undefined) {
    const names = commands.map((c) => c.name) as [string, ...string[]];
    const description = commands.map((c) => `${c.name}: ${c.summary}`).join(" | ");
    shape.command = z.enum(names).describe(description);
  }

  // Positional arguments, which every surface but this one already had. `mcp.ts` passed `args: []` and
  // nothing else, so a verb taking positionals — `task close <dossier>...`, `task guard <dossier>...` —
  // was reachable from a terminal and from nowhere else, failing over MCP as an empty batch rather than
  // as a missing input. Declared for every tool: nothing in a definition says "this command takes
  // positionals", and one static shape per tool is the same trade the flag union below already makes.
  shape.args = z
    .array(z.string())
    .optional()
    .describe("Positional arguments for the command — e.g. the dossier paths for task close/guard.");

  // A destructive command has a confirmation step on every other surface: the terminal prompts, and a
  // skill previews with --dry-run and waits. This is that step here. There is no prompt to run inside a
  // tool call, so consent has to be something the caller sends; `runModule` is what enforces it, because
  // `bin.ts` — where the terminal's prompt lives — is exactly the file this surface does not go through.
  if ((commands ?? []).some((c) => c.destructive === true) || plugin.definition.destructive === true) {
    shape.confirm = z
      .boolean()
      .optional()
      .describe("Required to run a destructive command. Preview with dry-run first; this is not undoable.");
  }
  // Flags are unioned across every command (plus the module's own) rather than scoped per command —
  // an MCP input schema is one static shape per tool, not one per enum value, so a flag valid only
  // for one verb still appears for the others; the module itself rejects a flag its dispatched verb
  // does not use, the same way the terminal does.
  const allFlags = [...(plugin.definition.flags ?? []), ...(commands ?? []).flatMap((c) => c.flags ?? [])];
  const seen = new Set<string>();
  for (const flag of allFlags) {
    if (seen.has(flag.name)) continue;
    seen.add(flag.name);
    shape[flag.name] =
      flag.type === "boolean"
        ? z.boolean().optional().describe(flag.description)
        : z.string().optional().describe(flag.description);
  }
  return shape;
}

export async function buildServer(moduleNames: readonly string[]): Promise<McpServer> {
  const server = new McpServer({ name: "vibe-ops", version: "0.0.1" });

  for (const name of moduleNames) {
    const plugin = await loadModule(name);
    const { id, summary } = plugin.definition;

    server.registerTool(
      id,
      { title: id, description: summary, inputSchema: shapeFor(plugin) },
      async (input: Record<string, unknown>) => {
        const { repo, command, args, confirm, ...rest } = input;
        const lines: string[] = [];
        const result = await runModule({
          plugin,
          flags: rest as Record<string, string | boolean>,
          args: Array.isArray(args) ? (args as string[]).map(String) : [],
          cwd: typeof repo === "string" ? repo : process.cwd(),
          surface: "mcp",
          command: typeof command === "string" ? command : undefined,
          confirmed: confirm === true,
          sink: (message) => lines.push(message),
        });
        const text = [result.summary, ...lines].filter((part) => part !== undefined && part !== "").join("\n");
        return {
          content: [{ type: "text" as const, text: text === "" ? `${id} exited ${result.code}` : text }],
          // A non-zero exit is a finding, not a transport failure — the caller gets the output either
          // way and decides what it means. Marking it isError would hide the report behind an error.
          structuredContent: { exitCode: result.code, data: result.data ?? null },
        };
      },
    );
  }

  return server;
}

export async function serveStdio(moduleNames: readonly string[]): Promise<void> {
  const server = await buildServer(moduleNames);
  await server.connect(new StdioServerTransport());
}

export async function serveHttp(moduleNames: readonly string[], port: number): Promise<void> {
  const http = createServer((req, res) => {
    if (req.method !== "POST" || !req.url?.startsWith("/mcp")) {
      res.writeHead(404).end();
      return;
    }
    // Per request, discarded with it. Building the server here rather than once is what makes the
    // "stateless" claim true rather than merely configured.
    void (async () => {
      const server = await buildServer(moduleNames);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res);
    })().catch(() => {
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve) => http.listen(port, resolve));
  process.stderr.write(`vibe-ops mcp listening on http://127.0.0.1:${port}/mcp (stateless)\n`);
}
