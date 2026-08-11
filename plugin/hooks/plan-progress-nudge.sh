#!/bin/sh
# vibe-ops — notice a turn wrote to a repository whose plan is active while
# that plan's living sections stayed untouched, and hand the observation back
# to the agent that still has tools.
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
# The active-status word and the living section names are NEVER hardcoded
# here — they are read per repository from `vibe-ops plan resolve`'s
# PLAN_ACTIVE / LIVING outputs (project/tasks/001-*.md). 0.7.0 shipped this
# hook assuming every installed repo uses vibe-ops's own vocabulary
# ("In Progress", the same four section names); a repo whose plan template
# differs would have been told to write sections that do not exist there. A
# repo whose taxonomy the resolver cannot derive is skipped in full silence —
# never guessed.
#
# Returns additionalContext, not decision:block — Track 0 measured that block
# arrives at the model framed as a denial ("Stop hook feedback: …"), which is
# wrong for an observation the model must be free to correctly decline.
# additionalContext reaches the model with no such framing, the same way
# `vibe-ops plan-context-hook` already injects context, just on Stop instead of
# UserPromptSubmit.
#
# A firing is not free, and 0.8.0 priced it at nothing. additionalContext
# RE-ENTERS the model: every firing buys a full turn — reasoning, tools,
# visible output. Measured over one workspace's whole session history, 42
# firings bought 263 model turns, and two-fifths of them ended in a paragraph
# explaining to the user why nothing was owed. So this hook now names at most
# ONE plan per firing, remembers what it asked across the whole session, and
# instructs the declining branch to say nothing whatsoever — with the firing
# appended to a log on disk, because the branch that must stay silent is
# exactly the one worth counting. See project/plans/008-*.md.
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
[ -f "$HELPER" ] || exit 0

# The taxonomy comes from `vibe-ops plan resolve`, not from a shipped resolver script
# (Plan-011 Track 3). The CLI is named directly, with no `command -v` guard, per ADR-0009: an install
# missing it must fail loudly rather than turn this hook into a silent no-op that looks like a repository
# with nothing to nudge about. Only the resolver call moved — this script's transcript reading and its
# per-session state stay shell, having no noun in that plan's three.
RESOLVE_PLAN="vibe-ops plan resolve"

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
  # wc takes the path as an argument, not via `<` redirection: a missing file
  # makes `<"$TRANSCRIPT"` fail at the shell itself, which prints straight to
  # this process's own stderr — the command's own `2>/dev/null` cannot catch a
  # failure that happens before the command runs.
  SIZE=$(wc -c "$TRANSCRIPT" 2>/dev/null | awk '{print $1}')
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
# so it also catches the plan-mode marker, which nothing had ever
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

# For each repository this turn wrote to, resolve ITS OWN taxonomy and find
# every plan whose status matches. NUDGED is a set of plan paths, not a
# scalar: more than one plan can be outstanding across repos in the same
# turn, and a scalar would forget all but the last one on the very next Stop.
#
# The set carries forward (Plan-008 Track 1). 0.8.0 rebuilt it from empty on
# every firing and only repopulated it from the repositories THAT turn wrote
# to, so a turn spent in a sibling repository erased the memo for every other
# one and re-armed everything already asked about there. Measured: two
# firings in one session, the second re-naming four plans the first had
# already named, because every turn in between wrote elsewhere.
MSG_BLOCKS=""
NUDGED_PLAN=""
STILL_NUDGED=$NUDGED
for REPO in $REPOS; do
  RESOLVED=$(cd "$REPO" 2>/dev/null && $RESOLVE_PLAN 2>/dev/null) || continue
  DIR=$(printf '%s\n' "$RESOLVED" | sed -n 's/^DIR=//p')
  # `vibe-ops plan resolve` appends the provenance of the answer — "TPL=<path> (config)" vs "(search)"
  # — which the shell resolver never printed. Stripped here because TPL is used below as a path a reader
  # is told to open, and a path with a parenthetical glued to it does not exist.
  TPL=$(printf '%s\n' "$RESOLVED" | sed -n 's/^TPL=//p' | sed 's/ (config)$//; s/ (search)$//')
  AUTHORITY=$(printf '%s\n' "$RESOLVED" | sed -n 's/^AUTHORITY=//p')
  ACTIVE=$(printf '%s\n' "$RESOLVED" | sed -n 's/^PLAN_ACTIVE=//p')
  LIVING=$(printf '%s\n' "$RESOLVED" | sed -n 's/^LIVING=//p')

  [ -n "$DIR" ] && [ "$DIR" != "(none)" ] || continue
  [ -d "$REPO/$DIR" ] || continue
  # Unknown taxonomy: silence, never a guessed status word or section name.
  [ -n "$ACTIVE" ] && [ "$ACTIVE" != "(unknown)" ] || continue

  # Tolerant of cell spacing — not the exact byte sequence "| Status | X |".
  # ACTIVE itself is repo-supplied text, escaped before it enters a regex.
  ACTIVE_RE=$(printf '%s' "$ACTIVE" | sed -e 's/[.[\*^$()+?{|]/\\&/g')
  ROW_RE='^\|[[:space:]]*Status[[:space:]]*\|[[:space:]]*'"$ACTIVE_RE"'[[:space:]]*\|'

  # Newest first, so the one plan this firing may name (Track 2) is the one
  # most likely to be what the turn was about. The emptiness test is
  # load-bearing and not a style choice: `ls -t` with an EMPTY argument list
  # lists the current working directory, so an unguarded pipe would hand this
  # loop arbitrary filenames from wherever the hook happened to be invoked
  # and treat each as a plan path.
  MATCHES=$(grep -lE "$ROW_RE" "$REPO/$DIR"/*.md 2>/dev/null)
  [ -n "$MATCHES" ] || continue

  # shellcheck disable=SC2086
  for PLAN in $(ls -t $MATCHES 2>/dev/null); do
    case " $STILL_NUDGED " in
      *" $PLAN "*) continue ;;  # already asked about this session: stay silent
    esac
    case "$WRITTEN" in
      # This turn wrote the plan itself: silent, AND recorded as settled.
      # 0.8.0 skipped it with a bare `continue` placed before the set was
      # repopulated, so complying with the nudge is what dropped the plan from
      # the memo and re-armed it for the next turn — the two plans the model
      # actually wrote entries into were the two it was asked about most.
      *"$PLAN"*) STILL_NUDGED="$STILL_NUDGED $PLAN"; continue ;;
    esac

    # Track 2: at most one plan per firing. The scan does not stop here,
    # because the two cases above still have to run against the remaining
    # plans and the remaining repositories — that is what keeps a plan this
    # turn wrote out of the next firing no matter which repository it is in.
    [ -z "$MSG_BLOCKS" ] || continue

    if [ -n "$LIVING" ] && [ "$LIVING" != "(unknown)" ]; then
      # `vibe-ops plan resolve` already joins the sections with ", ". The `tr` is kept for a LIVING that
      # still arrives `|`-joined, and the collapse after it is what keeps either form from rendering a
      # double space.
      SECTIONS=$(printf '%s' "$LIVING" | tr '|' ',' | sed 's/,/, /g; s/,  */, /g')
      BODY="Those sections ($SECTIONS) are maintained while the work happens, not reconstructed afterwards — that reconstruction is worthless per this repository's own governance rule."
    else
      # Tier 2: the repo's template has no end marker (or none at all), so
      # the exact section list cannot be read — point at the source instead
      # of naming sections that might not exist there.
      TARGET="$TPL"
      [ "$TARGET" != "(none)" ] || TARGET="$AUTHORITY"
      BODY="This repository's living sections are the ones below the LIVING SECTIONS divider in \`$TARGET\` — check there rather than assuming a specific list."
    fi

    # Composed here rather than at the end: ACTIVE and BODY belong to the
    # repository being visited, and the loop keeps running after the pick.
    MSG_BLOCKS="$PLAN — status \"$ACTIVE\". $BODY"
    NUDGED_PLAN=$PLAN
    STILL_NUDGED="$STILL_NUDGED $PLAN"
  done
done

printf 'OFFSET=%s\nNUDGED=%s\n' "$NEW_OFFSET" "$STILL_NUDGED" >"$STATE" 2>/dev/null

[ -n "$MSG_BLOCKS" ] || exit 0

# Track 3: the firing is recorded on disk before the model is asked anything,
# because from here on the hook can no longer observe what happens — it has no
# access to the model's output, and the branch it most wants to count is the
# one that is now required to be silent. One tab-separated line: when, which
# session, which plan, and that plan's modification time at this instant. Was
# it written afterwards? Compare that recorded time against the file's now.
#
# Date-partitioned, and that is load-bearing rather than cosmetic: the sweep
# above ages out `vibe-ops-*` files by modification time, so one file per day
# falls out of the directory by machinery that already exists, while a single
# log rewritten on every firing would carry a fresh mtime forever and never be
# swept.
#
# Fails silent, never open, per ADR-0009 obligation 3 — a hook that cannot
# write its log still delivers its observation. `stat` is asked the BSD way
# and then the GNU way; neither is portable and the fallback costs one failed
# process on Linux.
LOG="$STATE_DIR/vibe-ops-nudge-log-$(date -u +%Y-%m-%d 2>/dev/null).tsv"
PLAN_MTIME=$(stat -f %m "$NUDGED_PLAN" 2>/dev/null || stat -c %Y "$NUDGED_PLAN" 2>/dev/null || printf '')
printf '%s\t%s\t%s\t%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)" "$SID" "$NUDGED_PLAN" "$PLAN_MTIME" \
  >>"$LOG" 2>/dev/null || true

TEXT="This turn wrote to a repository with an active plan whose living sections were not part of that write: $MSG_BLOCKS

If this turn taught or decided something worth the record, add an entry now (Observation:/Evidence: or Decision:/Rationale:/Date/Author:) before finishing.

If it did not, produce no output at all about this — no explanation, no mention of this note, no acknowledgement that it fired. End the turn as you otherwise would have. Declining is the expected outcome and is already recorded on disk; a paragraph explaining why nothing was owed is the cost this note exists to avoid, and the user did not ask for it. This will not ask again about this plan in this session."

# Hand-built JSON: a raw newline inside a JSON string is invalid, and a plan
# path is untrusted input, so both backslash/quote and the real newlines in
# TEXT must be escaped before this reaches stdout — the same pipeline
# task-dossier-guard.sh uses for its own REASON field.
ESC=$(printf '%s' "$TEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'NR>1{printf "\\n"}{printf "%s",$0}')
printf '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"%s"}}\n' "$ESC"
