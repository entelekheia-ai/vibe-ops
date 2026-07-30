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
# It checks the repository you point it at, not the one it lives in — run it from an installed
# plugin against any working tree.
#
# Usage:
#   check-agents-md.sh [repo-root]     # default: the working tree containing the current directory
#   check-agents-md.sh --list          # print the checks that would run, and their source files
#   check-agents-md.sh --self-test     # build a deliberately broken repo, assert every check fails
#
# Environment:
#   AGENTS_MD_MAX_LINES       line budget for AGENTS.md (default 150)
#   PRIVATE_NAME_LIST         path to a deny-list of strings that must not appear in the tree
#   VIBE_OPS_CHECK_DIRS       colon-separated extra fragment directories, composed after the built-ins
#
# Exit codes: 0 all checks passed · 1 at least one check failed · 2 bad usage.

set -uo pipefail

FAILURES=0
CHECKS=0

fail() { FAILURES=$((FAILURES + 1)); printf 'FAIL  [%s] %s\n' "$1" "$2"; }
pass() { printf 'ok    [%s] %s\n' "$1" "$2"; }
skip() { printf 'SKIP  [%s] %s\n' "$1" "$2"; }
head_() { CHECKS=$((CHECKS + 1)); }

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
HOME_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

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

# --- composition --------------------------------------------------------------------------------
# The checks are not written here. Each lives in its own versioned fragment under checks/, and this
# step only selects and orders them — it never authors one. A check generated at runtime and thrown
# away cannot be diffed, reviewed, or shown to have stopped detecting something (ADR-0004).
#
# A fragment named NN-<id>.sh must define check_<id>, with '-' as '_'. It may use fail/pass/skip,
# head_, norm_rel, tracked_md and $ROOT; it must not write anything into $ROOT.

COMPOSED_IDS=()
COMPOSED_SRC=()

compose_checks() {
  local dirs="$HOME_ROOT/scripts/checks${VIBE_OPS_CHECK_DIRS:+:$VIBE_OPS_CHECK_DIRS}"
  local dir frag base id fn oldifs="$IFS"
  IFS=':'
  # shellcheck disable=SC2086
  set -- $dirs
  IFS="$oldifs"
  for dir in "$@"; do
    [ -d "$dir" ] || continue
    for frag in "$dir"/[0-9][0-9]-*.sh; do
      [ -e "$frag" ] || continue
      base=$(basename "$frag" .sh)
      id="${base#*-}"
      fn="check_${id//-/_}"
      # shellcheck disable=SC1090
      . "$frag" || { echo "cannot source fragment: $frag" >&2; exit 2; }
      if ! command -v "$fn" >/dev/null 2>&1; then
        echo "fragment $frag defines no $fn()" >&2
        exit 2
      fi
      COMPOSED_IDS+=("$id")
      COMPOSED_SRC+=("$frag")
    done
  done
  if [ "${#COMPOSED_IDS[@]}" -eq 0 ]; then
    echo "no checks composed — expected fragments in $HOME_ROOT/scripts/checks" >&2
    exit 2
  fi
}

report_composition() {
  local i src
  printf 'composed %d checks:\n' "${#COMPOSED_IDS[@]}"
  for i in "${!COMPOSED_IDS[@]}"; do
    src="${COMPOSED_SRC[$i]}"
    printf '  %-14s %s\n' "${COMPOSED_IDS[$i]}" "${src#"$HOME_ROOT"/}"
  done
  printf '\n'
}

run_checks() {
  local id
  for id in "${COMPOSED_IDS[@]}"; do
    "check_${id//-/_}"
  done
}

# --- self-test ----------------------------------------------------------------------------------
# Acceptance for this script is "fails on a deliberately broken copy and passes on this repository".
# The second half is running it; this is the first half, so the claim is not taken on trust.

self_test() {
  local expected got rc before after
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

  before=$(find "$tmp" | sort)
  got=$(AGENTS_MD_MAX_LINES=150 PRIVATE_NAME_LIST="$denylist" "$0" "$tmp" 2>&1)
  rc=$?
  after=$(find "$tmp" | sort)

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
  # the target is read, never written: a validator that edits the repository it is judging would be
  # doing the one thing the skills invoking it promise not to do
  if [ "$before" != "$after" ]; then
    echo "SELF-TEST FAILED: the run changed the target repository"
    printf '%s\n' "$before" > "$tmp.before"; printf '%s\n' "$after" > "$tmp.after"
    diff "$tmp.before" "$tmp.after"; rm -f "$tmp.before" "$tmp.after"
    return 1
  fi
  echo "SELF-TEST PASSED: every check fired on the broken fixture, which is unchanged by the run"
  return 0
}

# --- main ---------------------------------------------------------------------------------------

case "${1:-}" in
  --self-test)
    compose_checks
    self_test
    exit $?
    ;;
  --list)
    compose_checks
    report_composition
    exit 0
    ;;
  -h | --help)
    sed -n '11,30p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

# No argument means the repository you are standing in — not the one holding this script. The script
# is installed with the plugin and is expected to be run from elsewhere.
if [ -n "${1:-}" ]; then
  ROOT="$1"
  [ -d "$ROOT" ] || { echo "not a directory: $ROOT" >&2; exit 2; }
  ROOT=$(cd "$ROOT" && pwd)
else
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "not inside a git working tree — pass the repository root as an argument" >&2
    exit 2
  }
fi

git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1 || {
  echo "not a git working tree: $ROOT" >&2
  exit 2
}

compose_checks

printf 'check-agents-md — %s\n\n' "$ROOT"
report_composition
run_checks

printf '\n%d checks, %d failed\n' "$CHECKS" "$FAILURES"
[ "$FAILURES" -eq 0 ] || exit 1
