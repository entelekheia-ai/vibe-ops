#!/bin/sh
# vibe-ops — refuse to delete a task dossier whose closure never ran.
#
# The dossier is the only artifact in the lifecycle that is deleted on purpose,
# and everything it taught is promoted during /vibe-ops:close-task. Deleting it
# by hand loses that silently, which is the failure close-task exists to prevent
# and could not prevent, because prose cannot fire at the moment of the act.
#
# It invents no convention: the task template already ships the marker —
#   "- [ ] Run /vibe-ops:close-task ... Stays unchecked until closure actually
#    runs; a dossier that looks otherwise finished but has this box open is not
#    done."
# This hook is a reader for that box. Ticking it is close-task's Step 6, so the
# ceremony passes through and only a hand deletion is stopped.
set -u

IN=$(cat)

# Cheap exit first: no tasks path anywhere in the payload means nothing to do.
case "$IN" in
  *tasks/*) ;;
  *) exit 0 ;;
esac

# The command, as the model wrote it. jq when present because it unescapes
# correctly; the sed path handles the escaped-string form well enough to find a
# path, and both are only ever used to *locate* files that are then read.
if command -v jq >/dev/null 2>&1; then
  CMD=$(printf '%s' "$IN" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  CMD=$(printf '%s' "$IN" \
    | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(\([^"\\]\|\\.\)*\)".*/\1/p' \
    | sed -e 's/\\"/"/g' -e 's/\\\\/\\/g')
fi
[ -n "$CMD" ] || exit 0

# Only deletions. A command that reads or edits a dossier is none of our business.
case "$CMD" in
  *rm\ * | *rm\	* | *unlink\ *) ;;
  *) exit 0 ;;
esac

BLOCKED=""
for TOKEN in $CMD; do
  # Strip quoting the shell would have removed anyway.
  P=$(printf '%s' "$TOKEN" | sed -e 's/^["'\'']//' -e 's/["'\'']$//')
  case "$P" in
    *tasks/*.md) ;;
    *) continue ;;
  esac
  [ -f "$P" ] || continue
  # An unchecked box naming close-task is the whole test. A dossier from a repo
  # that never adopted the convention has no such line and is not our business.
  if grep -qE '^[[:space:]]*-[[:space:]]*\[[[:space:]]*\].*close-task' "$P" 2>/dev/null; then
    BLOCKED="$BLOCKED $P"
  fi
done

[ -n "$BLOCKED" ] || exit 0

REASON="Refusing to delete a task dossier whose closure has not run:$BLOCKED
Each of these still has its '- [ ] Run /vibe-ops:close-task' box unchecked, which by the template's own definition means the task is not done however finished it looks.
Run /vibe-ops:close-task instead. It writes back to the document that started the work, propagates to living docs, spawns an ADR if a decision emerged, and routes every Surprises & Discoveries entry through the promotion test - then ticks that box and deletes the dossier itself, leaving the breadcrumb behind. Everything it promotes is lost if the file goes first."

# Hand-built JSON: newlines and quotes in REASON must be escaped, and a path
# carrying either would otherwise produce a payload the user sees as an error.
if command -v jq >/dev/null 2>&1; then
  jq -nc --arg r "$REASON" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
else
  ESC=$(printf '%s' "$REASON" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'NR>1{printf "\\n"}{printf "%s",$0}')
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$ESC"
fi
