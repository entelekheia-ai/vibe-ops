// Which repositories a session's turn wrote to, since byte offset N — the CLI-internal port of
// `plugin/scripts/session-touched-repos.sh` (Plan-006, Plan-040 Track 7). Reads only the bytes appended
// since `offset`, so cost is proportional to the turn, not to the session's age.
//
// WHY THE TRANSCRIPT AND NOT `git status`: a session's cwd names the wrong repository in a workspace
// whose root is an umbrella over independent repos, and a dirty tree elsewhere may be a sibling agent's
// in-flight edits, not this session's. The transcript is the one source that is per-session and knows
// only what THIS agent wrote — see project/plans/006-*.md Decision Log.
//
// This has no jq-or-nothing split the shell version needed: every line here is parsed as JSON directly,
// which is what jq itself was standing in for — a transcript line can carry several tool_use blocks in
// one array (parallel tool calls), and a bare regex scan risks attributing a `file_path` to the wrong
// block. The shell version's no-jq fallback and the test proving it agreed with the jq path have no
// TypeScript counterpart: there is exactly one parser here, and it is the one that was always correct.
//
// Not exported through governance-plan: it is not plan-specific, and RFC-0005 §5 names it as "a function
// of the CLI" rather than a package export.

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface TouchedRepos {
  /** The new offset to persist — the transcript's current byte size. */
  readonly offset: number;
  /** Every distinct file a tracked write (Edit/Write/NotebookEdit) reached in the new bytes. */
  readonly paths: readonly string[];
  /** Every distinct repository (`git rev-parse --show-toplevel`) those files resolve to. */
  readonly repos: readonly string[];
}

interface ToolUseBlock {
  readonly type?: string;
  readonly name?: string;
  readonly input?: { readonly file_path?: string; readonly notebook_path?: string };
}

interface TranscriptLine {
  readonly message?: { readonly content?: readonly ToolUseBlock[] };
}

const TRACKED_TOOLS = new Set(["Edit", "Write", "NotebookEdit"]);

export function touchedRepos(transcriptPath: string, offset: number): TouchedRepos {
  if (!existsSync(transcriptPath)) return { offset: 0, paths: [], repos: [] };

  let size: number;
  try {
    // `existsSync` above is satisfied by a DIRECTORY, and the read below would then throw EISDIR. The
    // outer catch would swallow it and the caller would exit before writing its state, pinning the
    // offset at its seed for the rest of the session — the same stall a repository with an unreadable
    // config used to cause. The helper this replaced returned an offset of 0 and carried on.
    const stat = statSync(transcriptPath);
    if (!stat.isFile()) return { offset: 0, paths: [], repos: [] };
    size = stat.size;
  } catch {
    return { offset: 0, paths: [], repos: [] };
  }

  let effectiveOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  // The transcript only ever grows. A recorded offset past the current size means the file was rotated
  // or truncated underneath us — re-read from the start rather than fail: a repeat nudge is safe, a
  // missed one is not.
  if (effectiveOffset > size) effectiveOffset = 0;
  if (effectiveOffset >= size) return { offset: size, paths: [], repos: [] };

  const buffer = readFileSync(transcriptPath);
  const chunk = buffer.subarray(effectiveOffset).toString("utf8");

  const paths = new Set<string>();
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let parsed: TranscriptLine;
    try {
      parsed = JSON.parse(trimmed) as TranscriptLine;
    } catch {
      continue;
    }
    for (const block of parsed.message?.content ?? []) {
      if (block.type !== "tool_use" || block.name === undefined || !TRACKED_TOOLS.has(block.name)) continue;
      const filePath = block.input?.file_path ?? block.input?.notebook_path;
      if (filePath !== undefined) paths.add(filePath);
    }
  }

  const sortedPaths = [...paths].sort();
  const repos = new Set<string>();
  for (const filePath of sortedPaths) {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) continue;
    const result = spawnSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
    if (result.status === 0) {
      const top = result.stdout.trim();
      if (top !== "") repos.add(top);
    }
  }

  return { offset: size, paths: sortedPaths, repos: [...repos].sort() };
}
