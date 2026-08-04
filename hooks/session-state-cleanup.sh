#!/bin/sh
# vibe-ops — delete this session's own state files at SessionEnd.
#
# The deterministic half of state cleanup. Two hooks write per-session state
# under vibe-ops-<kind>-<session_id> (plan-mode-context.sh's marker,
# plan-progress-nudge.sh's offset/nudge file) and nothing removed either
# before this — counted on 2026-08-03: 13 stray markers already on disk, the
# oldest from the same day. See project/plans/006-*.md Surprises.
#
# This alone is not sufficient: SessionEnd never fires for a session that
# crashed or was killed, which is the likely origin of those 13. The
# opportunistic mtime sweep in plan-progress-nudge.sh exists for that case.
#
# Checks both possible state directories rather than only the one this
# process resolves CLAUDE_PLUGIN_DATA to, because that resolution has been
# observed to diverge across invocations (see Open questions in the plan) —
# unlike the opportunistic sweep, a plain `rm -f` on a path that doesn't
# exist is free, so covering both costs nothing.
set -u

IN=$(cat)
SID=$(printf '%s' "$IN" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$SID" ] || exit 0

for DIR in "${CLAUDE_PLUGIN_DATA:-}" "${TMPDIR:-/tmp}" /tmp; do
  [ -n "$DIR" ] || continue
  rm -f "$DIR/vibe-ops-plan-mode-$SID" "$DIR/vibe-ops-progress-$SID" 2>/dev/null
done

exit 0
