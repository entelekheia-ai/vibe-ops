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
# 4: Plan-040 Track 1 — five of `plugin/references/`'s files moved into the governance package whose
# policy they are, served through `records norm --facet policy --name <key>` instead of a path. The
# population this check reads grows to match: every activated package's `type.json` may declare
# `facets`, a map of name to path, and each of those files still carries its own
# `vibe-ops-reference: <name>@<integer>` stamp — the identity travelled with the file, the location did
# not. This population does NOT depend on `$PLUGIN_DIR/references` existing: an npm-only install with no
# plugin surface at all still ships the governance packages and their facets.
CHECK_VERSION=4

check_references_completeness() {
  head_
  local id="references-completeness" problems=0 t f name manifest pkg_dir rel facet_file
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

  if [ -d "$PLUGIN_DIR/references" ]; then
    # The declaration is matched against the file's OWN name rather than merely being present: a copied
    # reference that kept its source's token would report a version belonging to another document, which
    # is the failure mode that looks like an answer.
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
  fi

  # Every activated package's `type.json` may declare `facets` — a policy file served through
  # `records norm --facet policy --name <key>` rather than a plugin-relative path. Read with jq: both
  # sides of this file are JSON, and hand-parsing them the way `40-frontmatter.sh` once did is exactly
  # the fragility `15-manifest-sync.sh` already avoids by requiring jq. This check already reports a
  # single verdict for its whole population (the four record types' authoring rules, `references/`);
  # jq missing narrows what that population covers rather than producing a second, conflicting verdict
  # of its own — named in the pass message below, so a jq-less run is still attributable.
  local facets_checked=0
  if command -v jq >/dev/null 2>&1; then
    facets_checked=1
    while IFS= read -r manifest; do
      [ -n "$manifest" ] || continue
      pkg_dir=$(dirname "$manifest")
      while IFS= read -r name; do
        [ -n "$name" ] || continue
        rel=$(jq -r --arg n "$name" '.facets[$n] // empty' "$manifest")
        [ -n "$rel" ] || continue
        facet_file="$pkg_dir/$rel"
        if [ ! -f "$facet_file" ]; then
          fail "$id" "${manifest#"$ROOT"/} declares facets.$name = $rel, which does not exist"
          problems=$((problems + 1))
        # The stamp's NAME travelled with the file rather than with the facet key it is now served
        # under (`convergence-policy@2` stays that, though the facet key is `convergence`) — matched
        # against any well-formed stamp here, never against $name, which is a serving label, not an
        # identity.
        elif ! grep -qE '^vibe-ops-reference: [A-Za-z0-9_/-]+@[0-9][0-9]*$' "$facet_file"; then
          fail "$id" "${facet_file#"$ROOT"/} declares no \`vibe-ops-reference: <name>@<integer>\` — a cited policy that cannot say which version it is"
          problems=$((problems + 1))
        fi
      done <<EOF2
$(jq -r '.facets // {} | keys[]' "$manifest" 2>/dev/null)
EOF2
    done <<EOF3
$(find "$ROOT/cli/packages" -maxdepth 2 -name 'type.json' -type f 2>/dev/null | sort)
EOF3
  fi

  if [ "$problems" -eq 0 ]; then
    if [ "$facets_checked" -eq 1 ]; then
      pass "$id" "authoring rules present for the four types /new resolves, and every reference — plugin/references/ and every activated package's facets — declares its version"
    else
      pass "$id" "authoring rules present for the four types /new resolves, and every plugin/references/ file declares its version (facets NOT checked — jq not on PATH)"
    fi
  fi
}
