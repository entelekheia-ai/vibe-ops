// vibe-ops hook session-cleanup — delete this session's own state files at SessionEnd. Replaces
// `plugin/hooks/session-state-cleanup.sh` (Plan-006, project/rfc/0005-*.md §5, project/plans/040-*.md
// Track 7): the deterministic half of state cleanup, for the two markers `hook plan-context` and
// `hook plan-progress` write per session.
//
// This alone is not sufficient: SessionEnd never fires for a session that crashed or was killed —
// `plan-progress.ts`'s own opportunistic mtime sweep exists for that case.
//
// Checks every candidate state directory, not only the one this call was handed, because
// `CLAUDE_PLUGIN_DATA`'s resolution has been observed to diverge across invocations of the same session
// (see project/plans/006-*.md Surprises) — unlike the opportunistic sweep, a plain unlink on a path that
// does not exist is free, so covering every candidate costs nothing. The state directory itself arrives
// as `--state-dir`, supplied by `hooks.json`'s own `${CLAUDE_PLUGIN_DATA}` expansion — this module never
// reads that variable, or any other `CLAUDE_*` variable, directly (RFC-0005 §5).

import { unlinkSync } from "node:fs";
import path from "node:path";
import { candidateStateDirs } from "./hook-state-dir.ts";

interface SessionEndPayload {
  readonly session_id?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function runSessionCleanupHook(argv: readonly string[]): Promise<number> {
  try {
    const flagIndex = argv.indexOf("--state-dir");
    const stateDirArg = flagIndex === -1 ? undefined : argv[flagIndex + 1];

    let payload: SessionEndPayload;
    try {
      payload = JSON.parse(await readStdin()) as SessionEndPayload;
    } catch {
      return 0;
    }

    const sid = payload.session_id;
    if (sid === undefined || sid === "") return 0;

    for (const dir of candidateStateDirs(stateDirArg)) {
      for (const name of [`vibe-ops-plan-mode-${sid}`, `vibe-ops-progress-${sid}`]) {
        try {
          unlinkSync(path.join(dir, name));
        } catch {
          // Missing (the common case) or unwritable — either way, not this hook's problem to report.
        }
      }
    }

    return 0;
  } catch {
    return 0;
  }
}
