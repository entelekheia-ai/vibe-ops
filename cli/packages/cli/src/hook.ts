// vibe-ops hook — the PostToolUse surface, and the whole reason no skill ships a shell script for it.
// A script would exist only to pull tool_input.file_path out of the JSON on stdin and wrap the result
// back into the hook's response envelope, and this does both — which also deletes three hazards every
// hand-written hook in this plugin's hooks/ carries a copy of: a jq-or-nothing dependency, hand-rolled
// JSON escaping, and a second parse of the payload shape. See project/plans/009-*.
//
// Silence is the default outcome, deliberately, and matches every other hook in this plugin: most
// writes touch neither an AGENTS.md nor a CLAUDE.md, and most of the rest are already correct. A line
// of JSON only reaches stdout when there is something to report.

import { parseArgs } from "node:util";
import path from "node:path";
import { loadModule } from "./resolve.ts";
import { runModule } from "./run.ts";
import { applyImplicitFlags } from "./flags.ts";

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
export async function runHook(opsName: string, argv: readonly string[]): Promise<number> {
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
