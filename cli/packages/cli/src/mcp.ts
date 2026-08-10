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
  for (const flag of plugin.definition.flags ?? []) {
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
        const { repo, ...rest } = input;
        const lines: string[] = [];
        const result = await runModule({
          plugin,
          flags: rest as Record<string, string | boolean>,
          args: [],
          cwd: typeof repo === "string" ? repo : process.cwd(),
          surface: "mcp",
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
