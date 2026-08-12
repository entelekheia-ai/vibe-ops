#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# the /new skill reads exactly one references/records/<type>.md per record type it
# knows about (adr, rfc, plan, task) and falls back to a "this install predates the file" message when
# one is missing — silent from inside the repo unless something actually asks the resolver for that
# type. This makes the absence visible without waiting for that call.

# 2: reports undeclared references, a category nobody was handling before Plan-012 Track 7. A reference
# is cited BY NAME as the authority by more than one skill, and it changes — without a version, which
# policy a given closure applied is unanswerable except by re-reading every record it touched.
CHECK_VERSION=2

check_references_completeness() {
  head_
  local id="references-completeness" dir="$PLUGIN_DIR/references/records" problems=0 t f name
  if [ ! -d "$PLUGIN_DIR/references" ]; then
    skip "$id" "no references/ directory"
    return
  fi
  for t in adr rfc plan task; do
    if [ ! -f "$dir/$t.md" ]; then
      fail "$id" "references/records/$t.md is missing — /new has no rules to read for this record type"
      problems=$((problems + 1))
    fi
  done

  # The declaration is matched against the file's OWN name rather than merely being present: a copied
  # reference that kept its source's token would report a version belonging to another document, which is
  # the failure mode that looks like an answer.
  while IFS= read -r f; do
    name="${f#"$PLUGIN_DIR"/references/}"
    name="${name%.md}"
    if ! grep -q "^vibe-ops-reference: ${name}@[0-9][0-9]*$" "$f"; then
      fail "$id" "${f#"$ROOT"/} declares no \`vibe-ops-reference: ${name}@<integer>\` — a cited policy that cannot say which version it is"
      problems=$((problems + 1))
    fi
  done <<EOF
$(find "$PLUGIN_DIR/references" -name '*.md' -type f 2>/dev/null | sort)
EOF

  [ "$problems" -eq 0 ] && pass "$id" "references/records/ has all four record types /new resolves, and every reference declares its version"
}
