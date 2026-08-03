#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# scripts/resolve-governance.sh reads exactly one references/records/<type>.md per record type it
# knows about (adr, rfc, plan, task) and falls back to a "this install predates the file" message when
# one is missing — silent from inside the repo unless something actually asks the resolver for that
# type. This makes the absence visible without waiting for that call.

check_references_completeness() {
  head_
  local id="references-completeness" dir="$ROOT/references/records" problems=0 t
  if [ ! -d "$ROOT/references" ]; then
    skip "$id" "no references/ directory"
    return
  fi
  for t in adr rfc plan task; do
    if [ ! -f "$dir/$t.md" ]; then
      fail "$id" "references/records/$t.md is missing — resolve-governance.sh falls back to a stub message for this type"
      problems=$((problems + 1))
    fi
  done
  [ "$problems" -eq 0 ] && pass "$id" "references/records/ has all four record types resolve-governance.sh knows about"
}
