// vibe-ops hook task-guard — refuse to delete a task dossier whose closure never ran. Replaces
// plugin/hooks/task-dossier-guard.sh (Plan-011 Track 4).
//
// The dossier is the only artifact in the lifecycle deleted on purpose, and everything it taught is
// promoted during closure. Deleting it by hand loses that silently — which is the failure closure exists
// to prevent and cannot prevent, because prose cannot fire at the moment of the act.
//
// It invents no convention: the task template ships the marker itself, and `closureBoxOpen` in
// @entelekheia/vibe-ops-records is the reader — the same one `task close` ticks through, so the guard and
// the ceremony can never disagree about what "closed" means.
//
// This is the one surface that answers `permissionDecision: "deny"` rather than `additionalContext`. It
// is a guard, not an observation: the act it stops is not recoverable once it happens.

import path from "node:path";
import { createDocumentStore } from "@entelekheia/vibe-ops-core";
import { closureBoxOpen } from "@entelekheia/vibe-ops-records";
import { repoRootFrom } from "./run.ts";

interface PreToolUsePayload {
  readonly tool_input?: { readonly command?: string };
  readonly cwd?: string;
}

/** Only a deletion is this guard's business — reading or editing a dossier is not. */
const DELETION = /(^|\s)(rm|unlink)(\s|$)/;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function reason(blocked: readonly string[]): string {
  return [
    `Refusing to delete a task dossier whose closure has not run: ${blocked.join(" ")}`,
    "Each of these still has its closure box unchecked, which by the template's own definition means the task is not done however finished it looks.",
    "Run the task closure skill instead. It writes back to the document that started the work, propagates to living docs, spawns an ADR if a decision emerged, and routes every Surprises & Discoveries entry through the promotion test — then ticks that box and deletes the dossier itself, leaving the breadcrumb behind. Everything it promotes is lost if the file goes first.",
  ].join("\n");
}

export async function runTaskGuardHook(): Promise<number> {
  let payload: PreToolUsePayload;
  try {
    payload = JSON.parse(await readStdin()) as PreToolUsePayload;
  } catch {
    return 0;
  }

  const command = payload.tool_input?.command;
  if (command === undefined || !DELETION.test(command)) return 0;

  const repoRoot = repoRootFrom(payload.cwd ?? process.cwd());
  const documents = createDocumentStore(repoRoot);

  const blocked: string[] = [];
  for (const token of command.split(/\s+/)) {
    // Strip quoting the shell would have removed anyway.
    const candidate = token.replace(/^["']/, "").replace(/["']$/, "");
    if (!/tasks\/[^/]*\.md$/.test(candidate)) continue;

    // The store is keyed on repository-relative paths, and the model writes whichever form it likes.
    const relative = path.isAbsolute(candidate) ? path.relative(repoRoot, candidate) : candidate;
    if (relative.startsWith("..")) continue;

    const document = documents.get(relative);
    if (document.tree === undefined) continue;
    if (closureBoxOpen(document)) blocked.push(relative);
  }

  if (blocked.length === 0) return 0;

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason(blocked),
      },
    })}\n`,
  );
  return 0;
}
