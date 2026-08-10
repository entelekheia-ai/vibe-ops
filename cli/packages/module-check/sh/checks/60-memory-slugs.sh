#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# A committed file must never point at a personal memory store: the reader does not have it, and the
# pointer dangles the moment the memory is renamed.
#
# `[[...]]` is not only a memory link. TOML array-of-tables (`[[language]]` in a Helix config), Wikitext
# and several template languages share the shape, so a repository documenting any of them would carry a
# permanent red line it could not clear without mangling its own docs. The match therefore runs per file
# with fenced blocks and inline code spans removed first: syntax quoted as code is being *shown*, not
# used. A check that cries wolf gets ignored, and this one guards something real.

check_memory_slugs() {
  head_
  local id="memory-slugs" hits file
  hits=$(
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      [ "${file#*/templates/}" != "$file" ] && continue
      awk -v f="$file" '
        BEGIN { fenced = 0 }
        /^[[:space:]]*```/ { fenced = !fenced; next }
        fenced { next }
        {
          stripped = $0
          gsub(/`[^`]*`/, "", stripped)
          if (stripped ~ /\[\[[a-z0-9][a-z0-9_-]*\]\]/) printf "%s:%d:%s\n", f, NR, $0
        }
      ' "$ROOT/$file"
    done < <(tracked_md)
  )
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits" | while read -r line; do fail "$id" "wiki-style memory link: $line"; done
    FAILURES=$((FAILURES + 1))
  else
    pass "$id" "no personal-memory links in tracked markdown"
  fi
}
