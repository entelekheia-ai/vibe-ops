#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# License text is fetched and checksum-verified. It is never authored, edited, reflowed, summarized or
# reproduced from memory — not by a human and least of all by a model.
#
# This exists because it went wrong: the LICENSE this skill used to ship was a *paraphrase* of Apache-2.0
# — §1 definitions reworded, §3 patent-termination rewritten, the closing of §4 replaced with MIT's
# "sell copies ... subject to the following conditions:" dangling with no conditions after it. It read
# fluently, it looked legal, it was not the license, and it propagated into every repository the skill
# touched. Fluent-and-wrong is exactly what a model produces when asked to fill a template from memory,
# and a LICENSE is the one file where that is unrecoverable: a repo whose LICENSE is not Apache-2.0 is
# not licensed the way it claims.
#
# The fix is to remove authorship from the path entirely. There is one trust anchor — a sha256 pinned in
# licenses/SOURCES.tsv — and every route to a LICENSE file passes through it.
#
# Usage:
#   get-license.sh fetch  <SPDX-ID> [--out FILE]   pristine text, cache-first, network fallback, verified
#   get-license.sh verify <FILE> [--id SPDX-ID]    is this file really that license? (holder may vary)
#   get-license.sh digest <FILE>                   print the canonical-text digest of any file
#   get-license.sh list                            pinned ids
#   get-license.sh pin    <SPDX-ID> [URL]          maintainer-only: add/re-pin an id from upstream
#
# Exit codes: 0 ok · 1 verification failed · 2 usage/lookup error · 3 fetch failed

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY="$HERE/licenses/SOURCES.tsv"
SPDX_TEXT_URL="https://raw.githubusercontent.com/spdx/license-list-data/main/text"

die() { printf 'get-license: %s\n' "$1" >&2; exit "${2:-2}"; }

# sha256sum on Linux/CI, shasum on macOS. Reads stdin, prints the digest alone.
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else die "neither sha256sum nor shasum is available — cannot verify, refusing to guess" 2
  fi
}

# The canonical text of a license file: what must be identical between two copies of the same license.
#
#   - everything from the license's own "how to apply this license" section onward is dropped — Apache's
#     "APPENDIX:", the GPL family's "How to Apply These Terms to Your New Programs". That block is
#     instructions plus a boilerplate a repo fills in with its own program name, year and holder;
#   - standalone `Copyright ...` lines are dropped — the holder is the one thing that legitimately differs
#     (mid-sentence mentions of "copyright" are untouched, the match is anchored);
#   - whitespace is collapsed — apache.org ships the text hard-wrapped at 72 columns and SPDX ships it
#     reflowed; both are the same license and both must verify.
#
# What survives is every operative word. Validated against a control: the Apache-2.0 LICENSE shipped in an
# unrelated npm package digests identically to apache.org's file, while the paraphrase that prompted this
# script does not. It does not false-positive, and it does not forgive a single reworded clause.
# Keep this transform byte-identical to the one in templates/verify-license-text.sh — that copy is
# standalone on purpose (it runs in a target repo's CI with no plugin and no network), so the two drift
# only if someone edits one. Any change here re-pins every digest in SOURCES.tsv.
canonical_text() {
  awk '/^[[:space:]]*(APPENDIX:|How to Apply These Terms to Your New Programs)/{exit} {print}' "$1" \
    | sed -E '/^[[:space:]]*Copyright[[:space:]]/d' \
    | tr -s '[:space:]' ' ' \
    | sed -e 's/^ //' -e 's/ $//'
}

# Registry lookup. Prints "url<TAB>sha_file<TAB>sha_text" or exits 2.
lookup() {
  local id="$1" row
  [ -f "$REGISTRY" ] || die "registry missing: $REGISTRY" 2
  row="$(grep -v '^#' "$REGISTRY" | awk -F'\t' -v id="$id" '$1 == id {print; exit}')"
  [ -n "$row" ] || die "no pinned source for '$id'. Pinned: $(list_ids | tr '\n' ' ')
To add one: $0 pin $id [url]  — then review the fetched text before committing it." 2
  printf '%s' "$row" | cut -f2-
}

list_ids() { grep -v '^#' "$REGISTRY" | awk -F'\t' 'NF>1 {print $1}'; }

fetch_url() {
  command -v curl >/dev/null 2>&1 || die "curl is not available" 3
  curl -fsSL --retry 2 --max-time 30 "$1" || die "could not fetch $1" 3
}

cmd_fetch() {
  local id="${1:-}" out="" ; shift || true
  [ -n "$id" ] || die "usage: $0 fetch <SPDX-ID> [--out FILE]" 2
  while [ $# -gt 0 ]; do
    case "$1" in
      --out) out="${2:-}"; shift 2 ;;
      *) die "unknown option: $1" 2 ;;
    esac
  done

  local url sha_file cached tmp got
  IFS=$'\t' read -r url sha_file _ <<<"$(lookup "$id")"
  cached="$HERE/licenses/$id.txt"
  tmp="$(mktemp)"; trap 'rm -f "$tmp"' RETURN

  # Cache first: the shipped copy is byte-identical to upstream or it is not used. Offline installs work,
  # and a tampered cache falls through to the network instead of being trusted.
  if [ -f "$cached" ] && [ "$(sha256 <"$cached")" = "$sha_file" ]; then
    cp "$cached" "$tmp"
  else
    [ -f "$cached" ] && printf 'get-license: bundled %s does not match its pin — refetching from %s\n' "$id" "$url" >&2
    fetch_url "$url" >"$tmp"
    got="$(sha256 <"$tmp")"
    if [ "$got" != "$sha_file" ]; then
      die "$id fetched from $url does not match its pin.
  expected $sha_file
  got      $got
Upstream may have changed, or the download was tampered with. Nothing was written. Re-pin deliberately
with '$0 pin $id' and review the diff before committing it." 1
    fi
  fi

  if [ -n "$out" ]; then cp "$tmp" "$out"; printf 'get-license: wrote %s (%s, verified)\n' "$out" "$id" >&2
  else cat "$tmp"; fi
}

cmd_verify() {
  local file="${1:-}" id="" ; shift || true
  [ -n "$file" ] || die "usage: $0 verify <FILE> [--id SPDX-ID]" 2
  [ -f "$file" ] || die "no such file: $file" 2
  while [ $# -gt 0 ]; do
    case "$1" in
      --id) id="${2:-}"; shift 2 ;;
      *) die "unknown option: $1" 2 ;;
    esac
  done

  local got; got="$(canonical_text "$file" | sha256)"

  # No id given: identify it. Useful on a repo you did not scaffold.
  if [ -z "$id" ]; then
    local candidate
    while IFS= read -r candidate; do
      [ -z "$candidate" ] && continue
      if [ "$got" = "$(lookup "$candidate" | cut -f3)" ]; then
        printf 'OK  %s is %s\n' "$file" "$candidate"; return 0
      fi
    done <<EOF
$(list_ids)
EOF
    printf 'FAIL %s matches no pinned license (canonical digest %s)\n' "$file" "$got" >&2
    return 1
  fi

  local want; want="$(lookup "$id" | cut -f3)"
  if [ "$got" = "$want" ]; then
    printf 'OK  %s is %s (copyright holder and formatting may differ; every operative word matches)\n' "$file" "$id"
    return 0
  fi

  printf 'FAIL %s is NOT %s\n' "$file" "$id" >&2
  printf '  expected canonical digest %s\n  got                      %s\n' "$want" "$got" >&2
  local pristine; pristine="$(mktemp)"; trap 'rm -f "$pristine"' RETURN
  if cmd_fetch "$id" >"$pristine" 2>/dev/null; then
    local words_missing words_extra
    words_missing="$(comm -23 <(canonical_text "$pristine" | tr ' ' '\n' | sort -u) \
                             <(canonical_text "$file"     | tr ' ' '\n' | sort -u) | wc -l | tr -d ' ')"
    words_extra="$(comm -13 <(canonical_text "$pristine" | tr ' ' '\n' | sort -u) \
                           <(canonical_text "$file"     | tr ' ' '\n' | sort -u) | wc -l | tr -d ' ')"
    printf '  %s distinct words of the official text are absent; %s words appear that are not in it.\n' \
      "$words_missing" "$words_extra" >&2
    printf '  Full diff:  diff <(%s fetch %s) %s\n' "$0" "$id" "$file" >&2
  fi
  printf '  This file is not the license it claims to be. Replace it: %s fetch %s --out %s\n' "$0" "$id" "$file" >&2
  return 1
}

cmd_pin() {
  local id="${1:-}" url="${2:-}"
  [ -n "$id" ] || die "usage: $0 pin <SPDX-ID> [URL]" 2
  [ -n "$url" ] || url="$SPDX_TEXT_URL/$id.txt"
  local dest="$HERE/licenses/$id.txt" tmp; tmp="$(mktemp)"; trap 'rm -f "$tmp"' RETURN
  fetch_url "$url" >"$tmp"
  local sha_file sha_text
  sha_file="$(sha256 <"$tmp")"
  sha_text="$(canonical_text "$tmp" | sha256)"
  cp "$tmp" "$dest"
  # Replace an existing row rather than appending a second one.
  local kept; kept="$(grep -v "^$id"$'\t' "$REGISTRY" || true)"
  printf '%s\n%s\t%s\t%s\t%s\n' "$kept" "$id" "$url" "$sha_file" "$sha_text" >"$REGISTRY"
  printf 'pinned %s from %s\n  file digest %s\n  text digest %s\nReview %s before committing — this is the only\nmoment a human sees the text, and everything downstream trusts these two digests.\n' \
    "$id" "$url" "$sha_file" "$sha_text" "$dest"
}

case "${1:-}" in
  fetch)  shift; cmd_fetch "$@" ;;
  verify) shift; cmd_verify "$@" ;;
  digest) shift; [ -n "${1:-}" ] || die "usage: $0 digest <FILE>" 2; canonical_text "$1" | sha256 ;;
  list)   list_ids ;;
  pin)    shift; cmd_pin "$@" ;;
  *)      sed -n '/^# Usage:/,/^# Exit codes/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
