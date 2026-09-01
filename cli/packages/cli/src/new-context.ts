// vibe-ops new-context — the UserPromptExpansion surface for a typed /vibe-ops:new. Reads
// `command_args` off stdin, takes its first word as the record type, resolves it through
// @entelekheia/governance-base, and answers in the hook's own protocol — no shipped script, replacing
// plugin/hooks/new-command-context.sh (Plan-011 Track 2), which shelled out to
// resolve-governance.sh and hand-rolled the JSON escaping jq's absence used to require.
//
// Same fail-silent discipline as hook.ts's PostToolUse surface (ADR-0009 obligation 3): an unparsable
// payload, an unrecognized type, or a declared records.* path that does not resolve all produce no
// output at all, never a hook failure that reads as this repository being broken.

import { createDocumentStore, loadConfig } from "@entelekheia/vibe-ops-core";
import type { RecordType } from "@entelekheia/vibe-ops-core";
import { formatResolved, RecordsConfigError, resolveRecord } from "@entelekheia/governance-base";
import { repoRootFrom } from "./run.ts";

interface UserPromptExpansionPayload {
  readonly command_args?: string;
  readonly cwd?: string;
}

const TYPES: readonly RecordType[] = ["adr", "rfc", "plan", "task"];

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function runNewContextHook(): Promise<number> {
  let payload: UserPromptExpansionPayload;
  try {
    payload = JSON.parse(await readStdin()) as UserPromptExpansionPayload;
  } catch {
    return 0;
  }

  // The type is the first word of the arguments — "plan Add support for X" — matching
  // new-command-context.sh's own reading. Without one there is nothing to resolve; the skill asks,
  // which is correct.
  const firstWord = (payload.command_args ?? "").trim().split(/\s+/)[0];
  if (firstWord === undefined || !TYPES.includes(firstWord as RecordType)) return 0;
  const type = firstWord as RecordType;

  const repoRoot = repoRootFrom(payload.cwd ?? process.cwd());
  const { config } = await loadConfig(repoRoot);

  let resolved;
  try {
    resolved = resolveRecord(type, repoRoot, config, createDocumentStore(repoRoot));
  } catch (error) {
    if (error instanceof RecordsConfigError) return 0;
    throw error;
  }

  const body = formatResolved(resolved).join("\n");
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptExpansion",
        additionalContext: `Already resolved for this repository — do not run the resolver again this turn:\n\n${body}`,
      },
    })}\n`,
  );
  return 0;
}
