// vibe-ops hook plan-context — the UserPromptSubmit surface that places this repository's plan format
// at the moment a plan is written. Replaces plugin/hooks/plan-mode-context.sh (Plan-011 Track 3), whose
// body is now `planModeGuidance` in @entelekheia/governance-base.
//
// Why a hook at all, unchanged from the script it replaces: a plan-mode plan is written before anything
// under project/ has been read, so the format has to be present at that instant, and it carries the next
// plan number — state on disk no static instruction can know.
//
// What the script could not do, and this is the whole point of the port: it restated the living-section
// names in its own prose ("the four living sections (Progress, Surprises & Discoveries, …)"), which was
// right against a plan@0.1 template and wrong against plan@0.2's two. The names now come from the
// template's own markers, through the resolver, and are written down in exactly one place.
//
// Fail-silent, per ADR-0009 obligation 3: an unparsable payload, a repository that keeps no plans, or a
// declared records.* path that does not resolve all produce no output at all.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDocumentStore, loadConfig } from "@entelekheia/vibe-ops-core";
import { planModeGuidance, RecordsConfigError, resolveRecord } from "@entelekheia/governance-base";
import { repoRootFrom } from "./run.ts";

interface UserPromptSubmitPayload {
  readonly session_id?: string;
  readonly permission_mode?: string;
  readonly cwd?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The once-per-session marker, at the same path and under the same name the shell used
 * (`vibe-ops-plan-mode-<session_id>`) — `plugin/hooks/session-state-cleanup.sh` deletes that exact name
 * at SessionEnd, and renaming it here would leave a file nothing ever collects.
 */
function markerPath(sessionId: string): string {
  const dir = process.env.CLAUDE_PLUGIN_DATA ?? process.env.TMPDIR ?? "/tmp";
  return path.join(dir, `vibe-ops-plan-mode-${sessionId}`);
}

export async function runPlanContextHook(): Promise<number> {
  let payload: UserPromptSubmitPayload;
  try {
    payload = JSON.parse(await readStdin()) as UserPromptSubmitPayload;
  } catch {
    return 0;
  }

  // Plan mode, or nothing — the guard that makes this free in every other turn of every other
  // repository. Reading a parsed field rather than substring-matching the raw JSON, which is what the
  // dependency-free shell had to do.
  if (payload.permission_mode !== "plan") return 0;

  // Once per session: plan mode spans several turns while the user iterates, and the injected text stays
  // in the transcript, so repeating it only costs.
  const marker = markerPath(payload.session_id ?? "nosession");
  if (existsSync(marker)) return 0;

  const repoRoot = repoRootFrom(payload.cwd ?? process.cwd());
  const { config } = await loadConfig(repoRoot);

  let resolved;
  try {
    resolved = resolveRecord("plan", repoRoot, config, createDocumentStore(repoRoot));
  } catch (error) {
    if (error instanceof RecordsConfigError) return 0;
    throw error;
  }

  // `CLAUDE_PROJECT_DIR` is the session's nominal project root. It differs from the resolved repository
  // only in an umbrella workspace, and that difference is the sole reason a plan ever carries a
  // `| Repository |` row — so it is passed as-is and `planModeGuidance` decides whether to say anything.
  const text = planModeGuidance(resolved, process.env.CLAUDE_PROJECT_DIR);
  if (text === "") return 0;

  try {
    mkdirSync(path.dirname(marker), { recursive: true });
    writeFileSync(marker, "");
  } catch {
    // A state directory that cannot be written costs a repeated injection, never a failed hook.
  }

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: text },
    })}\n`,
  );
  return 0;
}
