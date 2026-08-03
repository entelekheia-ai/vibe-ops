#!/bin/sh
# vibe-ops — the mechanical tail of /vibe-ops:close-task.
#
# usage: finalize.sh [--dry-run] [--plan <path>] [--summary-file <path>] <dossier>...
#
# Everything here is deterministic and ordering-sensitive, which is exactly the
# part prose keeps getting wrong. The judgement — the write-back, the promotion
# test, whether an ADR is needed, the text of the summary — stays in the skill
# and never enters this script.
#
# The ordering that matters: the breadcrumb sha must name a commit that STILL
# CONTAINS the dossier, so the tick is committed first and the deletion second.
#
# Two failures this encodes, both of which already happened:
#   - deleting dossiers left 13 links dangling across two documents, because the
#     link check ran before the deletion rather than after;
#   - closures come in batches, so referrers are collected across the whole set
#     before anything is removed.
set -u

DRY=no
PLAN=""
SUMMARY=""
DOSSIERS=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)      DRY=yes ;;
    --plan)         shift; PLAN="${1:-}" ;;
    --summary-file) shift; SUMMARY="${1:-}" ;;
    -h|--help)
      printf 'usage: finalize.sh [--dry-run] [--plan <path>] [--summary-file <path>] <dossier>...\n'
      exit 0 ;;
    -*) printf 'finalize: unknown option %s\n' "$1" >&2; exit 2 ;;
    *)  DOSSIERS="$DOSSIERS $1" ;;
  esac
  shift
done

[ -n "$DOSSIERS" ] || { printf 'finalize: no dossier given\n' >&2; exit 2; }

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { printf 'finalize: not a git repository\n' >&2; exit 2; }
cd "$ROOT" || exit 1

say() { printf '%s\n' "$*"; }
run() {
  if [ "$DRY" = yes ]; then say "  would run: $*"; else "$@" || exit 1; fi
}

for d in $DOSSIERS; do
  [ -f "$d" ] || { printf 'finalize: no such dossier: %s\n' "$d" >&2; exit 2; }
done
[ -z "$PLAN" ] || [ -f "$PLAN" ] || { printf 'finalize: no such plan: %s\n' "$PLAN" >&2; exit 2; }

# ---------------------------------------------------------------- step 0
# Referrers, collected across the whole batch BEFORE anything is deleted. After
# the deletion this information is gone and the repair is manual.
say "== referrers (collected before any deletion)"
REFERRERS=""
for d in $DOSSIERS; do
  BASE=$(printf '%s' "$d" | sed 's|.*/||')
  HITS=$(git grep -l -F "$BASE" -- . 2>/dev/null | grep -v -F "$d" || true)
  for h in $HITS; do
    say "  $h -> $d"
    case " $REFERRERS " in *" $h "*) ;; *) REFERRERS="$REFERRERS $h" ;; esac
  done
done
[ -n "$REFERRERS" ] || say "  (none)"

# ---------------------------------------------------------------- step 1
# Tick the Closure box. This is what the deletion guard reads, so it has to
# happen here and not be left to the model.
say "== tick the Closure box"
for d in $DOSSIERS; do
  if grep -qE '^[[:space:]]*-[[:space:]]*\[[[:space:]]*\].*close-task' "$d"; then
    if [ "$DRY" = yes ]; then
      say "  would tick: $d"
    else
      TMP="$d.finalize.tmp"
      sed 's/^\([[:space:]]*-[[:space:]]*\)\[[[:space:]]*\]\(.*close-task\)/\1[x]\2/' "$d" > "$TMP" && mv "$TMP" "$d"
      say "  ticked: $d"
    fi
  else
    say "  already ticked or no box: $d"
  fi
done

# ---------------------------------------------------------------- step 2 & 3
# Commit the tick — this commit is the one the breadcrumb names, because it is
# the last one that still contains the dossier. Stage by name only: other agents
# work in these repositories concurrently and `git add -A` has already swept a
# sibling's in-flight edits into an unrelated commit.
say "== commit the tick (this becomes the breadcrumb commit)"
SLUGS=$(for d in $DOSSIERS; do printf '%s ' "$(printf '%s' "$d" | sed -e 's|.*/||' -e 's|\.md$||')"; done)
STAGE=$DOSSIERS
[ -z "$PLAN" ] || STAGE="$STAGE $PLAN"
run git add $STAGE
if [ "$DRY" = yes ]; then
  say "  would run: git commit -m \"docs(tasks): record closure for$(printf '%s' " $SLUGS" | sed 's/ *$//')\""
  SHA="<sha of the commit this would create>"
else
  git commit -q -m "docs(tasks): record closure for$(printf '%s' " $SLUGS" | sed 's/ *$//')" || exit 1
  SHA=$(git rev-parse HEAD)
fi
say "  DOSSIER_SHA=$SHA"

# ---------------------------------------------------------------- step 4 & 5
say "== delete the dossiers and repoint what referred to them"
run git rm -q $DOSSIERS

# A closed dossier is named in plain text with a runnable git show, never left
# as a link: a link to a deleted file makes a healthy repository look broken.
for r in $REFERRERS; do
  [ -f "$r" ] || continue
  for d in $DOSSIERS; do
    BASE=$(printf '%s' "$d" | sed 's|.*/||')
    if [ "$DRY" = yes ]; then
      say "  would repoint in $r: links to $BASE -> plain text + git show $SHA:$d"
    else
      # [`text`](any/path/<base>) -> `text` (closed; git show <sha>:<path>)
      perl -0pi -e "s{\\[([^\\]]*)\\]\\([^)]*\\Q$BASE\\E\\)}{\$1 (closed dossier - \`git show $SHA:$d\`)}g" "$r"
    fi
  done
  [ "$DRY" = yes ] || say "  repointed: $r"
done

if [ -n "$PLAN" ]; then
  LINE="- Task dossiers closed and removed per the task lifecycle (\`Planned -> In Progress -> Done -> file removed, git history is the archive\`):"
  if [ "$DRY" = yes ]; then
    say "  would append the breadcrumbs to $PLAN"
  else
    { printf '\n%s\n' "$LINE"
      for d in $DOSSIERS; do printf '  - `git show %s:%s`\n' "$SHA" "$d"; done
    } >> "$PLAN"
    say "  breadcrumbs appended to $PLAN"
  fi
fi

# ---------------------------------------------------------------- step 6
say "== commit the deletion together with the repointed referrers"
# NOT the dossiers: `git rm` already staged their deletion, and naming a file
# that no longer exists makes `git add` exit with a pathspec error that drops
# every other path in the same invocation - the commit then silently never
# happens. Stage only what still exists on disk.
STAGE2=""
[ -z "$PLAN" ] || STAGE2="$PLAN"
for r in $REFERRERS; do
  case " $STAGE2 " in *" $r "*) ;; *) STAGE2="$STAGE2 $r" ;; esac
done
if [ -n "$STAGE2" ]; then run git add $STAGE2; else say "  (nothing beyond the deletion to stage)"; fi
if [ "$DRY" = yes ]; then
  say "  would run: git commit -m \"chore(tasks): close$(printf '%s' " $SLUGS" | sed 's/ *$//'), archived in history\""
  PLAN_SHA="<sha of the commit this would create>"
else
  git commit -q -m "chore(tasks): close$(printf '%s' " $SLUGS" | sed 's/ *$//'), archived in history" || exit 1
  PLAN_SHA=$(git rev-parse HEAD)
fi
say "  PLAN_SHA=$PLAN_SHA"

# ---------------------------------------------------------------- step 7
# After the deletion, not before. Running it before is exactly how the dangling
# links got committed the first time.
say "== link check, run AFTER the deletion"
if [ "$DRY" = yes ]; then
  say "  skipped under --dry-run: nothing was deleted, so a pass here would mean nothing"
  say ""
  say "DOSSIER_SHA=$SHA"
  say "PLAN_SHA=$PLAN_SHA"
  exit 0
fi
SELF=$0
case "$SELF" in /*) ;; *) SELF="$(pwd)/$SELF" ;; esac
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(dirname "$SELF")")")}"
CHECK="$PLUGIN_ROOT/scripts/check-agents-md.sh"
if [ -f "$CHECK" ]; then
  bash "$CHECK" . 2>&1 | grep -iE '^(ok|FAIL|SKIP)[[:space:]]+\[links\]' || say "  (links check produced no line)"
else
  say "  (validator not found at $CHECK - run the repo's own link check)"
fi

# ---------------------------------------------------------------- step 8
say "== issue comment"
if [ -z "$SUMMARY" ]; then
  say "  no --summary-file given; nothing posted"
elif [ "$DRY" = yes ]; then
  say "  skipped under --dry-run (posting to an issue is outward-facing and not reversible)"
else
  ISSUE=""
  # The issue is whatever the plan or the last dossier's history pointed at; the
  # dossier is gone by now, so read it out of the breadcrumb commit.
  for d in $DOSSIERS; do
    N=$(git show "$SHA:$d" 2>/dev/null | sed -n 's/.*issues\/\([0-9][0-9]*\).*/\1/p' | head -1)
    [ -n "$N" ] && { ISSUE=$N; break; }
  done
  if [ -z "$ISSUE" ] && [ -n "$PLAN" ]; then
    ISSUE=$(sed -n 's/.*issues\/\([0-9][0-9]*\).*/\1/p' "$PLAN" | head -1)
  fi
  if [ -z "$ISSUE" ]; then
    say "  no issue number found in the dossiers or the plan; nothing posted"
  elif ! command -v gh >/dev/null 2>&1; then
    say "  gh not installed; nothing posted"
  else
    BODY=$(mktemp)
    cat "$SUMMARY" > "$BODY"
    { printf '\n'
      printf 'The dossier%s below %s removed by the task lifecycle, not lost — the full content is in history:\n\n' \
        "$(set -- $DOSSIERS; [ "$#" -gt 1 ] && printf 's' || printf '')" \
        "$(set -- $DOSSIERS; [ "$#" -gt 1 ] && printf 'were' || printf 'was')"
      printf '```\n'
      for d in $DOSSIERS; do printf 'git show %s:%s\n' "$SHA" "$d"; done
      printf '```\n'
    } >> "$BODY"
    gh issue comment "$ISSUE" --body-file "$BODY" && say "  posted to issue #$ISSUE"
    rm -f "$BODY"
  fi
fi

say ""
say "DOSSIER_SHA=$SHA"
say "PLAN_SHA=$PLAN_SHA"
