// vibe-ops hook plan-progress — the Stop surface that notices a turn wrote to a repository whose plan
// is active while that plan's living sections stayed untouched, and hands the observation back to the
// agent that still has tools. Replaces `plugin/hooks/plan-progress-nudge.sh` (Plan-006, Plan-008,
// project/rfc/0005-*.md §5, project/plans/040-*.md Track 7) — same behaviour, ported field for field;
// see that script's own header (kept as history in git) for the reasoning behind each rule enforced
// here, none of which changed.
//
// THE HOST-SPECIFIC INPUTS ARRIVE ON THE PAYLOAD OR THE COMMAND LINE, NEVER FROM AN ENV VAR THIS MODULE
// READS. `session_id` and `transcript_path` are standard fields of a Stop hook's own JSON payload — the
// script read them the same way, off stdin, never from an env var. The one input that WAS an env var
// (`CLAUDE_PLUGIN_DATA`, the state directory) is now `--state-dir`, which `hooks.json`'s registration
// supplies by expanding `${CLAUDE_PLUGIN_DATA}` itself — see `hook-state-dir.ts`. This module never
// touches `process.env["CLAUDE_PLUGIN_DATA"]`, `CLAUDE_PLUGIN_ROOT` or `CLAUDE_PROJECT_DIR`.
//
// SILENCE IS THE POINT, NOT A FALLBACK — see the plugin-side header this replaces (project/plans/008-*.md):
// a firing is not free, and the overwhelming majority of Stops have nothing to report.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { planProgressNudge } from "@entelekheia/governance-plan";
import { touchedRepos } from "./touched-repos.ts";
import { primaryStateDir, isUsableSessionId } from "./hook-state-dir.ts";

interface StopPayload {
  readonly session_id?: string;
  readonly transcript_path?: string;
  /** Set when the turn is already a continuation of this hook's own request. */
  readonly stop_hook_active?: boolean;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function parseState(text: string): { offset: number; nudged: readonly string[] } {
  const offsetLine = text.split("\n").find((line) => line.startsWith("OFFSET="));
  const nudgedLine = text.split("\n").find((line) => line.startsWith("NUDGED="));
  const rawOffset = offsetLine === undefined ? "" : offsetLine.slice("OFFSET=".length);
  const offset = /^\d+$/.test(rawOffset) ? Number.parseInt(rawOffset, 10) : 0;
  const rawNudged = nudgedLine === undefined ? "" : nudgedLine.slice("NUDGED=".length).trim();
  const nudged = rawNudged === "" ? [] : rawNudged.split(/\s+/);
  return { offset, nudged };
}

function writeState(statePath: string, offset: number, nudged: readonly string[]): void {
  try {
    writeFileSync(statePath, `OFFSET=${offset}\nNUDGED=${nudged.join(" ")}\n`);
  } catch {
    // Fails silent, never open (ADR-0009 obligation 3) — a hook that cannot write its own bookkeeping
    // still must not block the turn.
  }
}

const SWEEP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Opportunistic cleanup for a session that crashed or was killed before `SessionEnd` ran — the same
 *  sweep `plan-progress-nudge.sh` carried, piggybacked on a turn already doing this I/O. `-type f` is
 *  load-bearing, not tidiness: `stateDir` itself can match the `vibe-ops-*` glob (its name is
 *  `vibe-ops-<marketplace>`), and only a directory-entry check keeps the sweep from ever selecting its
 *  own directory. */
function sweepStaleState(stateDir: string): void {
  let entries;
  try {
    entries = readdirSync(stateDir, { withFileTypes: true });
  } catch {
    return;
  }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith("vibe-ops-")) continue;
    const full = path.join(stateDir, entry.name);
    try {
      const { mtimeMs } = statSync(full);
      if (now - mtimeMs > SWEEP_MAX_AGE_MS) unlinkSync(full);
    } catch {
      // A file removed or made unreadable between the listing and the stat is not this sweep's problem.
    }
  }
}

export async function runPlanProgressHook(argv: readonly string[]): Promise<number> {
  try {
    const flagIndex = argv.indexOf("--state-dir");
    const stateDirArg = flagIndex === -1 ? undefined : argv[flagIndex + 1];
    const stateDir = primaryStateDir(stateDirArg);

    let payload: StopPayload;
    try {
      payload = JSON.parse(await readStdin()) as StopPayload;
    } catch {
      return 0;
    }

    // 1. Never re-fire into our own continuation.
    if (payload.stop_hook_active === true) return 0;

    const sid = payload.session_id;
    const transcript = payload.transcript_path;
    // `isUsableSessionId` is the path guard, not a format preference: the id is interpolated into a
    // file name below, and `path.join` resolves a `..` inside it lexically, which would put the write
    // outside the state directory.
    if (!isUsableSessionId(sid) || transcript === undefined || transcript === "") return 0;

    const statePath = path.join(stateDir, `vibe-ops-progress-${sid}`);

    // First Stop of a session: seed the offset to where the transcript already is, and say nothing.
    // Without this a fresh state file means offset 0, so the very next Stop attributes the WHOLE session
    // as though it were this turn.
    if (!existsSync(statePath)) {
      try {
        mkdirSync(stateDir, { recursive: true });
      } catch {
        // covered below by writeState's own try/catch failing silently
      }
      let size = 0;
      try {
        size = statSync(transcript).size;
      } catch {
        size = 0;
      }
      writeState(statePath, size, []);
      return 0;
    }

    let stateText: string;
    try {
      stateText = readFileSync(statePath, "utf8");
    } catch {
      return 0;
    }
    const { offset, nudged } = parseState(stateText);

    const { offset: newOffset, paths: written, repos } = touchedRepos(transcript, offset);

    // State cleanup, piggybacked on a turn already doing this I/O.
    try {
      mkdirSync(stateDir, { recursive: true });
    } catch {
      // best-effort; the sweep below no-ops on a missing directory
    }
    sweepStaleState(stateDir);

    if (repos.length === 0) {
      writeState(statePath, newOffset, nudged);
      return 0;
    }

    const { text, nudgedPlan, stillNudged } = await planProgressNudge(repos, written, nudged);

    writeState(statePath, newOffset, stillNudged);

    if (text === undefined) return 0;

    // The firing is recorded on disk before the model is asked anything — the branch this hook most
    // wants to count is the one that is now required to be silent, and from here on the hook can no
    // longer observe what happens.
    try {
      const day = new Date().toISOString().slice(0, 10);
      const logPath = path.join(stateDir, `vibe-ops-nudge-log-${day}.tsv`);
      let planMtime = "";
      if (nudgedPlan !== undefined) {
        try {
          planMtime = String(Math.floor(statSync(nudgedPlan).mtimeMs / 1000));
        } catch {
          planMtime = "";
        }
      }
      appendFileSync(logPath, `${new Date().toISOString()}\t${sid}\t${nudgedPlan ?? ""}\t${planMtime}\n`);
    } catch {
      // Fails silent — the hook still delivers its observation even when it cannot log the firing.
    }

    const fullText = `This turn wrote to a repository with an active plan whose living sections were not part of that write: ${text}

If this turn taught or decided something worth the record, add an entry now (Observation:/Evidence: or Decision:/Rationale:/Date/Author:) before finishing.

If it did not, produce no output at all about this — no explanation, no mention of this note, no acknowledgement that it fired. End the turn as you otherwise would have. Declining is the expected outcome and is already recorded on disk; a paragraph explaining why nothing was owed is the cost this note exists to avoid, and the user did not ask for it. This will not ask again about this plan in this session.`;

    process.stdout.write(
      `${JSON.stringify({ hookSpecificOutput: { hookEventName: "Stop", additionalContext: fullText } })}\n`,
    );
    return 0;
  } catch {
    // Fail open, deliberately catching everything — an advisory hook must never be the reason a turn
    // does not end.
    return 0;
  }
}
