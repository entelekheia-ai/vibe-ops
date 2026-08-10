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
# test-license-headers.sh — exercises skills/license-setup/templates/ensure-license-headers.sh
# end to end.
#
# That template is copied into every repo /license-setup touches and, until now, had never once been
# executed by this repo's own CI (issue #12) — a regression in it was undetectable. This renders it
# with a throwaway substitution set, the way Step 5 of the skill does, and runs the result against a
# real git repository in a temp directory: both --check mode and the staged-file injection path, for
# the plain and fork variants, asserting the exclusion gate (vendored/generated paths) holds in both
# directions and that no file outside the one being fixed is ever touched.
#
# Usage: scripts/test-license-headers.sh
# Exit codes: 0 all assertions passed · 1 at least one failed · 2 bad setup.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
TEMPLATE="$SCRIPT_DIR/../skills/license-setup/templates/ensure-license-headers.sh"

FAILURES=0
ok() { printf 'ok    %s\n' "$1"; }
fail() { FAILURES=$((FAILURES + 1)); printf 'FAIL  %s\n' "$1"; }

[[ -f "$TEMPLATE" ]] || { echo "test-license-headers: template not found at $TEMPLATE"; exit 2; }

TMPROOT=$(mktemp -d) || exit 2
trap 'rm -rf "$TMPROOT"' EXIT

# --- render the template the way SKILL.md Step 5 does --------------------------------------------

strip_non_fork() {
  awk '/<!-- FORK_ONLY:start -->/{s=1;next} /<!-- FORK_ONLY:end -->/{s=0;next} s{next} {print}' "$1"
}
strip_fork_markers() {
  grep -v -e '<!-- FORK_ONLY:start -->' -e '<!-- FORK_ONLY:end -->' "$1"
}

render() { # $1 = plain|fork, $2 = output path
  local mode="$1" out="$2" src_lines body="" line
  local exclude_cases=$'    vendor/*)  return 0 ;;  # vendored third-party code, not ours to relicense\n    pkg/*)     return 0 ;;  # wasm-bindgen generator output, rewritten on each build'
  if [[ "$mode" == "fork" ]]; then
    src_lines="$(strip_fork_markers "$TEMPLATE")"
  else
    src_lines="$(strip_non_fork "$TEMPLATE")"
  fi
  # Line-by-line, not awk -v: the exclusion block is a multi-line value, and the awk shipped on
  # macOS (the one-true-awk) rejects an embedded newline inside a -v assignment.
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == *'{{EXCLUDE_PATHS_CASES}}'* ]]; then
      body+="$exclude_cases"$'\n'
    else
      body+="$line"$'\n'
    fi
  done <<< "$src_lines"
  body="${body//\{\{SOURCE_GLOB_ARRAY\}\}/\"*.ts\"}"
  body="${body//\{\{LICENSE_ID\}\}/Apache-2.0}"
  if [[ "$mode" == "fork" ]]; then
    body="${body//\{\{ORIGIN_LICENSE_SHORT\}\}/MIT}"
    body="${body//\{\{ORIGIN_PROJECT\}\}/UpstreamThing}"
    body="${body//\{\{ORIGIN_AUTHOR\}\}/Upstream Author}"
    body="${body//\{\{PROJECT_NAME\}\}/TestProject}"
  fi
  printf '%s\n' "$body" > "$out"
  chmod +x "$out"
}

init_repo() { # $1 = repo dir
  git -C "$1" init -q
  git -C "$1" config user.email test@example.invalid
  git -C "$1" config user.name test
}

# --- plain (non-fork) variant ---------------------------------------------------------------------

test_plain() {
  local tmp="$TMPROOT/plain" script repo b_before v_before g_before
  mkdir -p "$tmp"
  script="$tmp/ensure-license-headers.sh"
  render plain "$script"
  if grep -n '{{' "$script" >/dev/null; then
    fail "plain: rendered script still has {{placeholders}}"
    return
  fi

  repo="$tmp/repo"
  mkdir -p "$repo/src" "$repo/vendor" "$repo/pkg"
  init_repo "$repo"

  printf 'export const a = 1;\n' > "$repo/src/a.ts"
  printf '// SPDX-License-Identifier: Apache-2.0\n\nexport const b = 2;\n' > "$repo/src/b.ts"
  printf 'export const v = 1;\n' > "$repo/vendor/x.ts"
  printf 'export const g = 1;\n' > "$repo/pkg/gen.ts"
  b_before=$(cat "$repo/src/b.ts")
  v_before=$(cat "$repo/vendor/x.ts")
  g_before=$(cat "$repo/pkg/gen.ts")

  git -C "$repo" add -A

  local check_out
  check_out=$(cd "$repo" && bash "$script" --check 2>&1)
  if [[ $? -eq 0 ]]; then
    fail "plain: --check passed with src/a.ts unheadered"
  else
    ok "plain: --check fails while a real gap exists"
  fi
  if printf '%s\n' "$check_out" | grep -q 'vendor/x.ts\|pkg/gen.ts'; then
    fail "plain: --check flagged an excluded path"
  else
    ok "plain: --check does not flag excluded paths"
  fi

  (cd "$repo" && bash "$script") >/dev/null

  if head -1 "$repo/src/a.ts" | grep -q 'SPDX-License-Identifier: Apache-2.0'; then
    ok "plain: header injected into the real gap"
  else
    fail "plain: header was not injected into src/a.ts"
  fi

  if [[ "$(cat "$repo/vendor/x.ts")" == "$v_before" \
     && "$(cat "$repo/pkg/gen.ts")" == "$g_before" \
     && "$(cat "$repo/src/b.ts")" == "$b_before" ]]; then
    ok "plain: excluded and already-headered files are byte-identical"
  else
    fail "plain: an excluded or already-headered file was modified"
  fi

  if (cd "$repo" && bash "$script" --check) >/dev/null 2>&1; then
    ok "plain: --check passes once the real gap is fixed"
  else
    fail "plain: --check still fails after injection"
  fi
}

# --- fork variant ------------------------------------------------------------------------------

test_fork() {
  local tmp="$TMPROOT/fork" script repo legacy_before
  mkdir -p "$tmp"
  script="$tmp/ensure-license-headers.sh"
  render fork "$script"
  if grep -n '{{' "$script" >/dev/null; then
    fail "fork: rendered script still has {{placeholders}}"
    return
  fi

  repo="$tmp/repo"
  mkdir -p "$repo/src"
  init_repo "$repo"

  # Pre-SPDX legacy prose headers — must NOT contain the literal string "SPDX-License-Identifier",
  # or the script's "already headered" fast path skips them before fork classification ever runs.
  printf '/*\n * Copyright 2020 Upstream Author\n * Licensed under the MIT License\n */\n\nexport const legacy = 1;\n' \
    > "$repo/src/legacy.ts"
  printf '/*\n * Copyright 2020 Upstream Author\n * Licensed under the MIT License, modified for TestProject under Apache-2.0\n */\n\nexport const mixed = 1;\n' \
    > "$repo/src/mixed.ts"
  legacy_before=$(cat "$repo/src/legacy.ts")

  git -C "$repo" add -A
  (cd "$repo" && bash "$script") >/dev/null

  if [[ "$(cat "$repo/src/legacy.ts")" == "$legacy_before" ]]; then
    ok "fork: pure-legacy header left untouched"
  else
    fail "fork: pure-legacy header was modified"
  fi

  if head -1 "$repo/src/mixed.ts" | grep -q 'AND MIT'; then
    ok "fork: mixed header migrated to the dual SPDX line"
  else
    fail "fork: mixed header was not migrated"
  fi
}

test_plain
test_fork

if [[ $FAILURES -gt 0 ]]; then
  echo "test-license-headers: $FAILURES assertion(s) failed"
  exit 1
fi
echo "test-license-headers: all assertions passed"
exit 0
