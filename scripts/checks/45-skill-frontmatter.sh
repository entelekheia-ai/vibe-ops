#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# A SKILL.md whose frontmatter does not parse loads with EMPTY metadata — name,
# description and argument-hint are all dropped without an error. The skill then
# fails the only way that cannot be seen from inside the repository: it is absent
# from the listing the model matches against, so it never fires, and nothing says
# why.
#
# This shipped. `skills/new/SKILL.md` carried an unquoted description containing
# ": " ("...template and numbering: an ADR"), which YAML reads as a second
# mapping and rejects. check-agents-md.sh reported 9/9 the whole time, because
# nothing here looked at skill frontmatter; only `claude plugin tag` caught it,
# at the moment of release. A guard, not a line — ADR-0004.
#
# Deliberately not a full YAML parser. It catches the one fault that has actually
# occurred and is invisible on inspection: an unquoted scalar containing ": ".

check_skill_frontmatter() {
  head_
  local id="skill-frontmatter" problems=0 skill
  if [ ! -d "$ROOT/skills" ]; then
    skip "$id" "no skills/ directory"
    return
  fi
  for skill in "$ROOT"/skills/*/SKILL.md; do
    [ -e "$skill" ] || continue
    local rel="${skill#"$ROOT"/}"
    if [ "$(head -n 1 "$skill")" != "---" ]; then
      fail "$id" "$rel has no frontmatter block"
      problems=$((problems + 1))
      continue
    fi
    # Every key: value line in the block, with the value neither quoted nor empty.
    # A ": " inside such a value is what breaks the parse.
    local offender
    offender=$(sed -n '2,/^---$/p' "$skill" \
      | sed '/^---$/d' \
      | awk -F': ' '/^[A-Za-z0-9_-]+: / {
            v = substr($0, index($0, ": ") + 2)
            if (v !~ /^["'"'"']/ && v ~ /: /) { print $1; }
          }')
    if [ -n "$offender" ]; then
      fail "$id" "$rel: $(echo "$offender" | tr '\n' ' ')— unquoted value contains \": \", frontmatter will not parse and ALL fields are silently dropped"
      problems=$((problems + 1))
    fi
    if ! sed -n '2,/^---$/p' "$skill" | grep -q '^description:[[:space:]]*[^[:space:]]'; then
      fail "$id" "$rel has no description: — a skill without one is never matched"
      problems=$((problems + 1))
    fi
  done
  [ "$problems" -eq 0 ] && pass "$id" "every skill's frontmatter parses and declares a description"
}
