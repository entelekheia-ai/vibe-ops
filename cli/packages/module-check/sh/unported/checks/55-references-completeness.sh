#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# the /new skill reads exactly one authoring-rules file per record type — since Plan-033 each travels
# in its type's own governance package as cli/packages/governance-<t>/authoring.md, read through
# `vibe-ops records norm --facet authoring` — and reports "not present" when one is missing, silent from
# inside the repo unless something actually asks for that type. This makes the absence visible without
# waiting for that call. Only applies where those packages exist (this repository); a consumer gets the
# skip.

# 2: reports undeclared references, a category nobody was handling before Plan-012 Track 7. A reference
# is cited BY NAME as the authority by more than one skill, and it changes — without a version, which
# policy a given closure applied is unanswerable except by re-reading every record it touched.
# 3: the per-type rules moved out of $PLUGIN_DIR/references/records/ into the governance packages; their
# `vibe-ops-reference: records/<t>@N` token keeps its NAME (it is an identifier now, no longer a path).
CHECK_VERSION=3

check_references_completeness() {
  head_
  local id="references-completeness" problems=0 t f name
  if [ ! -d "$PLUGIN_DIR/references" ]; then
    skip "$id" "no references/ directory"
    return
  fi
  if [ -d "$ROOT/cli/packages/governance-adr" ]; then
    for t in adr rfc plan task; do
      if [ ! -f "$ROOT/cli/packages/governance-$t/authoring.md" ]; then
        fail "$id" "governance-$t/authoring.md is missing — /new has no rules to read for this record type"
        problems=$((problems + 1))
      elif ! grep -q "^vibe-ops-reference: records/${t}@[0-9][0-9]*$" "$ROOT/cli/packages/governance-$t/authoring.md"; then
        fail "$id" "governance-$t/authoring.md declares no \\`vibe-ops-reference: records/${t}@<integer>\\` — a cited policy that cannot say which version it is"
        problems=$((problems + 1))
      fi
    done
  fi

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

  [ "$problems" -eq 0 ] && pass "$id" "authoring rules present for the four types /new resolves, and every reference declares its version"
}
