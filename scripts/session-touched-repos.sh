#!/bin/sh
# vibe-ops — which repositories did this session write to, since byte offset N.
#
# usage: session-touched-repos.sh <transcript-path> <offset>
#
# Prints OFFSET=<new offset>, then one PATH=<file> line per distinct file a
# tracked write reached (Edit/Write/NotebookEdit), then one REPO=<git
# toplevel> line per distinct repository those files resolve to. Reads only
# the bytes appended since <offset>, so cost is proportional to the turn, not
# to the session's age.
#
# Why the transcript and not `git status`: a session's cwd names the wrong
# repository in a workspace whose root is an umbrella over independent repos,
# and a dirty tree elsewhere may be a sibling agent's in-flight edits, not this
# session's. The transcript is the one source that is per-session and knows
# only what THIS agent wrote — see project/plans/006-*.md Decision Log.
#
# jq when present, because a transcript line can carry several tool_use blocks
# in one JSON array (parallel tool calls) and jq is the only way to attribute
# a file_path to the Edit/Write/NotebookEdit block that actually owns it
# rather than a Read/Glob block sharing the same line. Without jq, extraction
# is line-level and can over-include — accepted, and documented, because a
# spurious path only ever costs one failed `git rev-parse` (see below), never
# a wrong nudge.
set -u

TRANSCRIPT="${1:-}"
OFFSET="${2:-0}"

case "$OFFSET" in
  ''|*[!0-9]*) OFFSET=0 ;;
esac

if [ -z "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ]; then
  printf 'OFFSET=0\n'
  exit 0
fi

SIZE=$(wc -c <"$TRANSCRIPT" 2>/dev/null | tr -d ' ')
[ -n "$SIZE" ] || SIZE=0

# The transcript only ever grows. If the recorded offset is past the current
# size, the file was rotated or truncated underneath us — re-read from the
# start rather than fail: a repeat nudge is safe, a missed one is not.
if [ "$OFFSET" -gt "$SIZE" ] 2>/dev/null; then
  OFFSET=0
fi

if [ "$OFFSET" -ge "$SIZE" ] 2>/dev/null; then
  printf 'OFFSET=%s\n' "$SIZE"
  exit 0
fi

NEW=$(tail -c "+$((OFFSET + 1))" "$TRANSCRIPT" 2>/dev/null)

if command -v jq >/dev/null 2>&1; then
  PATHS=$(printf '%s\n' "$NEW" | jq -r '
    select(.message.content? != null)
    | .message.content[]?
    | select(.type == "tool_use")
    | select(.name == "Edit" or .name == "Write" or .name == "NotebookEdit")
    | (.input.file_path // .input.notebook_path // empty)
  ' 2>/dev/null)
else
  # Isolate each Edit/Write/NotebookEdit tool_use block from the next `"name":`
  # onward before extracting file_path / notebook_path from within it, rather
  # than grepping the whole line — a stray "file_path" inside an Edit's
  # old_string/new_string would otherwise be attributed to the wrong tool, or
  # to no tool at all. awk's split() on a regex delimiter does the isolating;
  # sed does the extraction, with one -e clause per key rather than \|
  # alternation — a BRE feature BSD sed does not support and fails on by
  # matching nothing, the same trap task-dossier-guard.sh already avoids.
  PATHS=$(printf '%s\n' "$NEW" | awk '
    { n = split($0, block, /"name":"/)
      for (i = 2; i <= n; i++)
        if (block[i] ~ /^(Edit|Write|NotebookEdit)"/) print block[i]
    }' | sed -n \
      -e 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      -e 's/.*"notebook_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
fi

NEXT_OFFSET=$SIZE
printf 'OFFSET=%s\n' "$NEXT_OFFSET"

[ -n "${PATHS:-}" ] || exit 0

# Both granularities are printed: PATH for "was this exact file written"
# (the hook uses it to check whether the plan file itself was touched, so it
# can stay silent), REPO for "which repository does the resolver run against".
printf '%s\n' "$PATHS" | sort -u | while IFS= read -r P; do
  [ -n "$P" ] || continue
  printf 'PATH=%s\n' "$P"
done

printf '%s\n' "$PATHS" | while IFS= read -r P; do
  [ -n "$P" ] || continue
  D=$(dirname "$P")
  [ -d "$D" ] || continue
  git -C "$D" rev-parse --show-toplevel 2>/dev/null
done | sort -u | while IFS= read -r R; do
  [ -n "$R" ] || continue
  printf 'REPO=%s\n' "$R"
done
