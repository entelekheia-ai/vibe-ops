#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# Two ways hooks.json can drift from hooks/, both silent: a script on disk that no event ever fires
# (dead code that looks live), and a registered path that names a file which does not exist (a hook
# that is invisible from inside the repo — check-agents-md.sh itself would never catch it, because
# nothing here used to read hooks.json at all). A third: hooks.json's own top-level "description" opens
# with a literal count ("Five guards") that nothing kept honest — project/tasks/002-*.md found Task 004
# was about to make it wrong by adding a sixth hook with no check anywhere to notice.
#
# jq only, for the same reason as 15-manifest-sync.sh: hooks.json is regular JSON and hand-parsing it
# with sed is how the fragile stuff already in this file got fragile.

check_hooks_registration() {
  head_
  local id="hooks-registration" hj="$ROOT/hooks/hooks.json" hd="$ROOT/hooks" problems=0

  if [ ! -f "$hj" ]; then
    skip "$id" "no hooks/hooks.json — this repo ships no hooks"
    return
  fi
  if ! command -v jq >/dev/null 2>&1; then
    skip "$id" "jq not on PATH — hooks.json is JSON and this check does not hand-parse it"
    return
  fi

  # Every ${CLAUDE_PLUGIN_ROOT}/hooks/<file> a command hook names, resolved to a repo-relative path.
  local registered
  registered=$(jq -r '
    [.hooks | .. | objects | select(has("command")) | (.args // [])[]]
    | .[] | select(test("hooks/[^/]+\\.sh$"))
    | capture("hooks/(?<f>[^/]+\\.sh)$") | .f
  ' "$hj" 2>/dev/null | sort -u)

  local f
  for f in $registered; do
    if [ ! -f "$hd/$f" ]; then
      fail "$id" "hooks.json registers hooks/$f, which does not exist"
      problems=$((problems + 1))
    fi
  done

  if [ -d "$hd" ]; then
    for f in "$hd"/*.sh; do
      [ -e "$f" ] || continue
      local base
      base=$(basename "$f")
      # $registered is newline-separated (one hook name per line); grep -x matches a whole line.
      if ! printf '%s\n' "$registered" | grep -qxF "$base"; then
        fail "$id" "hooks/$base exists but is not registered in any hooks.json event — dead, or forgotten"
        problems=$((problems + 1))
      fi
    done
  fi

  # The description's literal count, checked against the actual number of distinct registered scripts.
  # Only acted on when the first word IS a recognized number word — a description that opens some other
  # way (no count claimed) has nothing here to be wrong about, so it is skipped rather than flagged.
  local desc count word numword
  desc=$(jq -r '.description // empty' "$hj")
  count=$(printf '%s\n' "$registered" | grep -c . || true)
  word=$(printf '%s' "$desc" | awk '{print tolower($1)}')
  case "$word" in
    one) numword=1 ;; two) numword=2 ;; three) numword=3 ;; four) numword=4 ;; five) numword=5 ;;
    six) numword=6 ;; seven) numword=7 ;; eight) numword=8 ;; nine) numword=9 ;; ten) numword=10 ;;
    *) numword="" ;;
  esac
  if [ -n "$numword" ] && [ "$numword" != "$count" ]; then
    fail "$id" "hooks.json description opens with \"$word\" but $count distinct hook script(s) are registered — update the count"
    problems=$((problems + 1))
  fi

  [ "$problems" -eq 0 ] && pass "$id" "every registered hook script exists, every hook script is registered, and the description's count is accurate"
}
