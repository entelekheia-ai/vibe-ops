#!/bin/sh
# vibe-ops — notice a turn wrote to a repository whose plan is In Progress
# while that plan's living sections stayed untouched, and hand the
# observation back to the agent that still has tools.
#
# Why a Stop hook and not a line in an instruction file: the governance rule
# already says Progress / Surprises & Discoveries / Decision Log / Outcomes
# are maintained WHILE the work happens, "reconstructed from memory
# afterwards they are worthless" — and a line cannot choose to arrive only at
# the moment a turn ends without having recorded anything.
#
# Why attribution comes from the session transcript, not from `git status` in
# cwd: this session's cwd may be an umbrella repository over independent
# repos, and a dirty tree elsewhere may be a sibling agent's in-flight edits,
# not this session's. See project/plans/006-*.md Decision Log.
#
# Returns additionalContext, not decision:block — Track 0 measured that block
# arrives at the model framed as a denial ("Stop hook feedback: …"), which is
# wrong for an observation the model must be free to correctly decline.
# additionalContext reaches the model with no such framing, the same way
# plan-mode-context.sh already injects context, just on Stop instead of
# UserPromptSubmit.
set -u

IN=$(cat)

# 1. Never re-fire into our own continuation.
case "$IN" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

SID=$(printf '%s' "$IN" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
TRANSCRIPT=$(printf '%s' "$IN" | sed -n 's/.*"transcript_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
[ -n "$SID" ] && [ -n "$TRANSCRIPT" ] || exit 0

# Where this script and its siblings live, resolved before any cd.
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  ROOT=$CLAUDE_PLUGIN_ROOT
else
  SELF=$0
  case "$SELF" in /*) ;; *) SELF="$(pwd)/$SELF" ;; esac
  ROOT=$(dirname "$(dirname "$SELF")")
fi
HELPER="$ROOT/scripts/session-touched-repos.sh"
RESOLVER="$ROOT/scripts/resolve-governance.sh"
[ -f "$HELPER" ] || exit 0
[ -f "$RESOLVER" ] || exit 0

STATE_DIR="${CLAUDE_PLUGIN_DATA:-${TMPDIR:-/tmp}}"
STATE="$STATE_DIR/vibe-ops-progress-$SID"

# First Stop of a session: seed the offset to where the transcript already is,
# and say nothing. Without this a fresh state file means OFFSET=0, so the very
# next Stop attributes the WHOLE session as though it were this turn. On a
# resumed session that is megabytes of history: the first real firing of this
# hook nudged about a repository last written to hours earlier, because the
# offset jumped 0 -> 5,551,350 in one call. Under-triggering the first turn is
# the trade this plan already declares it prefers over a false nudge.
if [ ! -f "$STATE" ]; then
  mkdir -p "$STATE_DIR" 2>/dev/null
  SIZE=$(wc -c <"$TRANSCRIPT" 2>/dev/null | tr -d ' ')
  case "$SIZE" in ''|*[!0-9]*) SIZE=0 ;; esac
  printf 'OFFSET=%s\nNUDGED=\n' "$SIZE" >"$STATE" 2>/dev/null
  exit 0
fi

OFFSET=$(sed -n 's/^OFFSET=//p' "$STATE" | tail -1)
NUDGED=$(sed -n 's/^NUDGED=//p' "$STATE" | tail -1)
case "$OFFSET" in ''|*[!0-9]*) OFFSET=0 ;; esac

# 2/3. session-touched-repos.sh is itself the cheap-exit chain for "no new
# bytes" and "no write in the new bytes": it never spawns git unless it found
# a tracked write. A turn that changed nothing pays one script invocation and
# nothing downstream of it.
RESULT=$(sh "$HELPER" "$TRANSCRIPT" "$OFFSET" 2>/dev/null) || exit 0
NEW_OFFSET=$(printf '%s\n' "$RESULT" | sed -n 's/^OFFSET=//p')
[ -n "$NEW_OFFSET" ] || NEW_OFFSET=$OFFSET
WRITTEN=$(printf '%s\n' "$RESULT" | sed -n 's/^PATH=//p')
REPOS=$(printf '%s\n' "$RESULT" | sed -n 's/^REPO=//p')

# Track 2b: state cleanup, piggybacked on a turn already doing this I/O so
# turns that exit above never pay for it. Deterministic deletion of THIS
# session's own state happens at SessionEnd; this sweep is only for what that
# misses — a crashed or killed session. Same STATE_DIR, same vibe-ops-* glob,
# so it also catches plan-mode-context.sh's marker, which nothing has ever
# deleted (see Surprises).
#
# -type f is load-bearing, not tidiness: CLAUDE_PLUGIN_DATA is itself named
# vibe-ops-<marketplace>, so the starting directory matches the -name pattern
# at depth 0 and find hands its own root to rm. `rm -f` refuses a directory, so
# today this fails harmlessly into 2>/dev/null — but it means the guard against
# deleting the whole state directory is "the command we happen to use cannot",
# not "we never select it". Anyone hardening this later by reaching for -delete
# or rm -rf would wipe every session's state on the first old-enough sweep.
mkdir -p "$STATE_DIR" 2>/dev/null
find "$STATE_DIR" -maxdepth 1 -type f -name 'vibe-ops-*' -mtime +7 -exec rm -f {} + 2>/dev/null

if [ -z "$REPOS" ]; then
  printf 'OFFSET=%s\nNUDGED=%s\n' "$NEW_OFFSET" "$NUDGED" >"$STATE" 2>/dev/null
  exit 0
fi

# For each repository this turn wrote to, find its one In Progress plan (if
# any) and check whether the turn also wrote to that plan file itself.
NUDGE_LINES=""
STILL_NUDGED=""
for REPO in $REPOS; do
  DIR=$(cd "$REPO" 2>/dev/null && sh "$RESOLVER" plan 2>/dev/null | sed -n 's/^DIR=//p')
  [ -n "$DIR" ] && [ "$DIR" != "(none)" ] || continue
  [ -d "$REPO/$DIR" ] || continue

  PLAN=$(grep -l '^| Status | In Progress |' "$REPO/$DIR"/*.md 2>/dev/null | head -1)
  [ -n "$PLAN" ] || continue

  # 4. Already nudged about this exact plan, and it still hasn't been
  # touched — stay silent rather than insist twice about the same state.
  case "$WRITTEN" in
    *"$PLAN"*) continue ;;  # this turn wrote the plan itself: fully silent
  esac
  if [ "$NUDGED" = "$PLAN" ]; then
    STILL_NUDGED="$PLAN"
    continue
  fi

  NUDGE_LINES="$NUDGE_LINES $PLAN"
  STILL_NUDGED="$PLAN"
done

printf 'OFFSET=%s\nNUDGED=%s\n' "$NEW_OFFSET" "$STILL_NUDGED" >"$STATE" 2>/dev/null

[ -n "$NUDGE_LINES" ] || exit 0

TEXT="This turn wrote to a repository whose plan is In Progress, and the plan's living sections were not part of that write:$NUDGE_LINES
Those sections (Progress, Surprises & Discoveries, Decision Log, Outcomes & Retrospective) are maintained while the work happens, not reconstructed afterwards — that reconstruction is worthless per this repository's own governance rule. If this turn taught or decided something worth the record, add an entry now (Observation:/Evidence: or Decision:/Rationale:/Date/Author:) before finishing. If it genuinely did not, that is a fine outcome too — no entry is needed, and this will not ask again about this plan until it changes."

# Hand-built JSON: a raw newline inside a JSON string is invalid, and a plan
# path is untrusted input, so both backslash/quote and the real newlines in
# TEXT must be escaped before this reaches stdout — the same pipeline
# task-dossier-guard.sh uses for its own REASON field.
ESC=$(printf '%s' "$TEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'NR>1{printf "\\n"}{printf "%s",$0}')
printf '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"%s"}}\n' "$ESC"
