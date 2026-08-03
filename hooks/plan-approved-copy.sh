#!/bin/sh
# vibe-ops — copy an approved plan-mode plan into its repository's project/plans/,
# and tell the model where it landed.
#
# Why PostToolUse matching ExitPlanMode: documented, current behaviour — on
# approval, tool_response carries {plan, filePath} for the approved plan
# (docs.claude.com/en/docs/claude-code/hooks, ExitPlanMode section). PostToolUse
# only ever fires on success, and a manual rejection is explicitly excluded from
# PostToolUseFailure and PermissionDenied too — so for this one tool, "the hook
# fired at all" already means "approved". No outcome branching needed.
# Confirmed unusable in headless mode (`claude -p`, both text and stream-json):
# ExitPlanMode does not exist as a callable tool there at all, by design —
# project/tasks/004-post-plan-hook.md records the two live runs that showed this.
# That is a headless-only fact; it does not apply to the interactive sessions
# this hook actually runs in.
#
# jq required, not optional: the plan text is untrusted multi-line markdown that
# can carry quotes, backslashes and code fences. Extracting it correctly with sed
# the way this plugin's other hooks do for a single short field is not a shortcut
# worth the risk for prose this shaped — a parser mistake here corrupts a
# document, not just a nudge. Skip silently where jq is absent; do not attempt a
# best-effort parse (ADR-0009 obligation 3: fail closed or fail silent).
#
# Never the only implementation: /vibe-ops:new plan still exists, for a plan
# written outside plan mode or an older plan-mode file this hook never saw.
set -u

IN=$(cat)
[ -n "$IN" ] || exit 0

command -v jq >/dev/null 2>&1 || exit 0

PLAN_TEXT=$(printf '%s' "$IN" | jq -r '.tool_response.plan // empty' 2>/dev/null)
[ -n "$PLAN_TEXT" ] || exit 0
FILE_PATH=$(printf '%s' "$IN" | jq -r '.tool_response.filePath // empty' 2>/dev/null)
CWD=$(printf '%s' "$IN" | jq -r '.cwd // empty' 2>/dev/null)

# Cheap-exit gate (ADR-0009 obligation 1, applied to content rather than the
# payload envelope — the matcher already narrowed the event to ExitPlanMode
# successes, which are rare on their own): an H1 and a metadata table with a
# Status row is what plan-mode-context.sh asks for only when the turn intends a
# durable design record. A throwaway plan has neither and is never copied.
printf '%s\n' "$PLAN_TEXT" | grep -qE '^# ' || exit 0
printf '%s\n' "$PLAN_TEXT" | grep -qE '^\|[[:space:]]*Status[[:space:]]*\|' || exit 0

# Which repository. An explicit | Repository | <path> | row wins — written only
# when plan-mode-context.sh detected the session's project root was not the
# target repo (see that hook). Otherwise the tool's own cwd, resolved to its git
# toplevel: correct for the overwhelmingly common single-repo case.
REPO=$(printf '%s\n' "$PLAN_TEXT" \
  | sed -n 's/^|[[:space:]]*Repository[[:space:]]*|[[:space:]]*\([^|]*[^|[:space:]]\)[[:space:]]*|.*/\1/p' \
  | head -1)
case "$REPO" in
  '<'*|'') REPO="" ;;  # empty cell, or the template's own placeholder comment leaked through
esac
if [ -z "$REPO" ]; then
  [ -n "$CWD" ] || exit 0
  REPO=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null) || exit 0
  REPO_HOW="this session's working directory"
else
  REPO_HOW="the plan's own Repository row"
fi
[ -d "$REPO" ] || exit 0

# Where this script and its siblings live, resolved before any cd.
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  ROOT=$CLAUDE_PLUGIN_ROOT
else
  SELF=$0
  case "$SELF" in /*) ;; *) SELF="$(pwd)/$SELF" ;; esac
  ROOT=$(dirname "$(dirname "$SELF")")
fi
RESOLVER="$ROOT/scripts/resolve-governance.sh"
[ -f "$RESOLVER" ] || exit 0

RESOLVED=$(cd "$REPO" 2>/dev/null && sh "$RESOLVER" plan 2>/dev/null) || exit 0
PLAN_DIR=$(printf '%s\n' "$RESOLVED" | sed -n 's/^DIR=//p')
NEXT=$(printf '%s\n' "$RESOLVED" | sed -n 's/^NEXT=//p')
[ -n "$PLAN_DIR" ] && [ "$PLAN_DIR" != "(none)" ] || exit 0
case "${NEXT:-}" in ''|'(unknown'*) exit 0 ;; esac

# Slug from the H1: strip a leading "Plan-<id>:" the model may already have
# written, lowercase, collapse anything non-alnum into one hyphen, trim ends,
# cap length so a long title does not produce an unusable filename.
TITLE=$(printf '%s\n' "$PLAN_TEXT" | grep -m1 -E '^# ' | sed -e 's/^# *//' -e 's/^Plan-[A-Za-z0-9]*:[[:space:]]*//i')
SLUG=$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-60)
[ -n "$SLUG" ] || SLUG="untitled"

TARGET="$REPO/$PLAN_DIR/$NEXT-$SLUG.md"

# Copy, never move, never overwrite. The source under ~/.claude/plans/ is Claude
# Code's own; the tool result already tells the model it can refer back to it.
#
# This check keys on TARGET, not the source planFilePath — deliberately, even
# though NEXT is always freshly resolved from disk, which means TARGET can
# never already exist on a normal single firing (the highest existing number is
# exactly what NEXT is one past). Two different plans approved from the same
# source file in one session — observed this session, Plan-005 then Plan-006 —
# already get two different numbers for free from that fresh resolution; no
# guard was needed for that case specifically. What this guards against is a
# genuine double-delivery of the same event (a duplicate hook registration, a
# runtime retry) racing between two invocations before either's file exists —
# cheap insurance for a failure mode that would otherwise silently double-file
# the same plan under two numbers.
[ -f "$TARGET" ] && exit 0

mkdir -p "$REPO/$PLAN_DIR" 2>/dev/null || exit 0
printf '%s\n' "$PLAN_TEXT" > "$TARGET" 2>/dev/null || exit 0

# Flag a stale number rather than rewriting the H1 — text surgery on a heading a
# human may have hand-edited is worse than asking the model to fix one line.
NUMBER_NOTE=""
printf '%s\n' "$PLAN_TEXT" | grep -qE "Plan-$NEXT" || \
  NUMBER_NOTE=" The plan's own heading and metadata table may still show a guessed or stale number — correct them to $NEXT to match the filename."

MSG="An approved plan-mode plan was copied to \`$TARGET\` in repository \`$REPO\`, resolved from $REPO_HOW. This copy is now the record — make further edits there, not at \`$FILE_PATH\`.$NUMBER_NOTE The filename's slug (\`$SLUG\`) is this hook's guess from the heading; rename the file if it reads badly."

jq -nc --arg msg "$MSG" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$msg}}'
