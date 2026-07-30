#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# A template is copied into somebody else's repository, so a copyright line inside one attributes this
# plugin's author for work that is not theirs — and it is invisible, because the file reads correctly in
# the repository that ships it. It shipped that way once: four governance templates and the Apache
# LICENSE appendix all carried a real name.
#
# The rule is mechanical: in a template a skill ships, a copyright line must carry a placeholder year,
# never a literal one — a literal year is the signature of a hardcoded attribution.
#
# Scoped to skills/*/templates/, the files that leave this repository. A repository's own
# project/templates/ belongs to that repository and its author's name there is correct; only what is
# copied elsewhere is the plugin author's to keep out.

check_template_attribution() {
  head_
  local id="template-attribution" problems=0 hit
  if [ ! -d "$ROOT/skills" ]; then
    skip "$id" "no skills/ directory — this repository ships no templates"
    return
  fi
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    fail "$id" "hardcoded attribution in a shipped template: $hit"
    problems=$((problems + 1))
  done <<EOF
$(git -C "$ROOT" grep -nE 'Copyright \(c\) [0-9]{4}' -- 'skills/*/templates/*' 2>/dev/null || true)
EOF
  [ "$problems" -eq 0 ] && pass "$id" "no template this plugin ships carries a hardcoded copyright"
}
