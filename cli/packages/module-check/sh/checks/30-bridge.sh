#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# The .agents/ ↔ .claude/ bridge. Two distinct failures: a real file where a symlink belongs, and a
# symlink that git checked out as text (core.symlinks=false) — which looks like a working rule file
# containing one line of nonsense.

check_bridge() {
  head_
  local id="bridge" problems=0 mode path
  if [ ! -d "$ROOT/.claude" ]; then
    skip "$id" "no .claude/ directory — nothing to bridge"
    return
  fi
  while read -r mode _ _ path; do
    [ -z "${path:-}" ] && continue
    case "$path" in
      .claude/rules/*.md | .claude/skills/*) ;;
      *) continue ;;
    esac
    if [ "$mode" != "120000" ]; then
      fail "$id" "$path is a regular file — .claude/ must hold a relative symlink into .agents/"
      problems=$((problems + 1))
      continue
    fi
    if [ ! -L "$ROOT/$path" ]; then
      fail "$id" "$path is a symlink in git but not on disk — checked out as text (core.symlinks=false)"
      problems=$((problems + 1))
    elif [ ! -e "$ROOT/$path" ]; then
      fail "$id" "$path is a symlink whose target does not exist"
      problems=$((problems + 1))
    fi
  done <<EOF
$(git -C "$ROOT" ls-files -s .claude 2>/dev/null)
EOF
  [ "$problems" -eq 0 ] && pass "$id" "every .claude/ rule and skill is a resolving symlink"
}
