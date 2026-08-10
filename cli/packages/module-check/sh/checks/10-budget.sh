#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# AGENTS.md stays under a line budget. Over budget the instruction is to relocate content and leave a
# pointer, not to compress prose — a shorter file that says the same things is not the goal.

check_budget() {
  head_
  local id="budget" max="${AGENTS_MD_MAX_LINES:-150}" n
  if [ ! -f "$ROOT/AGENTS.md" ]; then
    fail "$id" "no AGENTS.md at the repository root"
    return
  fi
  n=$(wc -l < "$ROOT/AGENTS.md" | tr -d ' ')
  if [ "$n" -gt "$max" ]; then
    fail "$id" "AGENTS.md is $n lines, over the $max-line budget — relocate content and leave a pointer"
  else
    pass "$id" "AGENTS.md is $n/$max lines"
  fi
}
