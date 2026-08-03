#!/bin/sh
# vibe-ops — place the repository's plan format at the moment of planning.
#
# Why a hook and not a line in an instruction file: a plan-mode plan is written
# before any governance file under project/ has been read, and the format has to
# be present at that instant. It also carries the next plan number, which is
# state on disk that no static instruction can know.
# Rationale and measurements: project/research/positioned-context-and-hooks.md
#
# Deliberately dependency-free (no jq): it runs on every prompt, so it must cost
# a shell builtin in the common case and nothing else.
set -u

IN=$(cat)

# 1. Plan mode, or nothing. This is the guard that makes the hook free — every
#    other turn in every other repository leaves here, on a builtin.
case "$IN" in
  *'"permission_mode":"plan"'* | *'"permission_mode": "plan"'*) ;;
  *) exit 0 ;;
esac

# 2. Once per session. Plan mode spans several turns while the user iterates;
#    the injected text stays in the transcript, so repeating it only costs.
SID=$(printf '%s' "$IN" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
STATE="${CLAUDE_PLUGIN_DATA:-${TMPDIR:-/tmp}}"
MARK="$STATE/vibe-ops-plan-mode-${SID:-nosession}"
[ -e "$MARK" ] && exit 0

# 3. Everything about the repository comes from the resolver — the same one
#    /new calls. Do not re-derive it here: an earlier version of this hook
#    carried its own copy of the discovery loops and anchored on
#    CLAUDE_PROJECT_DIR, which in a workspace whose project root is an umbrella
#    repository names the umbrella. It reported the wrong repo's next number.
SELF=$0
case "$SELF" in /*) ;; *) SELF="$(pwd)/$SELF" ;; esac
ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$SELF")")}"
RESOLVER="$ROOT/scripts/resolve-governance.sh"
[ -f "$RESOLVER" ] || exit 0

RESOLVED=$(sh "$RESOLVER" plan 2>/dev/null) || exit 0
RESOLVED_ROOT=$(printf '%s\n' "$RESOLVED" | sed -n 's/^# resolve-governance:.*root=//p')
PLAN_DIR=$(printf '%s\n' "$RESOLVED" | sed -n 's/^DIR=//p')
PLAN_TPL=$(printf '%s\n' "$RESOLVED" | sed -n 's/^TPL=//p')
NEXT=$(printf '%s\n' "$RESOLVED" | sed -n 's/^NEXT=//p')

# A repository that keeps no plans, or keeps them without a template, is not one
# this hook has anything to say to.
[ "$PLAN_DIR" = "(none)" ] && exit 0
[ "$PLAN_TPL" = "(none)" ] && exit 0

# 4. Hand-built JSON, so nothing carrying a quote or a backslash may reach
#    stdout — a malformed hook payload is reported to the user as an error.
case "$PLAN_DIR$PLAN_TPL$NEXT" in
  *'"'* | *'\'*) exit 0 ;;
esac

mkdir -p "$STATE" 2>/dev/null
: >"$MARK" 2>/dev/null

# Ask for the plan's own | Repository | row only when there is real ambiguity to
# resolve — the resolver's own git toplevel differs from the session's nominal
# project dir, which is exactly the umbrella-workspace case
# (project/learnings/plans-directory-is-one-static-path-inside-the-project-root.md).
# A single-repo session never sees this sentence, so its plans stay uncluttered.
REPO_ROW=""
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ "$CLAUDE_PROJECT_DIR" != "$RESOLVED_ROOT" ]; then
  REPO_ROW=" This session's project root is not the repository this plan belongs to — add a \`| Repository | $RESOLVED_ROOT |\` row to the metadata table (the resolved repository's absolute path, nothing else in the cell) so a later automated step files the plan correctly without re-guessing."
fi

printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' \
  "This repository keeps implementation plans as permanent design records in \`$PLAN_DIR\`, written from the template at \`$PLAN_TPL\`. If this planning turn is going to produce a durable design record rather than a one-off change, read that template first and give the plan-mode plan its structure: the H1 title, the metadata table, Summary, Goals, Scope (In and Out), Design, Tracks, Success criteria, and the four living sections (Progress, Surprises & Discoveries, Decision Log, Outcomes & Retrospective). Write it in English regardless of the language of the conversation. Where there is no material for a section, leave an honest stub rather than inventing content. The next plan number in this repository is $NEXT — do not guess one.$REPO_ROW An approved plan matching this shape is copied into \`$PLAN_DIR\` automatically; /vibe-ops:new plan is only for a plan written outside plan mode, or an older plan-mode file never picked up."
