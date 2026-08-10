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
#
# A path that CLIMBS OUT of the plugin root (../cli/...) is a third failure mode, and the existence check
# above cannot see it: ${CLAUDE_PLUGIN_ROOT}/../cli/... resolves in THIS working tree, because plugin/ and
# cli/ are siblings here — so it passed, silently, for as long as ten call sites wrote it (plan-009). It
# resolves in NO installation: an install is a copy of plugin/ alone, and the parent of
# ${CLAUDE_PLUGIN_ROOT} there holds only version directories. Caught before the existence check runs, or
# the existence check would pass it right back.
#
# A line ending "plugin-root-paths: allow" is exempted from the climb check — the escape is the point,
# not a bug, on the four `cp` lines in setup/SKILL.md that ship the harness INTO a target repository
# rather than executing it there (project/plans/009-*, Decision Log). Scoped per line, by grepping for
# the reference and the marker together, so a future unmarked climb elsewhere in the same file still
# fails.
#
# project/ is excluded from this check entirely, same reasoning tracked_md() already applies to
# templates/: a Shipped plan or an Accepted RFC is a permanent, immutable design record — governance.md
# forbids rewriting one to match later code — so it can describe a PAST design's paths (Plan-002 named
# this exact ../cli/ form when it was written) without that being live instruction an agent executes
# today. Discovered live: Plan-009's own climb guard flagged Plan-002's history the moment it existed.

check_plugin_root_paths() {
  head_
  local id="plugin-root-paths" problems=0 checked=0 file ref path seen=""
  for file in $(tracked_md); do
    case "$file" in project/*) continue ;; esac
    for ref in $(grep -oE '\$\{CLAUDE_PLUGIN_ROOT\}/[A-Za-z0-9._/-]+' "$ROOT/$file" 2>/dev/null |
      sed 's|^\${CLAUDE_PLUGIN_ROOT}/||' | sed 's|[.,]$||' | sort -u); do
      checked=$((checked + 1))
      path="$ref"
      case " $seen " in *" $file:$path "*) continue ;; esac
      case "$path" in
        ../*|*/../*)
          if grep -F "\${CLAUDE_PLUGIN_ROOT}/$path" "$ROOT/$file" 2>/dev/null | grep -q "plugin-root-paths: allow"; then
            continue
          fi
          seen="$seen $file:$path"
          fail "$id" "$file: \${CLAUDE_PLUGIN_ROOT}/$path climbs out of the plugin root — unreachable from any installed plugin"
          problems=$((problems + 1))
          continue
          ;;
      esac
      # a trailing slash means a directory; both forms are checked the same way. Resolved against
      # $PLUGIN_DIR, not $ROOT: ${CLAUDE_PLUGIN_ROOT} is the installed plugin's own root, and in this
      # repository that is plugin/, not the repository root.
      [ -e "$PLUGIN_DIR/${path%/}" ] && continue
      seen="$seen $file:$path"
      fail "$id" "$file: \${CLAUDE_PLUGIN_ROOT}/$path does not exist in this repository"
      problems=$((problems + 1))
    done
  done
  if [ "$checked" -eq 0 ]; then
    skip "$id" "no \${CLAUDE_PLUGIN_ROOT}/ paths found in any tracked markdown file"
    return
  fi
  [ "$problems" -eq 0 ] && pass "$id" "every \${CLAUDE_PLUGIN_ROOT} path a skill names exists"
}
