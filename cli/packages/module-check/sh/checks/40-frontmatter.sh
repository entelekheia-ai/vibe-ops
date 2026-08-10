#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# A rule with no description: is never surfaced to the agent — it is a file that exists and does
# nothing, which is worse than an absent one because it reads as covered.

check_frontmatter() {
  head_
  local id="frontmatter" problems=0 rule
  if [ ! -d "$ROOT/.agents/rules" ]; then
    skip "$id" "no .agents/rules/ directory"
    return
  fi
  for rule in "$ROOT"/.agents/rules/*.md; do
    [ -e "$rule" ] || continue
    if [ "$(head -n 1 "$rule")" != "---" ]; then
      fail "$id" "${rule#"$ROOT"/} has no frontmatter block"
      problems=$((problems + 1))
    elif ! sed -n '2,/^---$/p' "$rule" | grep -q '^description:[[:space:]]*[^[:space:]]'; then
      fail "$id" "${rule#"$ROOT"/} has no description: — a rule without one is never surfaced"
      problems=$((problems + 1))
    fi
  done
  [ "$problems" -eq 0 ] && pass "$id" "every rule declares a description"
}
