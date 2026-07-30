#!/usr/bin/env bash
#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# https://www.apache.org/licenses/LICENSE-2.0
#
# check-agents-md.sh — mechanical checks for a repository's agent-facing instruction files.
#
# Every failure this catches was found by hand at least once. The maintenance loop written into
# AGENTS.md relies on an agent choosing to compare the file against the disk; this does it whether
# anyone remembers or not.
#
# Usage:
#   scripts/check-agents-md.sh [repo-root]     # default: the repository containing this script
#   scripts/check-agents-md.sh --self-test     # build a deliberately broken repo, assert it fails
#
# Environment:
#   AGENTS_MD_MAX_LINES       line budget for AGENTS.md (default 150)
#   PRIVATE_NAME_LIST         path to a deny-list of strings that must not appear in the tree
#
# Exit codes: 0 all checks passed · 1 at least one check failed · 2 bad usage.

set -uo pipefail

FAILURES=0
CHECKS=0

fail() { FAILURES=$((FAILURES + 1)); printf 'FAIL  [%s] %s\n' "$1" "$2"; }
pass() { printf 'ok    [%s] %s\n' "$1" "$2"; }
skip() { printf 'SKIP  [%s] %s\n' "$1" "$2"; }
head_() { CHECKS=$((CHECKS + 1)); }

# --- path helpers -------------------------------------------------------------------------------
# No realpath/readlink -f: neither is portable to a stock macOS. Paths here are always relative to
# the repository root, so normalizing them is a stack of components.

norm_rel() { # $1 = path relative to repo root; prints the normalized path, or OUTSIDE
  local input="$1" part out="" oldifs="$IFS"
  IFS='/'
  # shellcheck disable=SC2086
  set -- $input
  IFS="$oldifs"
  for part in "$@"; do
    case "$part" in
      '' | .) ;;
      ..)
        case "$out" in
          *" "*) out="${out% *}" ;;
          "") echo OUTSIDE; return 0 ;;
          *) out="" ;;
        esac
        ;;
      *) out="$out${out:+ }$part" ;;
    esac
  done
  echo "${out// //}"
}

# Markdown files worth checking: everything git tracks, minus the template trees. A link inside
# skills/*/templates/ is written to resolve in the *target* repo, not this one.
tracked_md() {
  git -C "$ROOT" ls-files '*.md' 2>/dev/null | grep -v '/templates/' || true
}

# --- checks -------------------------------------------------------------------------------------

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

# Unresolvable links, and links that climb out of the repository. Both in one pass over the same
# extraction, because they differ only in what the normalizer returns.
check_links() {
  head_
  local id="links" bad=0 escaped=0 file dir link target norm
  for file in $(tracked_md); do
    dir=$(dirname "$file")
    # ](path) — every occurrence on every line, not just the last. Fenced blocks and inline code spans
    # are stripped first: link syntax quoted as code is not a link. Skip external links, anchors, mail,
    # and paths carrying an unexpanded variable.
    for link in $(awk 'BEGIN { fenced = 0 } /^[[:space:]]*```/ { fenced = !fenced; next } !fenced' "$ROOT/$file" |
      sed 's/`[^`]*`//g' | grep -oE '\]\([^)]+\)' | sed 's/^](//; s/)$//' |
      grep -v '^http' | grep -v '^#' | grep -v '^mailto:' | grep -v '\${' || true); do
      target="${link%%#*}"
      [ -z "$target" ] && continue
      case "$target" in /*) fail "$id" "$file: absolute path in a link: $target"; bad=$((bad + 1)); continue ;; esac
      norm=$(norm_rel "$dir/$target")
      if [ "$norm" = "OUTSIDE" ]; then
        fail "$id" "$file: link reaches outside the repository: $target"
        escaped=$((escaped + 1))
      elif [ ! -e "$ROOT/$norm" ]; then
        fail "$id" "$file: link does not resolve: $target"
        bad=$((bad + 1))
      fi
    done
  done
  [ $((bad + escaped)) -eq 0 ] && pass "$id" "every relative link in tracked markdown resolves inside the repository"
}

# The .agents/ ↔ .claude/ bridge. Two distinct failures: a real file where a symlink belongs, and a
# symlink that git checked out as text (core.symlinks=false) — which looks like a working rule file
# containing one line of nonsense.
check_bridge() {
  head_
  local id="bridge" problems=0 mode path
  if [ ! -d "$ROOT/.claude" ]; then
    skip "$id" "no .claude/ directory — nothing to bridge"
    return
  fi
  while read -r mode _ _ path; do
    [ -z "${path:-}" ] && continue
    case "$path" in
      .claude/rules/*.md | .claude/skills/*) ;;
      *) continue ;;
    esac
    if [ "$mode" != "120000" ]; then
      fail "$id" "$path is a regular file — .claude/ must hold a relative symlink into .agents/"
      problems=$((problems + 1))
      continue
    fi
    if [ ! -L "$ROOT/$path" ]; then
      fail "$id" "$path is a symlink in git but not on disk — checked out as text (core.symlinks=false)"
      problems=$((problems + 1))
    elif [ ! -e "$ROOT/$path" ]; then
      fail "$id" "$path is a symlink whose target does not exist"
      problems=$((problems + 1))
    fi
  done <<EOF
$(git -C "$ROOT" ls-files -s .claude 2>/dev/null)
EOF
  [ "$problems" -eq 0 ] && pass "$id" "every .claude/ rule and skill is a resolving symlink"
}

check_rule_frontmatter() {
  head_
  local id="frontmatter" problems=0 rule
  if [ ! -d "$ROOT/.agents/rules" ]; then
    skip "$id" "no .agents/rules/ directory"
    return
  fi
  for rule in "$ROOT"/.agents/rules/*.md; do
    [ -e "$rule" ] || continue
    if [ "$(head -n 1 "$rule")" != "---" ]; then
      fail "$id" "${rule#"$ROOT"/} has no frontmatter block"
      problems=$((problems + 1))
    elif ! sed -n '2,/^---$/p' "$rule" | grep -q '^description:[[:space:]]*[^[:space:]]'; then
      fail "$id" "${rule#"$ROOT"/} has no description: — a rule without one is never surfaced"
      problems=$((problems + 1))
    fi
  done
  [ "$problems" -eq 0 ] && pass "$id" "every rule declares a description"
}

# The deny-list is deliberately NOT stored in this repository. A validation command that spells out
# private names in order to grep for them has already leaked them. Point PRIVATE_NAME_LIST at a file
# outside the tree; with no list the check reports itself skipped rather than passing silently.
check_private_names() {
  head_
  local id="private-names" list="${PRIVATE_NAME_LIST:-}" hits=0 lineno=0 name
  if [ -z "$list" ]; then
    skip "$id" "no PRIVATE_NAME_LIST set — the deny-list lives outside this repository by design"
    return
  fi
  if [ ! -f "$list" ]; then
    fail "$id" "PRIVATE_NAME_LIST points at $list, which does not exist"
    return
  fi
  case "$(git -C "$ROOT" ls-files --error-unmatch "$list" 2>/dev/null)" in
    ?*) fail "$id" "the deny-list is tracked by git — it must live outside the published tree"; return ;;
  esac
  while read -r name; do
    lineno=$((lineno + 1))
    [ -z "$name" ] && continue
    case "$name" in \#*) continue ;; esac
    if git -C "$ROOT" grep -qiF -- "$name" 2>/dev/null; then
      # the offending string is never echoed — printing it here would leak it into CI logs
      fail "$id" "deny-list entry on line $lineno of the list appears in the tracked tree"
      hits=$((hits + 1))
    fi
  done < "$list"
  [ "$hits" -eq 0 ] && pass "$id" "no deny-listed name appears in the tracked tree"
}

# A committed file must never point at a personal memory store: the reader does not have it, and the
# pointer dangles the moment the memory is renamed.
check_memory_slugs() {
  head_
  local id="memory-slugs" hits
  hits=$(git -C "$ROOT" grep -n -E '\[\[[a-z0-9][a-z0-9_-]*\]\]' -- '*.md' 2>/dev/null | grep -v '/templates/' || true)
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits" | while read -r line; do fail "$id" "wiki-style memory link: $line"; done
    FAILURES=$((FAILURES + 1))
  else
    pass "$id" "no personal-memory links in tracked markdown"
  fi
}

# --- self-test ----------------------------------------------------------------------------------
# Acceptance for this script is "fails on a deliberately broken copy and passes on this repository".
# The second half is running it; this is the first half, so the claim is not taken on trust.

self_test() {
  local expected got rc
  # not local: the EXIT trap runs after this function has returned
  tmp=$(mktemp -d) || exit 2
  denylist=$(mktemp) || exit 2
  trap 'rm -rf "$tmp" "$denylist"' EXIT

  git -C "$tmp" init -q
  mkdir -p "$tmp/.agents/rules" "$tmp/.claude/rules"
  # over budget, a link that does not resolve, one that climbs out of the repo, a memory slug
  { yes 'padding line' | head -n 200; } > "$tmp/AGENTS.md"
  {
    echo '- [gone](docs/does-not-exist.md)'
    echo '- [escape](../../etc/passwd)'
    echo '- [memory](x) see [[project_something]]'
  } >> "$tmp/AGENTS.md"
  printf -- '---\npaths: ["x/**"]\n---\n\nno description above.\n' > "$tmp/.agents/rules/nodesc.md"
  printf 'not a symlink\n' > "$tmp/.claude/rules/nodesc.md"
  git -C "$tmp" add -A >/dev/null 2>&1
  # a deny-list living outside the fixture, matching a string the fixture does contain
  printf '# comment line, ignored\npadding line\n' > "$denylist"

  got=$(AGENTS_MD_MAX_LINES=150 PRIVATE_NAME_LIST="$denylist" "$0" "$tmp" 2>&1)
  rc=$?

  echo "--- self-test: output of the run against the broken fixture ---"
  printf '%s\n' "$got"
  echo "---"

  if [ "$rc" -eq 0 ]; then
    echo "SELF-TEST FAILED: the script passed a repository that is broken in five ways"
    return 1
  fi
  for expected in budget links bridge frontmatter private-names memory-slugs; do
    if ! printf '%s\n' "$got" | grep -q "FAIL  \[$expected\]"; then
      echo "SELF-TEST FAILED: check '$expected' did not fire on the fixture"
      return 1
    fi
  done
  echo "SELF-TEST PASSED: every check fired on the broken fixture"
  return 0
}

# --- main ---------------------------------------------------------------------------------------

if [ "${1:-}" = "--self-test" ]; then
  self_test
  exit $?
fi

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  sed -n '12,26p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
fi

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
[ -d "$ROOT" ] || { echo "not a directory: $ROOT" >&2; exit 2; }
ROOT=$(cd "$ROOT" && pwd)

printf 'check-agents-md — %s\n\n' "$ROOT"

check_budget
check_links
check_bridge
check_rule_frontmatter
check_private_names
check_memory_slugs

printf '\n%d checks, %d failed\n' "$CHECKS" "$FAILURES"
[ "$FAILURES" -eq 0 ] || exit 1
