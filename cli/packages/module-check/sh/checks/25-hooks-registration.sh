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
# A fourth way opened with plan-009: a skill's OWN frontmatter `hooks:` block, installed only while
# that skill is active, is never in hooks.json at all — there is no script under skills/*/hooks/ to
# scan either, since the hook there is the vibe-ops command itself, not a shipped script. A wrong event
# name or a typo'd path in that block fails exactly the way plan-009 warned it would: silently, because
# nothing reads YAML frontmatter here. This is that sensor.
#
# jq only, for hooks.json — regular JSON, and hand-parsing it with sed is how the fragile stuff already
# in this file got fragile. The frontmatter half below is YAML, which nothing here parses either — it
# is read line-by-line for the one shape this plugin's hooks: blocks actually take, not as a general
# YAML parser.

# Every ${CLAUDE_PLUGIN_ROOT}/hooks/<file> a command hook names, resolved to a repo-relative path.
# Anchored to the literal ${CLAUDE_PLUGIN_ROOT}/hooks/ prefix, not merely a trailing "hooks/<f>.sh" —
# an unanchored test("hooks/[^/]+\\.sh$") matches the END of "${CLAUDE_PLUGIN_ROOT}/skills/x/hooks/y.sh"
# too, and would have resolved a skill-scoped script against $PLUGIN_DIR/hooks/ instead of its own
# skill directory the day one first appeared there.
_hooks_json_registered() {
  jq -r '
    [.hooks | .. | objects | select(has("command")) | (.args // [])[]]
    | .[] | select(test("^\\$\\{CLAUDE_PLUGIN_ROOT\\}/hooks/[^/]+\\.sh$"))
    | capture("hooks/(?<f>[^/]+\\.sh)$") | .f
  ' "$1" 2>/dev/null | sort -u
}

# Claude Code's documented hook events, plus UserPromptExpansion, which this plugin already uses and
# fires successfully — not in the public list, but real. Kept in one place so both halves of this check
# (hooks.json's events, a skill's own) validate against the same set.
_is_known_hook_event() {
  case "$1" in
    PreToolUse|PostToolUse|UserPromptSubmit|UserPromptExpansion|Stop|SubagentStop|SessionStart|SessionEnd|Notification|PreCompact) return 0 ;;
    *) return 1 ;;
  esac
}

# The `hooks:` block of one SKILL.md's frontmatter, exactly as written — everything indented under the
# top-level `hooks:` key, stopping at the next top-level key or the frontmatter's closing `---`.
_skill_hooks_block() {
  awk '
    /^---[[:space:]]*$/ { fm++; next }
    fm == 1 { print }
    fm >= 2 { exit }
  ' "$1" | awk '
    /^hooks:[[:space:]]*$/ { found = 1; next }
    found && /^[A-Za-z_][A-Za-z0-9_-]*:/ { exit }
    found { print }
  '
}

check_hooks_registration() {
  head_
  local id="hooks-registration" hj="$PLUGIN_DIR/hooks/hooks.json" hd="$PLUGIN_DIR/hooks" problems=0 examined=0

  if [ -f "$hj" ]; then
    if command -v jq >/dev/null 2>&1; then
      examined=1
      local registered f
      registered=$(_hooks_json_registered "$hj")

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

      # The description's literal count, checked against the actual number of distinct registered
      # scripts. Only acted on when the first word IS a recognized number word — a description that
      # opens some other way (no count claimed) has nothing here to be wrong about.
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
    fi
  fi

  # Every SKILL.md whose frontmatter carries a hooks: block — a second population, unrelated to
  # hooks.json above and examined regardless of whether hooks.json exists or jq is on PATH.
  local skill_md
  for skill_md in "$PLUGIN_DIR"/skills/*/SKILL.md; do
    [ -e "$skill_md" ] || continue
    local block
    block=$(_skill_hooks_block "$skill_md")
    [ -n "$block" ] || continue
    examined=1

    local skill_dir skill_name
    skill_dir=$(dirname "$skill_md")
    skill_name=$(basename "$skill_dir")

    local events
    events=$(printf '%s\n' "$block" | sed -n 's/^  \([A-Za-z][A-Za-z0-9]*\):[[:space:]]*$/\1/p')
    if [ -z "$events" ]; then
      fail "$id" "$skill_name/SKILL.md declares a hooks: block with no event under it"
      problems=$((problems + 1))
    fi
    local event
    for event in $events; do
      if ! _is_known_hook_event "$event"; then
        fail "$id" "$skill_name/SKILL.md's hooks: block names unknown event \"$event\""
        problems=$((problems + 1))
      fi
    done

    if ! printf '%s\n' "$block" | grep -q 'command:[[:space:]]*[^[:space:]]'; then
      fail "$id" "$skill_name/SKILL.md's hooks: block declares no command"
      problems=$((problems + 1))
    fi

    local ref
    for ref in $(printf '%s\n' "$block" | grep -oE '\$\{CLAUDE_SKILL_DIR\}/[A-Za-z0-9._/-]+' | sed 's|^\${CLAUDE_SKILL_DIR}/||' | sort -u); do
      if [ ! -e "$skill_dir/$ref" ]; then
        fail "$id" "$skill_name/SKILL.md's hooks: block names \${CLAUDE_SKILL_DIR}/$ref, which does not exist"
        problems=$((problems + 1))
      fi
    done
  done

  if [ "$examined" -eq 0 ]; then
    skip "$id" "no hooks/hooks.json and no skill-scoped hooks: block — this repo ships no hooks"
    return
  fi

  [ "$problems" -eq 0 ] && pass "$id" "every registered hook script exists, every hook script is registered, the description's count is accurate, and every skill-scoped hooks: block names a known event and a command with existing paths"
}
