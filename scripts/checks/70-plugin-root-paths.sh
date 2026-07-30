#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# ${CLAUDE_PLUGIN_ROOT}/<path> is how a skill reaches a file the plugin ships. Written inside a fenced
# command it is invisible to the link check, which only sees markdown links — so the paths a skill tells
# an agent to `cp` or execute are exactly the ones nothing was verifying.
#
# This checks the half that is mechanical: the path exists in this repository. The half it cannot check
# is whether the path existed at the last *release* — the plugin is installed as a clone pinned to a
# version, so a file added since then is unreachable from an install. That one stays judgement, and is
# written down in AGENTS.md.

check_plugin_root_paths() {
  head_
  local id="plugin-root-paths" problems=0 file ref path seen=""
  for file in $(tracked_md); do
    for ref in $(grep -oE '\$\{CLAUDE_PLUGIN_ROOT\}/[A-Za-z0-9._/-]+' "$ROOT/$file" 2>/dev/null |
      sed 's|^\${CLAUDE_PLUGIN_ROOT}/||' | sed 's|[.,]$||' | sort -u); do
      path="$ref"
      # a trailing slash means a directory; both forms are checked the same way
      [ -e "$ROOT/${path%/}" ] && continue
      case " $seen " in *" $file:$path "*) continue ;; esac
      seen="$seen $file:$path"
      fail "$id" "$file: \${CLAUDE_PLUGIN_ROOT}/$path does not exist in this repository"
      problems=$((problems + 1))
    done
  done
  [ "$problems" -eq 0 ] && pass "$id" "every \${CLAUDE_PLUGIN_ROOT} path a skill names exists"
}
