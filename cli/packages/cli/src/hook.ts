// vibe-ops hook <surface> — every entry point that reads a Claude Code hook payload off stdin, under
// one namespace. A shipped shell script would exist only to pull a field out of the JSON and wrap the
// answer back into the hook's response envelope; these do both, which also deletes three hazards every
// hand-written hook in this plugin's hooks/ carries a copy of: a jq-or-nothing dependency, hand-rolled
// JSON escaping, and a second parse of the payload shape. See project/plans/009-*.
//
// One namespace rather than one top-level verb each, because these are not variations on one hook —
// they answer different EVENTS, and the payload field, the guard and the `hookEventName` in the reply
// are different in each. What they share is the envelope, and that is what the namespace names. The
// alternative had `hook` (the narrowest of them) holding the generic word while four siblings sat
// beside it at the top level (Plan-011 Decision Log).
//
// `ops` is a reserved first word, not an ops named "ops": the PostToolUse surface takes an arbitrary
// ops name, so without the reserved word a third-party ops could shadow a surface — or, worse, a new
// surface added here could silently shadow someone's ops.
//
// Silence is the default outcome in every one of them, deliberately, and matches every other hook this
// plugin ships. A line of JSON reaches stdout only when there is something to report.

import { parseArgs } from "node:util";
import path from "node:path";
import { loadModule } from "./resolve.ts";
import { runModule } from "./run.ts";
import { applyImplicitFlags } from "./flags.ts";
import { runNewContextHook } from "./new-context.ts";
import { runPlanContextHook } from "./plan-context.ts";
import { runTaskGuardHook } from "./task-guard.ts";
import { runPreferMcpHook } from "./prefer-mcp.ts";
import { runPlanFileHook } from "./plan-file.ts";
import { runPlanStatusHook } from "./plan-status.ts";
import { runHarnessStatusHook } from "./harness-status.ts";

/** The surfaces `hook` dispatches to, in the order `--help` lists them. */
export const HOOK_SURFACES = ["ops", "plan-context", "plan-file", "plan-status", "new-context", "task-guard", "prefer-mcp", "harness-status"] as const;

/**
 * `vibe-ops hook <surface> [args]`. Returns 2 with a message naming the valid set when the surface is
 * missing or unknown — a typo in a `hooks:` block must not read as the hook having nothing to say.
 */
export async function runHook(argv: readonly string[]): Promise<number> {
  const [surface, ...rest] = argv;

  if (surface === "ops") {
    const [opsName, ...opsArgv] = rest;
    if (opsName === undefined) {
      process.stderr.write("vibe-ops hook ops needs an ops name: vibe-ops hook ops <ops> [flags]\n");
      return 2;
    }
    return runOpsHook(opsName, opsArgv);
  }
  if (surface === "plan-context") return runPlanContextHook();
  if (surface === "plan-file") return runPlanFileHook();
  if (surface === "plan-status") return runPlanStatusHook();
  if (surface === "new-context") return runNewContextHook();
  if (surface === "task-guard") return runTaskGuardHook();
  if (surface === "prefer-mcp") return runPreferMcpHook();
  // The only surface taking arguments other than `ops` — it needs to be told where the installed norm is,
  // because a module is handed one repository root and the source/target seam does not exist yet.
  if (surface === "harness-status") return runHarnessStatusHook(rest);

  process.stderr.write(
    `vibe-ops hook needs a surface: ${HOOK_SURFACES.join(", ")} (got ${surface === undefined ? "nothing" : surface})\n`,
  );
  return 2;
}

interface HookPayload {
  readonly tool_input?: { readonly file_path?: string };
  readonly cwd?: string;
}

interface OpsFindingLike {
  readonly rule: string;
  readonly file?: string;
  readonly evidence: string;
}

interface OpsRepairLike {
  readonly file: string;
  readonly action: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Runs `<ops> --file <the written path> [caller's own flags]` and answers as a PostToolUse hook.
 * Always returns 0: this is an advisory surface, never a blocking one (RFC-0001, "The skill-scoped
 * hook"), so a finding this cannot fix is reported, not enforced.
 */
async function runOpsHook(opsName: string, argv: readonly string[]): Promise<number> {
  let payload: HookPayload;
  try {
    payload = JSON.parse(await readStdin()) as HookPayload;
  } catch {
    // An unparsable payload is not this verb's problem to surface — ADR-0009 obligation 3, fail
    // silent rather than fail open while appearing to work.
    return 0;
  }

  const filePath = payload.tool_input?.file_path;
  if (filePath === undefined) return 0;
  const base = path.basename(filePath);
  if (base !== "AGENTS.md" && base !== "CLAUDE.md") return 0;

  const plugin = await loadModule(opsName);
  const options: Record<string, { type: "string" | "boolean" }> = {};
  for (const flag of plugin.definition.flags ?? []) options[flag.name] = { type: flag.type };

  let parsed;
  try {
    parsed = parseArgs({
      args: applyImplicitFlags(argv, plugin.definition.flags ?? []),
      options,
      allowPositionals: true,
      strict: true,
    });
  } catch {
    // A malformed registration (a typo in hooks:) must not read as a hook failure to Claude Code —
    // the sensor for this is 25-hooks-registration.sh, not this process's exit code.
    return 0;
  }

  const result = await runModule({
    plugin,
    flags: { ...(parsed.values as Record<string, string | boolean>), file: filePath },
    args: [],
    cwd: payload.cwd ?? process.cwd(),
    surface: "hook",
    sink: () => {}, // the ops only prints under "cli" — nothing reaches this, and nothing needs to
  });

  const data = (result.data ?? {}) as {
    findings?: readonly OpsFindingLike[];
    repaired?: readonly OpsRepairLike[];
  };
  const repaired = data.repaired ?? [];
  const findings = data.findings ?? [];
  if (repaired.length === 0 && findings.length === 0) return 0;

  const parts = [
    ...repaired.map((r) => `fixed ${r.file} — ${r.action}`),
    ...findings.map((f) => `${f.rule}: ${f.file === undefined ? "" : `${f.file} — `}${f.evidence}`),
  ];
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: parts.join("\n") },
    })}\n`,
  );
  return 0;
}
