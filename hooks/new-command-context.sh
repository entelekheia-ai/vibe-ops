#!/bin/sh
# vibe-ops — resolve the repository before /vibe-ops:new even starts.
#
# This is a second delivery path to scripts/resolve-governance.sh, never a second
# implementation of it. UserPromptExpansion fires only when the command is typed;
# when the model invokes the skill from a plain-language request the hook never
# runs, which is why the skill calls the same script itself. Both paths, one
# script — the hook only removes a round trip on the typed one.
#
# Matcher is the fully-qualified command name: a plugin skill arrives as
# "vibe-ops:new", not "new". Measured, not assumed.
set -u

IN=$(cat)

# The type is the first word of the arguments. Without one there is nothing to
# resolve — the skill will ask, which is correct.
ARGS=$(printf '%s' "$IN" \
  | sed -n 's/.*"command_args"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
TYPE=$(printf '%s' "$ARGS" | sed -n 's/^[[:space:]]*\([a-z][a-z]*\).*/\1/p')

case "$TYPE" in
  adr|rfc|plan|task) ;;
  *) exit 0 ;;
esac

SELF=$0
case "$SELF" in /*) ;; *) SELF="$(pwd)/$SELF" ;; esac
ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$SELF")")}"
RESOLVER="$ROOT/scripts/resolve-governance.sh"
[ -f "$RESOLVER" ] || exit 0

OUT=$(sh "$RESOLVER" "$TYPE" 2>/dev/null) || exit 0
[ -n "$OUT" ] || exit 0

if command -v jq >/dev/null 2>&1; then
  printf '%s' "$OUT" | jq -Rsc \
    '{hookSpecificOutput:{hookEventName:"UserPromptExpansion",additionalContext:("Already resolved for this repository — do not run the resolver again this turn:\n\n" + .)}}'
else
  ESC=$(printf '%s' "$OUT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/	/\\t/g' \
    | awk 'NR>1{printf "\\n"}{printf "%s",$0}')
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptExpansion","additionalContext":"Already resolved for this repository — do not run the resolver again this turn:\\n\\n%s"}}\n' "$ESC"
fi
