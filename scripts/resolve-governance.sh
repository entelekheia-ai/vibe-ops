#!/bin/sh
# vibe-ops — resolve everything the `new` skill needs to create one governance
# record, in a single call.
#
# usage: resolve-governance.sh <adr|rfc|plan|task> [--with-template]
#
# Prints a KEY=value block describing this repository's setup, then the rules
# for the record type asked for. The type is known at call time, so the rules
# do not need a second lookup — that is the whole point of returning them here.
#
# It anchors on the git toplevel, NOT on CLAUDE_PROJECT_DIR: in a workspace
# whose project root is an umbrella repository containing independent repos,
# CLAUDE_PROJECT_DIR names the umbrella and every number resolved from it is
# the wrong repository's.
set -u

TYPE="${1:-}"
WITH_TPL=no
[ "$#" -gt 0 ] && shift
for a in "$@"; do
  case "$a" in
    --with-template) WITH_TPL=yes ;;
    *) printf 'resolve-governance: unknown option %s\n' "$a" >&2; exit 2 ;;
  esac
done

# Where this script lives, resolved before any cd. CLAUDE_PLUGIN_ROOT is set for
# plugin-spawned processes; the $0 fallback keeps the script runnable by hand.
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  PLUGIN_ROOT=$CLAUDE_PLUGIN_ROOT
else
  SELF=$0
  case "$SELF" in /*) ;; *) SELF="$(pwd)/$SELF" ;; esac
  PLUGIN_ROOT=$(dirname "$(dirname "$SELF")")
fi

# DEPTH is 2 only for rfc: an implemented or rejected RFC moves into a subfolder
# and must keep owning its number, or the next one collides with it.
case "$TYPE" in
  adr)  DIRS="project/adr adr docs/adr";                    TPLS="project/templates/adr.md templates/adr.md .agents/templates/adr.md";    DEFAULT_PAD=4; DEPTH=1 ;;
  rfc)  DIRS="project/rfc project/rfcs rfc rfcs docs/rfc";  TPLS="project/templates/rfc.md templates/rfc.md .agents/templates/rfc.md";    DEFAULT_PAD=4; DEPTH=2 ;;
  plan) DIRS="project/plans plans docs/plans";              TPLS="project/templates/plan.md templates/plan.md .agents/templates/plan.md"; DEFAULT_PAD=3; DEPTH=1 ;;
  task) DIRS="project/tasks tasks";                         TPLS="project/templates/task.md templates/task.md .agents/templates/task.md"; DEFAULT_PAD=3; DEPTH=1 ;;
  *)    printf 'usage: resolve-governance.sh <adr|rfc|plan|task> [--with-template]\n' >&2; exit 2 ;;
esac

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || ROOT=$(pwd)
cd "$ROOT" || exit 1

DIR="(none)"
for d in $DIRS; do
  if [ -d "$d" ]; then DIR=$d; break; fi
done

TPL="(none)"
for t in $TPLS; do
  if [ -f "$t" ]; then TPL=$t; break; fi
done

# Numbering authority, in the order the skills have always used it. A repo that
# predates the convention may define its own scheme next to the artifacts.
AUTHORITY="(default)"
if [ "$DIR" != "(none)" ] && [ -f "$DIR/AGENTS.md" ]; then
  AUTHORITY="$DIR/AGENTS.md"
elif [ -f .agents/rules/governance.md ]; then
  AUTHORITY=.agents/rules/governance.md
fi

EXISTING=0
LAST=""
PAD=$DEFAULT_PAD
if [ "$DIR" != "(none)" ]; then
  # A governance directory may also hold its own AGENTS.md, a README or an
  # INDEX. Counting those as records is how a resolver hands back a number that
  # already exists.
  RECORDS=$(find "$DIR" -maxdepth "$DEPTH" -name '*.md' 2>/dev/null | sed 's|.*/||' \
    | grep -viE '^(AGENTS|README|INDEX|CONTRIBUTING)\.md$' || true)
  EXISTING=$(printf '%s' "$RECORDS" | grep -c . || true)
  # Numbered records only. A repo using a custom scheme (DA01-02-slug.md) hits
  # nothing here on purpose — AUTHORITY is what tells the skill to look further.
  NUMS=$(printf '%s\n' "$RECORDS" | sed -n 's/^\([0-9][0-9]*\)-.*\.md$/\1/p')
  if [ -n "$NUMS" ]; then
    LAST=$(printf '%s\n' "$NUMS" | sort -n | tail -1)
    PAD=$(printf '%s' "$LAST" | wc -c | tr -d ' ')
  fi
fi

if [ -z "$LAST" ] && [ "$EXISTING" -gt 0 ]; then
  # Records exist but none is numbered the way this script understands. Saying
  # "001" here would be a confident wrong answer in a repo that numbers its
  # records some other way — the authority file is what knows.
  NEXT="(unknown — $EXISTING record(s) present, none numbered; follow AUTHORITY)"
else
  N=$(printf '%s' "${LAST:-0}" | sed 's/^0*//')
  [ -n "$N" ] || N=0
  NEXT=$(printf "%0${PAD}d" $((N + 1)))
fi

# Plan-only: this repo's own status vocabulary and living-section names, derived
# rather than assumed — a consumer (the Stop-hook nudge) must never hardcode
# vibe-ops's own taxonomy, because an installed repo is free to use a different
# one. (unknown) is a legitimate answer; a consumer that gets it must degrade,
# never guess a section name that does not exist in the target repo.
PLAN_ACTIVE="(unknown)"
LIVING="(unknown)"
if [ "$TYPE" = plan ]; then
  SRC=""
  [ "$TPL" != "(none)" ] && [ -f "$TPL" ] && SRC="$TPL"

  # The active status: middle term of "Status lifecycle: A → B → C." in the
  # template. Middle-of-N, not literally index 2, so a repo with a longer or
  # shorter chain than three states still gets a plausible answer instead of
  # a hardcoded assumption of three.
  extract_mid_arrow() { # $1 = a line containing N terms joined by "→"
    printf '%s\n' "$1" | awk -F'→' '{
      n = NF; mid = int((n + 1) / 2); if (mid < 1) mid = 1
      s = $mid; gsub(/^[ \t]+|[ \t]+$/, "", s); print s
    }'
  }

  if [ -n "$SRC" ]; then
    CHAIN=$(grep -m1 'Status lifecycle:' "$SRC" 2>/dev/null \
      | sed -e 's/.*Status lifecycle:[[:space:]]*//' -e 's/\..*$//')
    [ -n "$CHAIN" ] && PLAN_ACTIVE=$(extract_mid_arrow "$CHAIN")
    [ -n "$PLAN_ACTIVE" ] || PLAN_ACTIVE="(unknown)"
  fi
  if [ "$PLAN_ACTIVE" = "(unknown)" ] && [ "$AUTHORITY" != "(default)" ] && [ -f "$AUTHORITY" ]; then
    # Fallback for a repo with no template but a governance rule: the first
    # bare arrow-chain line within a few lines of a heading naming "Plan". A
    # rule that does not look like this is exactly what (unknown) is for.
    CHAIN=$(awk '
      /^#+.*[Pp]lan/ { near = 8; next }
      near > 0 { near--; if ($0 ~ /→/) { print; exit } }
    ' "$AUTHORITY")
    [ -n "$CHAIN" ] && PLAN_ACTIVE=$(extract_mid_arrow "$CHAIN")
    [ -n "$PLAN_ACTIVE" ] || PLAN_ACTIVE="(unknown)"
  fi

  # The living section names: only from between the two markers in the
  # template, and only when BOTH are present. One marker without the other is
  # treated the same as neither — a consumer must not guess where the list
  # stops.
  if [ -n "$SRC" ] && grep -q '===== LIVING SECTIONS' "$SRC" 2>/dev/null \
     && grep -q '===== END LIVING SECTIONS' "$SRC" 2>/dev/null; then
    LIVING=$(awk '
      /===== LIVING SECTIONS/ { on = 1; next }
      /===== END LIVING SECTIONS/ { on = 0 }
      on && /^## / { sub(/^## /, ""); printf "%s%s", (n++ ? "|" : ""), $0 }
    ' "$SRC")
    [ -n "$LIVING" ] || LIVING="(unknown)"
  fi
fi

printf '# resolve-governance: type=%s root=%s\n' "$TYPE" "$ROOT"
printf 'DIR=%s\n' "$DIR"
printf 'TPL=%s\n' "$TPL"
printf 'AUTHORITY=%s\n' "$AUTHORITY"
printf 'PAD=%s\n' "$PAD"
printf 'EXISTING=%s\n' "$EXISTING"
printf 'NEXT=%s\n' "$NEXT"
if [ "$TYPE" = plan ]; then
  printf 'PLAN_ACTIVE=%s\n' "$PLAN_ACTIVE"
  printf 'LIVING=%s\n' "$LIVING"
fi

# GitHub facts, for the one record type whose identity depends on an issue.
if [ "$TYPE" = task ]; then
  REMOTE=$(git remote get-url origin 2>/dev/null \
    | sed -e 's|^git@[^:]*:||' -e 's|^https\{0,1\}://[^/]*/||' -e 's|\.git$||')
  printf 'GH_REMOTE=%s\n' "${REMOTE:-(none)}"
  if ! command -v gh >/dev/null 2>&1; then
    printf 'GH_AUTH=absent\n'
  elif gh auth status >/dev/null 2>&1; then
    printf 'GH_AUTH=ok\n'
  else
    printf 'GH_AUTH=no\n'
  fi
fi

RULES="$PLUGIN_ROOT/references/records/$TYPE.md"
printf '\n===== RULES: %s =====\n' "$TYPE"
if [ -f "$RULES" ]; then
  cat "$RULES"
else
  printf '(missing: %s — this install predates the file; fall back to the skill body)\n' "$RULES"
fi

if [ "$WITH_TPL" = yes ] && [ "$TPL" != "(none)" ]; then
  printf '\n===== TEMPLATE: %s =====\n' "$TPL"
  cat "$TPL"
fi
