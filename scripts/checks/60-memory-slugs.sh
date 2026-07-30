#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# A committed file must never point at a personal memory store: the reader does not have it, and the
# pointer dangles the moment the memory is renamed.

check_memory_slugs() {
  head_
  local id="memory-slugs" hits
  hits=$(git -C "$ROOT" grep -n -E '\[\[[a-z0-9][a-z0-9_-]*\]\]' -- '*.md' 2>/dev/null | grep -v '/templates/' || true)
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits" | while read -r line; do fail "$id" "wiki-style memory link: $line"; done
    FAILURES=$((FAILURES + 1))
  else
    pass "$id" "no personal-memory links in tracked markdown"
  fi
}
