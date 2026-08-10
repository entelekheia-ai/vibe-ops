#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# The deny-list is deliberately NOT stored in any repository — not this one, and not the one being
# checked. A validation command that spells out private names in order to grep for them has already
# leaked them. The driver composes the list into a temporary file for the duration of the run; this
# reads that file and reports only where an entry came from, never what it said.
#
# With nothing supplied the check reports itself skipped rather than passing silently: "no private
# name found" and "I was not given any to look for" are different answers.

check_private_names() {
  head_
  local id="private-names" list="${VIBE_OPS_DENYLIST:-}" hits=0 label pattern
  if [ -z "$list" ] || [ ! -s "$list" ]; then
    skip "$id" "no names supplied (PRIVATE_NAME_LIST / PRIVATE_NAMES) — the deny-list lives outside every repository by design"
    return
  fi
  while IFS="$(printf '\t')" read -r label pattern; do
    [ -z "${pattern:-}" ] && continue
    if git -C "$ROOT" grep -qiF -- "$pattern" 2>/dev/null; then
      # the offending string is never echoed — printing it here would leak it into CI logs
      fail "$id" "a deny-listed name appears in the tracked tree (source: $label)"
      hits=$((hits + 1))
    fi
  done < "$list"
  [ "$hits" -eq 0 ] && pass "$id" "no deny-listed name appears in the tracked tree"
}
