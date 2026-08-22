// vibe-ops hook plan-file — file an approved plan-mode plan into its repository's plans directory, and
// tell the model where it landed. Replaces plugin/hooks/plan-approved-copy.sh (Plan-011 Track 6).
//
// Why PostToolUse matching ExitPlanMode, unchanged from the script: on approval `tool_response` carries
// `{plan, filePath}`, and PostToolUse only ever fires on success — a manual rejection is excluded from
// PostToolUseFailure and PermissionDenied too. So for this one tool, "the hook fired at all" already
// means "approved", and there is no outcome to branch on. It is confirmed unusable in headless mode:
// ExitPlanMode does not exist as a callable tool under `claude -p` at all, which is a headless-only fact
// and does not apply to the interactive sessions this runs in.
//
// The script needed jq — the plan is untrusted multi-line markdown carrying quotes, backslashes and code
// fences, and a parse mistake here corrupts a document rather than a nudge. That dependency is gone: the
// payload is parsed by JSON.parse and the plan is read as a tree, not as lines.

import { createDocumentStore, documentFromText } from "@entelekheia/vibe-ops-core";
import { loadConfig } from "@entelekheia/vibe-ops-core";
import { filePlan, readPlanShape, RecordsConfigError, resolveRecord } from "@entelekheia/governance-base";
import { existsSync } from "node:fs";
import { repoRootFrom } from "./run.ts";

interface ExitPlanModePayload {
  readonly tool_response?: { readonly plan?: string; readonly filePath?: string };
  readonly cwd?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function runPlanFileHook(): Promise<number> {
  let payload: ExitPlanModePayload;
  try {
    payload = JSON.parse(await readStdin()) as ExitPlanModePayload;
  } catch {
    return 0;
  }

  const text = payload.tool_response?.plan;
  if (text === undefined || text === "") return 0;

  // Which repository. The plan's own `| Repository |` row wins — written only when `hook plan-context`
  // detected that the session's project root is not the target repo. Otherwise the tool's own cwd,
  // resolved to its git toplevel, which is right for the overwhelmingly common single-repo case.
  //
  // Read from the header TABLE, not by matching a line: `plan-approved-copy.sh` took the first line
  // shaped `| Repository | … |` anywhere in the file, and a plan's Design section may legitimately show
  // a table with that first column.
  const shape = readPlanShape(documentFromText("approved-plan.md", text));
  const declared = shape.repository;
  const repoRoot =
    declared !== undefined && existsSync(declared) ? declared : repoRootFrom(payload.cwd ?? process.cwd());
  const how = declared !== undefined && existsSync(declared) ? "the plan's own Repository row" : "this session's working directory";
  if (!existsSync(repoRoot)) return 0;

  const { config } = await loadConfig(repoRoot);
  let resolved;
  try {
    resolved = resolveRecord("plan", repoRoot, config, createDocumentStore(repoRoot));
  } catch (error) {
    if (error instanceof RecordsConfigError) return 0;
    throw error;
  }
  if (resolved.dir === undefined || typeof resolved.next !== "string") return 0;

  const filed = filePlan({ repoRoot, dir: resolved.dir, next: resolved.next, text });
  if (filed.file === undefined) return 0;

  const notes = [
    `An approved plan-mode plan was filed at \`${filed.file}\` in \`${repoRoot}\`, resolved from ${how}.`,
    `This copy is now the record — make further edits there, not at \`${payload.tool_response?.filePath ?? "the plan-mode file"}\`.`,
  ];
  if (filed.staleNumber) {
    notes.push(
      `The plan's own heading and metadata table may still show a guessed or stale number — correct them to ${resolved.next} to match the filename.`,
    );
  }
  if (filed.droppedRepositoryRow) {
    notes.push(
      "The `| Repository |` row was routing metadata for this step only and has been dropped from the filed copy — it holds an absolute path on this machine, which does not belong in a committed record. Do not add it back.",
    );
  }
  notes.push("The filename's slug is this hook's guess from the heading; rename the file if it reads badly.");

  process.stdout.write(
    `${JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: notes.join(" ") } })}\n`,
  );
  return 0;
}
