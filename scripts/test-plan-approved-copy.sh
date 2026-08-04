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
# test-plan-approved-copy.sh — exercises hooks/plan-approved-copy.sh against the
# documented PostToolUse/ExitPlanMode payload shape (tool_response.plan,
# tool_response.filePath — docs.claude.com/en/docs/claude-code/hooks). ADR-0009
# obligation 4: a hook must be exercised before the release that ships it.
# project/tasks/004-post-plan-hook.md records the live-session smoke test this
# suite cannot replace — it proves the hook's OWN logic given the documented
# shape, not that Claude Code delivers that shape, which needs one real approval.
#
# Usage: scripts/test-plan-approved-copy.sh
# Exit codes: 0 all assertions passed · 1 at least one failed · 2 bad setup.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
VOR=$(cd "$SCRIPT_DIR/.." && pwd)
HOOK="$VOR/hooks/plan-approved-copy.sh"

[[ -f "$HOOK" ]] || { echo "test-plan-approved-copy: hook not found at $HOOK"; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "test-plan-approved-copy: jq required, not on PATH"; exit 2; }

FAILURES=0
ok()   { printf 'ok    %s\n' "$1"; }
fail() { FAILURES=$((FAILURES + 1)); printf 'FAIL  %s\n' "$1"; }

TMPROOT=$(mktemp -d) || exit 2
trap 'rm -rf "$TMPROOT"' EXIT

new_plan_repo() { # $1 = name — a repo with the real plan template, physical path
  local dir="$TMPROOT/$1"
  mkdir -p "$dir/project/templates" "$dir/project/plans"
  git -C "$dir" init -q
  cp "$VOR/project/templates/plan.md" "$dir/project/templates/plan.md"
  (cd "$dir" && pwd -P)
}

payload() { # $1 = cwd, $2 = plan text, $3 = filePath
  jq -nc --arg cwd "$1" --arg plan "$2" --arg fp "$3" \
    '{cwd: $cwd, tool_response: {plan: $plan, filePath: $fp}}'
}

run_hook() { # $1 = payload json, extra env as remaining args (NAME=value ...)
  local p="$1"; shift
  printf '%s' "$p" | env "$@" CLAUDE_PLUGIN_ROOT="$VOR" sh "$HOOK"
}

DURABLE_PLAN='# Plan-001: A durable design record

| Field | Value |
|---|---|
| Status | Backlog |
| Created | 2026-08-03 |

## Summary
test.'

# --- Case 1: cwd fallback, real copy, correct content -----------------------------------------------
test_cwd_fallback_copies() {
  local repo out target
  repo=$(new_plan_repo repo1)
  out=$(run_hook "$(payload "$repo" "$DURABLE_PLAN" "/x.md")")
  target="$repo/project/plans/001-a-durable-design-record.md"
  if [[ -f "$target" ]] && diff -q <(printf '%s\n' "$DURABLE_PLAN") "$target" >/dev/null; then
    ok "cwd fallback: plan copied verbatim to the resolved target"
  else
    fail "cwd fallback: expected $target with the plan's exact content"
  fi
  if [[ "$out" == *"$target"* && "$out" == *'"hookEventName":"PostToolUse"'* ]]; then
    ok "cwd fallback: additionalContext names the real target path"
  else
    fail "cwd fallback: additionalContext missing or malformed, got: $out"
  fi
}

# --- Case 2: explicit Repository row overrides cwd ---------------------------------------------------
test_repository_row_overrides_cwd() {
  local umbrella target_repo out target
  umbrella=$(new_plan_repo umbrella2)
  target_repo="$TMPROOT/other2"
  mkdir -p "$target_repo/project/plans"
  git -C "$target_repo" init -q
  target_repo=$(cd "$target_repo" && pwd -P)
  local plan="# Plan-001: Cross repo

| Field | Value |
|---|---|
| Status | Backlog |
| Repository | $target_repo |

## Summary
test."
  local before_umbrella
  before_umbrella=$(find "$umbrella" -type f | sort)
  out=$(run_hook "$(payload "$umbrella" "$plan" "/x.md")")
  target="$target_repo/project/plans/001-cross-repo.md"
  if [[ -f "$target" ]]; then
    ok "Repository row: filed into the named repo, not the umbrella cwd"
  else
    fail "Repository row: expected $target to exist"
  fi
  if [[ "$before_umbrella" == "$(find "$umbrella" -type f | sort)" ]]; then
    ok "Repository row: nothing written into the umbrella"
  else
    fail "Repository row: something was written into the umbrella repo"
  fi
}

# --- Case 3: no H1, or no Status row — stays silent ---------------------------------------------------
test_throwaway_plan_silent() {
  local repo out
  repo=$(new_plan_repo repo3)
  out=$(run_hook "$(payload "$repo" "just some prose, no heading, no table." "/x.md")")
  if [[ -z "$out" ]]; then ok "no H1: silent"; else fail "no H1: expected silence, got: $out"; fi

  out=$(run_hook "$(payload "$repo" "# A heading with no metadata table

prose only." "/x.md")")
  if [[ -z "$out" ]]; then ok "no Status row: silent"; else fail "no Status row: expected silence, got: $out"; fi

  if [[ -z "$(find "$repo/project/plans" -type f 2>/dev/null)" ]]; then
    ok "throwaway plans: nothing was written to project/plans/"
  else
    fail "throwaway plans: a file was written when it should not have been"
  fi
}

# --- Case 4: repo with no plan convention — stays silent ---------------------------------------------
test_no_plan_convention_silent() {
  local repo out
  repo="$TMPROOT/bare4"
  mkdir -p "$repo"
  git -C "$repo" init -q
  repo=$(cd "$repo" && pwd -P)
  out=$(run_hook "$(payload "$repo" "$DURABLE_PLAN" "/x.md")")
  if [[ -z "$out" ]]; then ok "no plan template in repo: silent"; else fail "expected silence, got: $out"; fi
}

# --- Case 5: missing jq — stays silent, never a best-effort parse -------------------------------------
test_missing_jq_silent() {
  local repo out shim b
  repo=$(new_plan_repo repo5)
  shim="$TMPROOT/no-jq-path"
  mkdir -p "$shim"
  for b in sh sed grep git head cut tr mkdir dirname printf cat env; do
    local p; p=$(command -v "$b" 2>/dev/null) && ln -sf "$p" "$shim/$b"
  done
  out=$(printf '%s' "$(payload "$repo" "$DURABLE_PLAN" "/x.md")" \
    | env PATH="$shim" CLAUDE_PLUGIN_ROOT="$VOR" sh "$HOOK")
  if [[ -z "$out" ]]; then ok "jq absent: silent, no best-effort parse attempted"; else fail "expected silence without jq, got: $out"; fi
}

# --- Case 6: two approvals from the same source file get two different targets, neither overwritten --
# Not a test of the `[ -f "$TARGET" ]` guard itself — that line is structurally unreachable through this
# normal flow, since NEXT is always resolved fresh as one past the highest existing number and so can
# never already have a file on a first pass (see the guard's own comment in the hook). What IS reachable,
# and is the actual property project/tasks/004-post-plan-hook.md worried about (the same source
# planFilePath approved twice in one session, observed live with Plan-005 then Plan-006), is this: two
# different plans copied in sequence never collide or overwrite each other, because each call re-resolves
# NEXT from the disk state the previous call left behind.
test_two_approvals_get_different_numbers() {
  local repo out1 out2 first second
  repo=$(new_plan_repo repo6)
  out1=$(run_hook "$(payload "$repo" "$DURABLE_PLAN" "/x.md")")
  local second_plan="# Plan-001: A second, different plan

| Field | Value |
|---|---|
| Status | Backlog |

## Summary
different content."
  out2=$(run_hook "$(payload "$repo" "$second_plan" "/x.md")")
  first="$repo/project/plans/001-a-durable-design-record.md"
  second="$repo/project/plans/002-a-second-different-plan.md"
  if [[ -f "$first" && -f "$second" ]]; then
    ok "two approvals from one source: both plans filed, under different numbers"
  else
    fail "two approvals from one source: expected both $first and $second to exist"
  fi
  if grep -q 'test\.' "$first" 2>/dev/null && grep -q 'different content\.' "$second" 2>/dev/null; then
    ok "two approvals from one source: neither file's content leaked into the other"
  else
    fail "two approvals from one source: content mismatch — one file may have overwritten the other"
  fi
  if [[ "$out1" == *"001-a-durable-design-record.md"* && "$out2" == *"002-a-second-different-plan.md"* ]]; then
    ok "two approvals from one source: each additionalContext names its own real target"
  else
    fail "two approvals from one source: additionalContext did not name the expected targets, got out1=[$out1] out2=[$out2]"
  fi
}

test_cwd_fallback_copies
test_repository_row_overrides_cwd
test_throwaway_plan_silent
test_no_plan_convention_silent
test_missing_jq_silent
test_two_approvals_get_different_numbers

if [[ $FAILURES -gt 0 ]]; then
  echo "test-plan-approved-copy: $FAILURES assertion(s) failed"
  exit 1
fi
echo "test-plan-approved-copy: all assertions passed"
exit 0
