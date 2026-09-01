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
//   - A DESTRUCTIVE verb is never recommended HERE, and the reason narrowed once the closing skills
//     started naming the tools themselves. It is no longer "MCP is the weaker consent" — a skill that
//     previews with `--dry-run`, shows the output and waits carries the same consent to either surface,
//     and `confirm: true` is the mechanism that surface needs, not a replacement for it. What is left is
//     narrower and still true: a BARE `vibe-ops task close` typed outside that ceremony has had no
//     preview, and answering it with "do this as a tool call instead" would be advice about the wrong
//     thing. The skills route themselves; this nudge is for everything else.
//   - A command already carrying `--json` is left alone: whoever wrote it is reading structured output
//     on purpose and has made the trade this hook exists to point at.

import { loadConfig } from "@entelekheia/vibe-ops-core";
import { exposedModules } from "./builtins.ts";
import { loadModule } from "./resolve.ts";
import { declaredFlagsFor, repoRootFrom } from "./run.ts";

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

/** Where one invocation ends inside a compound command. `cd x && vibe-ops plan status` is the ordinary shape. */
const SHELL_BREAK = new Set(["&&", "||", ";", "|", "&", ">", ">>", "<", "2>", "2>&1"]);

function isVibeOps(token: string): boolean {
  return token === "vibe-ops" || token.endsWith("/vibe-ops");
}

/**
 * Every `vibe-ops <module> [verb] [flags] [positionals]` in a command line.
 *
 * THE WHOLE INVOCATION, not just the head. Reporting only module and verb produced advice that was
 * wrong rather than merely incomplete: `vibe-ops records --handling x.md` has no verb token — the third
 * token is a flag — so it was answered with "the `records` tool with `{}`", which runs a different verb
 * and reports success. A nudge that renames the call has to carry what the call said.
 */
function invocations(command: string): readonly { module: string; verb?: string; rest: readonly string[] }[] {
  const tokens = command.split(/\s+/).filter((token) => token !== "");
  const found: { module: string; verb?: string; rest: string[] }[] = [];
  for (const [index, token] of tokens.entries()) {
    if (!isVibeOps(token)) continue;
    const module = tokens[index + 1];
    if (module === undefined || module.startsWith("-") || NOT_A_MODULE.has(module)) continue;

    const next = tokens[index + 2];
    const verb = next === undefined || next.startsWith("-") ? undefined : next;

    const rest: string[] = [];
    for (let at = index + (verb === undefined ? 2 : 3); at < tokens.length; at++) {
      const word = tokens[at]!;
      if (SHELL_BREAK.has(word) || isVibeOps(word)) break;
      rest.push(word);
    }
    found.push({ module, verb, rest });
  }
  return found;
}

/** A JS object literal key, quoted only when it has to be — `dry-run` is not an identifier. */
function key(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : `"${name}"`;
}

/**
 * The rest of the invocation as tool-call fields, resolving each flag's arity from the definition rather
 * than guessing: `--type adr` consumes its value, `--dry-run` does not, and whatever is left is `args`.
 * An unknown flag is skipped — the module would reject it anyway, and inventing a field for it would put
 * a key in the suggestion that the tool does not accept.
 */
function fieldsFor(rest: readonly string[], flagTypes: ReadonlyMap<string, string>): string[] {
  const fields: string[] = [];
  const args: string[] = [];
  for (let at = 0; at < rest.length; at++) {
    const word = rest[at]!;
    if (!word.startsWith("--")) {
      args.push(word);
      continue;
    }
    const [name, inline] = word.slice(2).split("=", 2);
    const type = flagTypes.get(name ?? "");
    if (type === undefined) continue;
    if (type === "boolean") {
      fields.push(`${key(name!)}: true`);
      continue;
    }
    const value = inline ?? rest[++at];
    if (value !== undefined) fields.push(`${key(name!)}: "${value}"`);
  }
  if (args.length > 0) fields.push(`args: [${args.map((a) => `"${a}"`).join(", ")}]`);
  return fields;
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
  for (const { module, verb, rest } of candidates) {
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

    // Scoped to the verb this line actually names, not to the union of every verb's flags. The union was
    // wrong in a way that only showed on a mis-parse: a string flag belonging to a SIBLING verb resolved
    // its arity here, so the token after it was swallowed as that flag's value instead of being read as
    // a positional — turning a suggestion for `task guard <dossier>` into one that drops the dossier.
    // `runModule` refuses the sibling's flag anyway (Plan-027 Track 2), so widening bought nothing.
    const flagTypes = new Map(
      declaredFlagsFor(definition, verb).map((flag) => [flag.name, flag.type] as const),
    );

    const fields = [...(verb === undefined ? [] : [`command: "${verb}"`]), ...fieldsFor(rest, flagTypes)];
    const call = fields.length === 0 ? "{}" : `{ ${fields.join(", ")} }`;
    const typed = `vibe-ops ${module}${verb === undefined ? "" : ` ${verb}`}${rest.length === 0 ? "" : ` ${rest.join(" ")}`}`;
    notes.push(`  \`${typed}\` → the \`${module}\` MCP tool with ${call}`);
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
