#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# The license texts this plugin hands to other repositories must be the licenses, byte for byte.
#
# They were not. What shipped as Apache-2.0 was a paraphrase — fluent, legal-sounding, and wrong in the
# operative clauses — and it propagated into every repo the skill touched. Nothing caught it because
# nobody re-reads a LICENSE. This check is what catches it: every text under skills/license-setup/licenses/
# is hashed against its pin, and this repository's own LICENSE is verified as the real thing.
#
# It also refuses a placeholder inside a license text. A `{{...}}` in that file means somebody started
# templating the license body itself, which is how the substitution turns into an edit turns into a
# rewrite. The year and holder are substituted on the *copy*, in the target repo, never here.

check_license_texts() {
  head_
  local id="license-texts" problems=0 tool="$ROOT/skills/license-setup/get-license.sh"
  local registry="$ROOT/skills/license-setup/licenses/SOURCES.tsv"

  if [ ! -f "$tool" ] || [ ! -f "$registry" ]; then
    skip "$id" "no license-setup skill in this repository"
    return
  fi

  local row lid want got file
  while IFS=$'\t' read -r lid _ want _; do
    [ -z "$lid" ] && continue
    case "$lid" in \#*) continue ;; esac
    file="$ROOT/skills/license-setup/licenses/$lid.txt"
    if [ ! -f "$file" ]; then
      fail "$id" "$lid is pinned in SOURCES.tsv but licenses/$lid.txt is missing"
      problems=$((problems + 1)); continue
    fi
    if command -v sha256sum >/dev/null 2>&1; then got="$(sha256sum <"$file" | cut -d' ' -f1)"
    else got="$(shasum -a 256 <"$file" | cut -d' ' -f1)"; fi
    if [ "$got" != "$want" ]; then
      fail "$id" "licenses/$lid.txt does not match its pin — it has been edited, or upstream changed and was not re-pinned"
      problems=$((problems + 1))
    fi
    if grep -q '{{' "$file"; then
      fail "$id" "licenses/$lid.txt contains a {{placeholder}} — license text is never templated"
      problems=$((problems + 1))
    fi
  done < <(grep -v '^#' "$registry")

  # This repository ships under Apache-2.0 and is the first thing anyone reads as an example of the
  # convention. Its own LICENSE gets the same verification the skill performs on a target repo.
  if [ -f "$ROOT/LICENSE" ]; then
    if ! bash "$tool" verify "$ROOT/LICENSE" --id Apache-2.0 >/dev/null 2>&1; then
      fail "$id" "this repository's own LICENSE is not the Apache-2.0 text (run: skills/license-setup/get-license.sh verify LICENSE --id Apache-2.0)"
      problems=$((problems + 1))
    fi
  fi

  [ "$problems" -eq 0 ] && pass "$id" "every shipped license text matches its pinned digest, including this repo's own LICENSE"
}
