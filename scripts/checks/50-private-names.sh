#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# The deny-list is deliberately NOT stored in this repository. A validation command that spells out
# private names in order to grep for them has already leaked them. Point PRIVATE_NAME_LIST at a file
# outside the tree; with no list the check reports itself skipped rather than passing silently.

check_private_names() {
  head_
  local id="private-names" list="${PRIVATE_NAME_LIST:-}" hits=0 lineno=0 name
  if [ -z "$list" ]; then
    skip "$id" "no PRIVATE_NAME_LIST set — the deny-list lives outside this repository by design"
    return
  fi
  if [ ! -f "$list" ]; then
    fail "$id" "PRIVATE_NAME_LIST points at $list, which does not exist"
    return
  fi
  case "$(git -C "$ROOT" ls-files --error-unmatch "$list" 2>/dev/null)" in
    ?*) fail "$id" "the deny-list is tracked by git — it must live outside the published tree"; return ;;
  esac
  while read -r name; do
    lineno=$((lineno + 1))
    [ -z "$name" ] && continue
    case "$name" in \#*) continue ;; esac
    if git -C "$ROOT" grep -qiF -- "$name" 2>/dev/null; then
      # the offending string is never echoed — printing it here would leak it into CI logs
      fail "$id" "deny-list entry on line $lineno of the list appears in the tracked tree"
      hits=$((hits + 1))
    fi
  done < "$list"
  [ "$hits" -eq 0 ] && pass "$id" "no deny-listed name appears in the tracked tree"
}
