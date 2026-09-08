// The state directory for per-session hook bookkeeping (`plan-progress`, `session-cleanup`) — resolved
// from what the registration passed on the command line, never from a host env var read inside the CLI
// (RFC-0005 §5, project/plans/040-*.md Track 7). `hooks.json` expands `${CLAUDE_PLUGIN_DATA}` itself,
// the same way it already expands `${CLAUDE_PLUGIN_ROOT}` for `harness-status`'s `--plugin` flag; this
// module never reads `CLAUDE_PLUGIN_DATA` (or any other `CLAUDE_*` variable) directly.
//
// `TMPDIR` stays a CLI-internal fallback rather than something the registration must also supply: it is
// a generic POSIX convention, not a Claude Code host variable, and the shipped scripts these surfaces
// replace already fell back to it the same way.

/** The directory a fresh piece of state is written to. */
export function primaryStateDir(stateDirArg: string | undefined): string {
  if (stateDirArg !== undefined && stateDirArg !== "") return stateDirArg;
  const tmp = process.env["TMPDIR"];
  return tmp !== undefined && tmp !== "" ? tmp : "/tmp";
}

/**
 * Every directory worth checking for this session's *existing* state — the registration's own value
 * plus the generic fallbacks, deduplicated. `CLAUDE_PLUGIN_DATA` has been observed to resolve
 * differently across invocations of the same session (see the header `session-state-cleanup.sh` carried
 * before this port), so cleanup checks all of them rather than trusting the one the current call was
 * handed.
 */
export function candidateStateDirs(stateDirArg: string | undefined): readonly string[] {
  const candidates = [stateDirArg, process.env["TMPDIR"], "/tmp"].filter(
    (value): value is string => value !== undefined && value !== "",
  );
  return [...new Set(candidates)];
}
