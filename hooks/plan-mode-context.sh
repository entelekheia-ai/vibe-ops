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

ROOT="${CLAUDE_PROJECT_DIR:-.}"

# 2. A repository that keeps plans, with a template to keep them in. Discovery
#    order matches skills/new-plan/SKILL.md Step 0 — keep the two in sync.
PLAN_DIR=""
for d in project/plans plans docs/plans; do
  if [ -d "$ROOT/$d" ]; then PLAN_DIR="$d"; break; fi
done
[ -n "$PLAN_DIR" ] || exit 0

PLAN_TPL=""
for t in project/templates/plan.md templates/plan.md .agents/templates/plan.md; do
  if [ -f "$ROOT/$t" ]; then PLAN_TPL="$t"; break; fi
done
[ -n "$PLAN_TPL" ] || exit 0

# 3. Once per session. Plan mode spans several turns while the user iterates;
#    the injected text stays in the transcript, so repeating it only costs.
SID=$(printf '%s' "$IN" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
STATE="${CLAUDE_PLUGIN_DATA:-${TMPDIR:-/tmp}}"
MARK="$STATE/vibe-ops-plan-mode-${SID:-nosession}"
[ -e "$MARK" ] && exit 0

# 4. The next number, read from disk. An injected format without it manufactures
#    a collision: the model will otherwise write Plan-001 into a full directory.
LAST=$(ls "$ROOT/$PLAN_DIR" 2>/dev/null | sed -n 's/^\([0-9][0-9][0-9]\)-.*\.md$/\1/p' | sort -n | tail -1)
LAST=$(printf '%s' "${LAST:-0}" | sed 's/^0*//')
[ -n "$LAST" ] || LAST=0
NEXT=$(printf '%03d' $((LAST + 1)))

# 5. Hand-built JSON, so a path carrying a quote or a backslash must not reach
#    stdout — a malformed hook payload is reported to the user as an error.
case "$PLAN_DIR$PLAN_TPL" in
  *'"'* | *'\'*) exit 0 ;;
esac

mkdir -p "$STATE" 2>/dev/null
: >"$MARK" 2>/dev/null

printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' \
  "This repository keeps implementation plans as permanent design records in \`$PLAN_DIR\`, written from the template at \`$PLAN_TPL\`. If this planning turn is going to produce a durable design record rather than a one-off change, read that template first and give the plan-mode plan its structure: the H1 title, the metadata table, Summary, Goals, Scope (In and Out), Design, Tracks, Success criteria, and the four living sections (Progress, Surprises & Discoveries, Decision Log, Outcomes & Retrospective). Write it in English regardless of the language of the conversation. Where there is no material for a section, leave an honest stub rather than inventing content. The next plan number in this repository is $NEXT — do not guess one. None of this asks you to create or move any file: it shapes the plan you were already going to write, and saving it into \`$PLAN_DIR\` happens only if the user asks, through /vibe-ops:new-plan."
