// vibe-ops hook prefer-mcp — TEMPORARY. Notices a Bash call to a `vibe-ops` module that is also an MCP
// tool, and names the equivalent tool call. It exists to move usage across, and its success condition is
// its own deletion: once the transcripts stop containing the CLI form, delete this file, its entry in
// HOOK_SURFACES, and its registration in hooks.json. A migration nudge that outlives the migration is
// just a tax on every Bash call.
//
// IT NEVER DECIDES. No `permissionDecision`, in any branch — the command runs, and the note lands beside
// its result. `task-guard` is the hook that refuses things on Bash, and the two cannot collide: their
// conditions are disjoint by construction (one fires on `rm`/`unlink` of a dossier, the other on an
// invocation of `vibe-ops <module>`), and only one of them is even capable of a decision.
//
// Three exclusions, each for a different reason:
//
//   - `hook`, `mcp`, `--help` and friends are NOT modules. They have no MCP tool, by design: a hook
//     surface is invoked by Claude Code itself, and `mcp` is the server. Recommending a tool for them
//     would be recommending something that does not exist.
//   - A DESTRUCTIVE verb is never recommended. Over MCP its consent is a `confirm: true` the caller sets
//     itself; from a terminal a skill previews with `--dry-run`, shows the output, and waits for a
//     person. Nudging `task close` toward the weaker of the two would trade a real confirmation for a
//     boolean, which is not a migration, it is a downgrade.
//   - A command already carrying `--json` is left alone: whoever wrote it is reading structured output
//     on purpose and has made the trade this hook exists to point at.

import { loadConfig } from "@entelekheia/vibe-ops-core";
import { exposedModules } from "./builtins.ts";
import { loadModule } from "./resolve.ts";
import { repoRootFrom } from "./run.ts";

interface PreToolUsePayload {
  readonly tool_input?: { readonly command?: string };
  readonly cwd?: string;
}

/** Reachable from a terminal only — see the header. Not modules, so not MCP tools. */
const NOT_A_MODULE = new Set(["hook", "mcp", "--help", "-h", "help"]);

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Every `vibe-ops <word> [<word>]` in a command line, including inside a compound — `cd x && vibe-ops
 * plan status` is the ordinary shape, not an unusual one. Returns the module and, when the next token is
 * not a flag, the verb.
 */
function invocations(command: string): readonly { module: string; verb?: string }[] {
  const tokens = command.split(/\s+/).filter((token) => token !== "");
  const found: { module: string; verb?: string }[] = [];
  for (const [index, token] of tokens.entries()) {
    if (token !== "vibe-ops" && !token.endsWith("/vibe-ops")) continue;
    const module = tokens[index + 1];
    if (module === undefined || module.startsWith("-") || NOT_A_MODULE.has(module)) continue;
    const next = tokens[index + 2];
    found.push({ module, verb: next === undefined || next.startsWith("-") ? undefined : next });
  }
  return found;
}

export async function runPreferMcpHook(): Promise<number> {
  let payload: PreToolUsePayload;
  try {
    payload = JSON.parse(await readStdin()) as PreToolUsePayload;
  } catch {
    return 0;
  }

  const command = payload.tool_input?.command;
  if (command === undefined || !command.includes("vibe-ops")) return 0;
  if (/(^|\s)--json(\s|$)/.test(command)) return 0;

  const candidates = invocations(command);
  if (candidates.length === 0) return 0;

  const repoRoot = repoRootFrom(payload.cwd ?? process.cwd());
  const { config } = await loadConfig(repoRoot);
  // The MCP server exposes the configured module set, or the built-ins when a repository names none —
  // read through the same helper `bin.ts` serves from, because "is there a tool for this" and "which
  // tools does mcp start" have to be one answer.
  const exposed = exposedModules(config.modules);

  const notes: string[] = [];
  for (const { module, verb } of candidates) {
    if (!exposed.includes(module)) continue;

    let definition;
    try {
      ({ definition } = await loadModule(module));
    } catch {
      continue;
    }
    if (verb !== undefined && definition.commands?.some((c) => c.name === verb) !== true) continue;

    const commandDef = definition.commands?.find((c) => c.name === verb);
    if ((commandDef?.destructive ?? definition.destructive) === true) continue;

    const call = verb === undefined ? `{}` : `{ command: "${verb}" }`;
    notes.push(`  \`vibe-ops ${module}${verb === undefined ? "" : ` ${verb}`}\` → the \`${module}\` MCP tool with ${call}`);
  }

  if (notes.length === 0) return 0;

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext: [
          "This vibe-ops command is also an MCP tool, and the tool is the preferred surface — it returns the",
          "report as structured data rather than as terminal text you have to read back. Prefer, next time:",
          "",
          ...notes,
          "",
          "The tool name is prefixed by the MCP server, e.g. `mcp__vibe-ops__<module>`. If this session's",
          "server predates the verb, it will not be listed — the CLI stays correct until the server restarts.",
        ].join("\n"),
      },
    })}\n`,
  );
  return 0;
}
