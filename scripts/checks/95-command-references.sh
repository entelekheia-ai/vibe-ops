#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# Every `/vibe-ops:<name>` mentioned in the LIVE surfaces — README and skills/ (which also holds the
# templates this plugin SHIPS into other repositories, under skills/repo-setup/templates/) — must
# resolve to a real skills/<name>/ directory. 0.7.0 removed four `new-*` commands when they collapsed
# into `/new`; nothing checked that every reference to the old names went with them. project/tasks/
# 002-*.md found this by hand; this makes it mechanical.
#
# Deliberately scoped to README + skills/, NOT project/**, CHANGELOG.md, or any other historical record:
# an ADR is immutable once Accepted, a plan is a permanent record, and CHANGELOG documents what a past
# release actually shipped — all three are SUPPOSED to keep naming commands that no longer exist. Only
# a live surface describing the plugin as it is today can have a genuinely broken reference.
#
# Deliberately does not check the reverse (every skill mentioned somewhere) — an unreferenced skill is
# not a bug, a reference to a nonexistent one is.

check_command_references() {
  head_
  local id="command-references" problems=0 file name
  if [ ! -d "$ROOT/skills" ]; then
    skip "$id" "no skills/ directory"
    return
  fi

  # Fenced code blocks and inline code spans are stripped first: a command name inside a code example
  # illustrating syntax, not naming a real skill, is not what this check is for — but every real
  # mention in this repo happens to be inline-coded anyway, so this mostly narrows nothing; it exists
  # so a triple-backtick usage example is never misread as a broken reference.
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    for name in $(awk 'BEGIN { fenced = 0 } /^[[:space:]]*```/ { fenced = !fenced; next } !fenced' "$ROOT/$file" \
        | grep -o 'vibe-ops:[A-Za-z0-9_-]*' | sed 's/^vibe-ops://' | sort -u); do
      if [ ! -d "$ROOT/skills/$name" ]; then
        fail "$id" "$file references /vibe-ops:$name — no skills/$name/ directory"
        problems=$((problems + 1))
      fi
    done
  done <<EOF
$( { [ -f "$ROOT/README.md" ] && printf 'README.md\n'
     [ -d "$ROOT/skills" ] && find "$ROOT/skills" -name '*.md' 2>/dev/null | sed "s|^$ROOT/||"; } )
EOF

  [ "$problems" -eq 0 ] && pass "$id" "every /vibe-ops:<name> reference resolves to a real skill"
}
