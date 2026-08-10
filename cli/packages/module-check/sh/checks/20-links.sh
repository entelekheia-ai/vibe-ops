#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# Unresolvable links, and links that climb out of the repository. Both in one pass over the same
# extraction, because they differ only in what the normalizer returns.

check_links() {
  head_
  local id="links" bad=0 escaped=0 file dir link target norm
  # Fed by process substitution rather than `for file in $(tracked_md)`: command substitution word-splits,
  # so a filename containing a space becomes several nonexistent files and the reader below fails on each.
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    dir=$(dirname "$file")
    # ](path) — every occurrence on every line, not just the last. Fenced blocks and inline code spans
    # are stripped first: link syntax quoted as code is not a link. Skip external links, anchors, mail,
    # and paths carrying an unexpanded variable.
    for link in $(awk 'BEGIN { fenced = 0 } /^[[:space:]]*```/ { fenced = !fenced; next } !fenced' "$ROOT/$file" |
      sed 's/`[^`]*`//g' | grep -oE '\]\([^)]+\)' | sed 's/^](//; s/)$//' |
      grep -v '^http' | grep -v '^#' | grep -v '^mailto:' | grep -v '\${' || true); do
      target="${link%%#*}"
      [ -z "$target" ] && continue
      case "$target" in /*) fail "$id" "$file: absolute path in a link: $target"; bad=$((bad + 1)); continue ;; esac
      norm=$(norm_rel "$dir/$target")
      if [ "$norm" = "OUTSIDE" ]; then
        fail "$id" "$file: link reaches outside the repository: $target"
        escaped=$((escaped + 1))
      elif [ ! -e "$ROOT/$norm" ]; then
        fail "$id" "$file: link does not resolve: $target"
        bad=$((bad + 1))
      fi
    done
  done < <(tracked_md)
  [ $((bad + escaped)) -eq 0 ] && pass "$id" "every relative link in tracked markdown resolves inside the repository"
}
