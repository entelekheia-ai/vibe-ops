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
# If you are reading this inside a repository that is not vibe-ops, it is a snapshot: CI cannot reach
# an installed Claude Code plugin, so the script was copied here to run there. It does not update
# itself. The original is scripts/ in https://github.com/entelekheia-ai/vibe-ops — refresh by copying
# that directory again from a newer release.
#
# Usage:
#   check-agents-md.sh [repo-root]     # default: the working tree containing the current directory
#   check-agents-md.sh --list          # print the checks that would run, and their source files
#   check-agents-md.sh --self-test     # build a deliberately broken repo, assert every check fails
#
# Environment:
#   AGENTS_MD_MAX_LINES       line budget for AGENTS.md (default 150)
#   PRIVATE_NAME_LIST         path to a file of names that must not appear in the tree, one per line
#   PRIVATE_NAMES             the same, inline, newline- or colon-separated
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

# Everything composed for a single run lives here and nowhere else: mode 700, created on first use,
# removed on exit however the run ends. A signal handler as well as an EXIT trap, because the artifact
# this holds is a list of private names and "we were interrupted" is not an acceptable reason for it to
# survive. It is never created inside $ROOT — the repository being checked is read-only to this script.
WORKDIR=""

make_workdir() {
  [ -n "$WORKDIR" ] && return 0
  # An explicit template rooted at $TMPDIR, because BSD `mktemp -d` with no template ignores TMPDIR
  # and goes to the system directory regardless. GNU honours it, so without this the script places
  # the directory differently on macOS and Linux — and the self-test's isolation would be a no-op on
  # exactly one of them.
  local base="${TMPDIR:-/tmp}"
  WORKDIR=$(mktemp -d "${base%/}/vibe-ops.XXXXXXXX") || {
    echo "cannot create a temporary directory" >&2; exit 2; }
  chmod 700 "$WORKDIR"
  trap 'rm -rf "$WORKDIR"' EXIT
  trap 'rm -rf "$WORKDIR"; exit 130' INT TERM HUP
}

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

# --- the composed deny-list ---------------------------------------------------------------------
# Which names are private is supplied, never inferred — an agent guessing is wrong in both directions.
# What is composed is the *spelling*: one supplied name becomes its separator variants, because a name
# leaks as readily hyphenated as spaced. That expansion is mechanical, so it is composition and not
# inference.
#
# The composed file is `<label>\t<pattern>` per line. The label is where the entry came from — never
# the name itself, so a failure can be traced back to a line of the user's source without the run,
# or a CI log, ever repeating the string it is looking for.

VIBE_OPS_DENYLIST=""

name_variants() { # $1 = one supplied name
  local n="$1"
  {
    printf '%s\n' "$n"
    case "$n" in
      *[\ _-]*)
        printf '%s\n' "$(printf '%s' "$n" | tr '_-' '  ')"
        printf '%s\n' "$(printf '%s' "$n" | tr ' _' '--')"
        printf '%s\n' "$(printf '%s' "$n" | tr ' -' '__')"
        printf '%s\n' "$(printf '%s' "$n" | tr -d ' _-')"
        ;;
    esac
  } | sort -u
}

compose_denylist_from() { # $1 = label prefix, reads names on stdin, appends to the composed file
  local prefix="$1" line lineno=0 variant added=0
  while IFS= read -r line || [ -n "$line" ]; do
    lineno=$((lineno + 1))
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    while IFS= read -r variant; do
      printf '%s:%s\t%s\n' "$prefix" "$lineno" "$variant" >> "$VIBE_OPS_DENYLIST"
    done <<EOF
$(name_variants "$line")
EOF
    added=$((added + 1))
  done
  echo "$added"
}

compose_denylist() {
  local sources="" n

  if [ -z "${PRIVATE_NAME_LIST:-}" ] && [ -z "${PRIVATE_NAMES:-}" ]; then
    return 0
  fi

  make_workdir
  VIBE_OPS_DENYLIST="$WORKDIR/private-names"
  : > "$VIBE_OPS_DENYLIST"
  chmod 600 "$VIBE_OPS_DENYLIST"

  if [ -n "${PRIVATE_NAME_LIST:-}" ]; then
    # A misconfigured deny-list is a usage error, not a check failure. Reporting "no private name found"
    # after failing to read the list is the one outcome that must not be possible.
    [ -f "$PRIVATE_NAME_LIST" ] || {
      echo "PRIVATE_NAME_LIST points at $PRIVATE_NAME_LIST, which does not exist" >&2; exit 2; }
    if git -C "$ROOT" ls-files --error-unmatch "$PRIVATE_NAME_LIST" >/dev/null 2>&1; then
      echo "the deny-list is tracked by git — it must live outside the published tree" >&2
      exit 2
    fi
    n=$(compose_denylist_from list < "$PRIVATE_NAME_LIST")
    sources="$n from a file outside the tree"
  fi

  if [ -n "${PRIVATE_NAMES:-}" ]; then
    n=$(printf '%s\n' "${PRIVATE_NAMES//:/$'\n'}" | compose_denylist_from inline)
    sources="${sources:+$sources, }$n supplied inline"
  fi

  printf 'composed deny-list: %s, expanded to %s patterns, held in a temporary directory for this run\n\n' \
    "$sources" "$(wc -l < "$VIBE_OPS_DENYLIST" | tr -d ' ')"
}

# --- self-test ----------------------------------------------------------------------------------
# Acceptance for this script is "fails on a deliberately broken copy and passes on this repository".
# The second half is running it; this is the first half, so the claim is not taken on trust.

self_test() {
  local expected got rc irc before after leftover
  # not local: the EXIT trap runs after this function has returned
  tmp=$(mktemp -d) || exit 2
  denylist=$(mktemp) || exit 2
  fragdir=$(mktemp -d) || exit 2
  # a TMPDIR of its own for the runs under test. Asserting against the shared one would mean asserting
  # that nothing else on the machine wrote a temporary file during those two seconds, which is not true
  # and made this check fail about one run in six.
  runtmp=$(mktemp -d) || exit 2
  trap 'rm -rf "$tmp" "$denylist" "$fragdir" "$runtmp"' EXIT

  git -C "$tmp" init -q
  mkdir -p "$tmp/.agents/rules" "$tmp/.claude/rules"
  # over budget, a link that does not resolve, one that climbs out of the repo, a memory slug
  { yes 'padding line' | head -n 200; } > "$tmp/AGENTS.md"
  {
    echo '- [gone](docs/does-not-exist.md)'
    echo '- [escape](../../etc/passwd)'
    echo '- [memory](x) see [[project_something]]'
    echo '- run `${CLAUDE_PLUGIN_ROOT}/scripts/does-not-ship.sh` — a path in a command, not a link'
  } >> "$tmp/AGENTS.md"
  printf -- '---\npaths: ["x/**"]\n---\n\nno description above.\n' > "$tmp/.agents/rules/nodesc.md"
  printf 'not a symlink\n' > "$tmp/.claude/rules/nodesc.md"
  # a shipped template attributing a real person, in a repository that is not theirs
  mkdir -p "$tmp/skills/demo/templates"
  printf '<!--\n Copyright (c) 2026 Some Person (https://example.invalid)\n-->\n\n# demo\n' \
    > "$tmp/skills/demo/templates/demo.md"
  git -C "$tmp" add -A >/dev/null 2>&1
  # a deny-list living outside the fixture. "padding line" is in the fixture spelled with a space; the
  # entry here is hyphenated, so a hit proves the composed spelling variants are what got searched for.
  printf '# comment line, ignored\npadding-line\n' > "$denylist"
  # a fragment that raises a signal partway through a run, so the interrupted case is exercised at a
  # known point rather than by racing a timer
  printf 'check_selfdestruct() { head_; kill -TERM $$; }\n' > "$fragdir/99-selfdestruct.sh"

  before=$(find "$tmp" | sort)
  got=$(AGENTS_MD_MAX_LINES=150 PRIVATE_NAME_LIST="$denylist" TMPDIR="$runtmp" "$0" "$tmp" 2>&1)
  rc=$?
  after=$(find "$tmp" | sort)

  echo "--- self-test: output of the run against the broken fixture ---"
  printf '%s\n' "$got"
  echo "---"

  if [ "$rc" -eq 0 ]; then
    echo "SELF-TEST FAILED: the script passed a repository that is broken in five ways"
    return 1
  fi
  for expected in budget links bridge frontmatter private-names memory-slugs plugin-root-paths \
    template-attribution; do
    if ! printf '%s\n' "$got" | grep -q "FAIL  \[$expected\]"; then
      echo "SELF-TEST FAILED: check '$expected' did not fire on the fixture"
      return 1
    fi
  done
  # a hit must be traceable without the string being repeated: the deny-list line is named, the name is not
  if ! printf '%s\n' "$got" | grep -q 'private-names.*source: list:2'; then
    echo "SELF-TEST FAILED: the private-name hit did not name the deny-list line it came from"
    return 1
  fi
  if printf '%s\n' "$got" | grep -q 'padding-line'; then
    echo "SELF-TEST FAILED: the run echoed a deny-listed name"
    return 1
  fi

  # the target is read, never written: a validator that edits the repository it is judging would be
  # doing the one thing the skills invoking it promise not to do
  if [ "$before" != "$after" ]; then
    echo "SELF-TEST FAILED: the run changed the target repository"
    printf '%s\n' "$before" > "$tmp.before"; printf '%s\n' "$after" > "$tmp.after"
    diff "$tmp.before" "$tmp.after"; rm -f "$tmp.before" "$tmp.after"
    return 1
  fi

  # and an interrupted run leaves nothing behind either — the composed artifact is a list of private
  # names, so "we were killed" is not an acceptable reason for it to outlive the run
  PRIVATE_NAME_LIST="$denylist" VIBE_OPS_CHECK_DIRS="$fragdir" TMPDIR="$runtmp" "$0" "$tmp" >/dev/null 2>&1
  irc=$?
  if [ "$irc" -eq 0 ]; then
    echo "SELF-TEST FAILED: the interrupted run reported success"
    return 1
  fi
  leftover=$(ls -A "$runtmp" 2>/dev/null)
  if [ -n "$leftover" ]; then
    echo "SELF-TEST FAILED: a run left something behind in its temporary directory"
    printf '%s\n' "$leftover"
    return 1
  fi

  echo "SELF-TEST PASSED: every check fired on the broken fixture; the target and the temporary"
  echo "                 directory are unchanged, after a normal run and after an interrupted one"
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
compose_denylist
run_checks

printf '\n%d checks, %d failed\n' "$CHECKS" "$FAILURES"
[ "$FAILURES" -eq 0 ] || exit 1
