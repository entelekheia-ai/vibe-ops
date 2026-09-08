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
# test-plan-progress-nudge.sh — commits the Track 3b gate suite Plan-006 cut as debt, and adds the
# cases that escaped it. Everything here was run ad hoc against the working tree before 0.7.0 shipped;
# from this repository's point of view none of it had ever happened, and two post-install defects
# (offset reset on resume, the state sweep selecting its own directory) are exactly what a committed
# suite would have caught.
#
# This run also covers the taxonomy fix (project/tasks/001-*.md): the hook used to hardcode vibe-ops's
# own status word and section names onto every installed repository. It shipped in 0.7.0, was found by
# a maintainer's question rather than by any test, and is fixed by deriving both from
# resolve-governance.sh's PLAN_ACTIVE / LIVING outputs instead. Several cases below exist specifically
# to prove a repo with a DIFFERENT taxonomy is handled correctly, not just a repo with none.
#
# Ported (project/plans/040-*.md Track 7) to drive `vibe-ops hook plan-progress` — the CLI surface that
# replaced `plugin/hooks/plan-progress-nudge.sh` — instead of the shell script directly. Every assertion
# below is unchanged; only the thing invoked, and the env-var-vs-flag shape of the state directory, moved.
# One case did not survive the port: the old script's no-jq/jq-fallback agreement test had no TypeScript
# counterpart to port, because the new `touchedRepos` has exactly one JSON parser (there is no fallback
# path to disagree with itself).
#
# Usage: cli/test/test-plan-progress-nudge.sh
# Exit codes: 0 all assertions passed · 1 at least one failed · 2 bad setup.

set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
CLI_BIN="$REPO_ROOT/cli/packages/cli/dist/bin.js"

[[ -f "$CLI_BIN" ]] || {
  echo "test-plan-progress-nudge: built CLI not found at $CLI_BIN — run npm run build first"
  exit 2
}

FAILURES=0
ok()   { printf 'ok    %s\n' "$1"; }
fail() { FAILURES=$((FAILURES + 1)); printf 'FAIL  %s\n' "$1"; }

TMPROOT=$(mktemp -d) || exit 2
trap 'rm -rf "$TMPROOT"' EXIT

# --- fixture builders ------------------------------------------------------------------------------

# new_repo <name> — an empty git repo under $TMPROOT, no commits required: `git rev-parse
# --show-toplevel` works against a bare .git directory alone, which is all the touched-repos scan needs.
# Returns the PHYSICAL path (pwd -P): on macOS $TMPDIR resolves through /var -> /private/var, and
# `git rev-parse --show-toplevel` always returns the resolved form — a fixture that recorded the
# unresolved form in its synthetic transcript would fail the plan-self-write suppression check for a
# reason that has nothing to do with the hook.
new_repo() {
  local dir="$TMPROOT/$1"
  mkdir -p "$dir"
  git -C "$dir" init -q
  (cd "$dir" && pwd -P)
}

# write_plan_template <repo> <status_comment_line> <living_block>
# living_block is passed as-is between the two markers; pass "" to omit both markers (pre-Task-001
# template shape), or "NOEND" to write the start marker with no matching end marker (tier 2).
write_plan_template() {
  local repo="$1" status_line="$2" living="$3"
  mkdir -p "$repo/project/templates"
  {
    printf '%s\n\n' "$status_line"
    printf '## Summary\n\n'
    if [[ "$living" == "NOEND" ]]; then
      printf '<!-- ===== LIVING SECTIONS ===== -->\n\n## Progress\n\n## Notes\n\n'
    elif [[ -n "$living" ]]; then
      printf '<!-- ===== LIVING SECTIONS ===== -->\n\n%s\n\n<!-- ===== END LIVING SECTIONS ===== -->\n\n' "$living"
    fi
    printf '## Open questions\n'
  } >"$repo/project/templates/plan.md"
}

# write_plan <repo> <number> <status_value> — a plan file with a Status table row using the given value.
write_plan() {
  local repo="$1" num="$2" status="$3" spacing="${4:-1}"
  mkdir -p "$repo/project/plans"
  if [[ "$spacing" == "tight" ]]; then
    printf '# Plan-%s\n\n|Field|Value|\n|---|---|\n|Status|%s|\n' "$num" "$status" \
      >"$repo/project/plans/$num-fixture.md"
  else
    printf '# Plan-%s\n\n| Field | Value |\n|---|---|\n| Status | %s |\n' "$num" "$status" \
      >"$repo/project/plans/$num-fixture.md"
  fi
}

# transcript_line <file_path> — one minified assistant tool_use record.
transcript_line() {
  printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"%s","old_string":"a","new_string":"b"}}]}}\n' "$1"
}

# hook_call <payload_json> <state_dir> — runs `vibe-ops hook plan-progress` with an isolated state
# directory passed as --state-dir, the same way hooks.json's own registration supplies it by expanding
# ${CLAUDE_PLUGIN_DATA} — never via an env var this process reads.
hook_call() {
  local payload="$1" state_dir="$2"
  mkdir -p "$state_dir"
  printf '%s' "$payload" | node "$CLI_BIN" hook plan-progress --state-dir "$state_dir"
}

stop_payload() {
  local sid="$1" transcript="$2" active="${3:-false}"
  printf '{"session_id":"%s","transcript_path":"%s","cwd":"%s","hook_event_name":"Stop","stop_hook_active":%s}' \
    "$sid" "$transcript" "$TMPROOT" "$active"
}

# --- Case 1: taxonomy is derived, not hardcoded — a DIFFERENT vocabulary is honored -----------------
test_different_taxonomy_enumerates_its_own_sections() {
  local repo tsc sid=t1 state="$TMPROOT/state-t1"
  repo=$(new_repo repo-t1)
  write_plan_template "$repo" \
    '<!-- Status lifecycle: Draft → Doing → Done. -->' \
    '## Journal
## Findings
## Choices
## Wrap-up'
  write_plan "$repo" 001 Doing

  tsc="$TMPROOT/t1.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null   # seed offset, silent

  local other="$repo/README.md"
  : >"$other"
  transcript_line "$other" >>"$tsc"

  local out
  out=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  if [[ "$out" == *'status \"Doing\"'* || "$out" == *'status "Doing"'* ]] \
     && [[ "$out" == *'Journal'* && "$out" == *'Wrap-up'* ]]; then
    ok "different taxonomy: nudge names the repo's own status word and section list"
  else
    fail "different taxonomy: expected Doing + Journal..Wrap-up, got: $out"
  fi
  if [[ "$out" != *'Surprises & Discoveries'* ]]; then
    ok "different taxonomy: vibe-ops's own section names are not leaked into another repo's nudge"
  else
    fail "different taxonomy: vibe-ops's own vocabulary leaked in"
  fi
}

# --- Case 2: no end marker degrades to tier 2 — points at the template, invents nothing -------------
test_no_end_marker_points_at_template_not_sections() {
  local repo tsc sid=t2 state="$TMPROOT/state-t2"
  repo=$(new_repo repo-t2)
  write_plan_template "$repo" '<!-- Status lifecycle: Backlog → In Progress → Shipped. -->' "NOEND"
  write_plan "$repo" 001 "In Progress"

  tsc="$TMPROOT/t2.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null

  : >"$repo/README.md"
  transcript_line "$repo/README.md" >>"$tsc"

  local out
  out=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  if [[ "$out" == *"project/templates/plan.md"* && "$out" == *"LIVING SECTIONS divider"* ]]; then
    ok "no end marker: tier 2 points at the template instead of naming sections"
  else
    fail "no end marker: expected a pointer to the template, got: $out"
  fi
  if [[ "$out" != *"## Progress"* ]]; then
    ok "no end marker: does not fabricate a section list"
  else
    fail "no end marker: fabricated section content leaked through"
  fi
}

# --- Case 3: unknown taxonomy is fully silent, even if the table happens to say "In Progress" -------
test_unknown_taxonomy_is_silent() {
  local repo tsc sid=t3 state="$TMPROOT/state-t3"
  repo=$(new_repo repo-t3)
  # No template, no .agents/rules/governance.md at all: PLAN_ACTIVE must resolve (unknown).
  write_plan "$repo" 001 "In Progress"

  tsc="$TMPROOT/t3.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null

  : >"$repo/README.md"
  transcript_line "$repo/README.md" >>"$tsc"

  local out
  out=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  if [[ -z "$out" ]]; then
    ok "unknown taxonomy: silent even though the table text happens to match vibe-ops's own word"
  else
    fail "unknown taxonomy: expected silence, got: $out"
  fi
}

# --- Case 4: detection is tolerant of cell spacing ---------------------------------------------------
test_detection_tolerant_of_spacing() {
  local repo tsc sid=t4 state="$TMPROOT/state-t4"
  repo=$(new_repo repo-t4)
  write_plan_template "$repo" '<!-- Status lifecycle: Backlog → In Progress → Shipped. -->' \
    '## Progress
## Surprises & Discoveries
## Decision Log
## Outcomes & Retrospective'
  write_plan "$repo" 001 "In Progress" tight   # |Status|In Progress| — no spaces around pipes

  tsc="$TMPROOT/t4.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null

  : >"$repo/README.md"
  transcript_line "$repo/README.md" >>"$tsc"

  local out
  out=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  if [[ "$out" == *"001-fixture.md"* ]]; then
    ok "detection tolerates a status row with no spaces around the pipes"
  else
    fail "detection missed a tightly-spaced status row, got: $out"
  fi
}

# --- Case 5: a plan using the OLD hardcoded word is ignored when the repo's own word differs --------
test_stale_hardcoded_word_is_not_matched() {
  local repo tsc sid=t5 state="$TMPROOT/state-t5"
  repo=$(new_repo repo-t5)
  write_plan_template "$repo" '<!-- Status lifecycle: Backlog → Active → Merged. -->' \
    '## Progress
## Surprises & Discoveries
## Decision Log
## Outcomes & Retrospective'
  # This repo's own active word is "Active" — a plan stuck at the vibe-ops word "In Progress" must NOT fire.
  write_plan "$repo" 001 "In Progress"

  tsc="$TMPROOT/t5.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null

  : >"$repo/README.md"
  transcript_line "$repo/README.md" >>"$tsc"

  local out
  out=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  if [[ -z "$out" ]]; then
    ok "a plan carrying vibe-ops's own word is not matched against a repo with a different word"
  else
    fail "stale hardcoded word still matched, got: $out"
  fi
}

# --- Case 6: first Stop of a session seeds the offset and says nothing ------------------------------
test_first_stop_is_silent() {
  local repo tsc sid=t6 state="$TMPROOT/state-t6"
  repo=$(new_repo repo-t6)
  write_plan_template "$repo" '<!-- Status lifecycle: Backlog → In Progress → Shipped. -->' \
    '## Progress
## Surprises & Discoveries
## Decision Log
## Outcomes & Retrospective'
  write_plan "$repo" 001 "In Progress"

  tsc="$TMPROOT/t6.jsonl"
  transcript_line "$repo/README.md" >"$tsc"   # already "history" before the hook has ever run

  local out
  out=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  if [[ -z "$out" ]] && [[ -f "$state/vibe-ops-progress-$sid" ]] \
     && grep -q "^OFFSET=$(wc -c <"$tsc" | tr -d ' ')\$" "$state/vibe-ops-progress-$sid"; then
    ok "first Stop of a session seeds the offset to the current transcript size and says nothing"
  else
    fail "first Stop did not seed silently, got: $out"
  fi
}

# --- Case 7: a turn that writes only the plan file itself stays fully silent ------------------------
test_writing_the_plan_itself_is_silent() {
  local repo tsc sid=t7 state="$TMPROOT/state-t7"
  repo=$(new_repo repo-t7)
  write_plan_template "$repo" '<!-- Status lifecycle: Backlog → In Progress → Shipped. -->' \
    '## Progress
## Surprises & Discoveries
## Decision Log
## Outcomes & Retrospective'
  write_plan "$repo" 001 "In Progress"

  tsc="$TMPROOT/t7.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null

  transcript_line "$repo/project/plans/001-fixture.md" >>"$tsc"

  local out
  out=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  if [[ -z "$out" ]]; then
    ok "a turn that wrote the plan's own living sections stays silent"
  else
    fail "expected silence when the plan itself was written, got: $out"
  fi
}

# --- Case 8: already-nudged suppression persists across a Stop with no new writes -------------------
test_already_nudged_suppressed_once() {
  local repo tsc sid=t8 state="$TMPROOT/state-t8"
  repo=$(new_repo repo-t8)
  write_plan_template "$repo" '<!-- Status lifecycle: Backlog → In Progress → Shipped. -->' \
    '## Progress
## Surprises & Discoveries
## Decision Log
## Outcomes & Retrospective'
  write_plan "$repo" 001 "In Progress"

  tsc="$TMPROOT/t8.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null

  : >"$repo/README.md"
  transcript_line "$repo/README.md" >>"$tsc"
  local first
  first=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")

  # No new bytes this time — same offset, nothing new written.
  local second
  second=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")

  if [[ -n "$first" && -z "$second" ]] && grep -q "001-fixture.md" "$state/vibe-ops-progress-$sid"; then
    ok "a repeat Stop with no new writes does not re-nudge, but keeps the plan in the outstanding set"
  else
    fail "suppression did not behave as expected: first=[$first] second=[$second]"
  fi
}

# --- Case 9: one turn touching two repos names only the first (sorted) repo's plan, and the other ----
# --- repo still gets its own turn on a later firing (measured against the pre-port script directly: ---
# --- "at most one plan per firing" means the second repo's candidate is neither named nor added to  ---
# --- the outstanding set on the same firing — only the WRITTEN-suppression and already-nudged cases  ---
# --- keep scanning every repository; a fresh candidate does not). ------------------------------------
test_second_repo_gets_its_own_later_turn() {
  local repoA repoB tsc sid=t9 state="$TMPROOT/state-t9"
  repoA=$(new_repo repo-t9a)
  repoB=$(new_repo repo-t9b)
  for r in "$repoA" "$repoB"; do
    write_plan_template "$r" '<!-- Status lifecycle: Backlog → In Progress → Shipped. -->' \
      '## Progress
## Surprises & Discoveries
## Decision Log
## Outcomes & Retrospective'
    write_plan "$r" 001 "In Progress"
  done

  tsc="$TMPROOT/t9.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null

  : >"$repoA/README.md"; : >"$repoB/README.md"
  transcript_line "$repoA/README.md" >>"$tsc"
  transcript_line "$repoB/README.md" >>"$tsc"

  local first
  first=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")

  local nudged_after_first
  nudged_after_first=$(sed -n 's/^NUDGED=//p' "$state/vibe-ops-progress-$sid")
  if [[ "$first" == *"repo-t9a"* && "$nudged_after_first" == *"repo-t9a"* && "$nudged_after_first" != *"repo-t9b"* ]]; then
    ok "one firing names only the first (sorted) repository's plan, and only that one enters the outstanding set"
  else
    fail "expected repo-t9a alone this firing, got out=[$first] nudged=[$nudged_after_first]"
  fi

  # A later firing, with a fresh write into repo B only, gives that repository its own turn.
  transcript_line "$repoB/README.md" >>"$tsc"
  local second
  second=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  local nudged_after_second
  nudged_after_second=$(sed -n 's/^NUDGED=//p' "$state/vibe-ops-progress-$sid")
  if [[ "$second" == *"repo-t9b"* && "$nudged_after_second" == *"repo-t9b"* ]]; then
    ok "the second repository's plan is named and tracked on its own later firing"
  else
    fail "expected repo-t9b on the second firing, got out=[$second] nudged=[$nudged_after_second]"
  fi
}

# --- Case 10: garbage / empty / missing-transcript payloads exit 0 silently --------------------------
test_malformed_payloads_are_silent() {
  local state="$TMPROOT/state-t10" out rc

  out=$(printf '' | node "$CLI_BIN" hook plan-progress --state-dir "$state"); rc=$?
  if [[ -z "$out" && $rc -eq 0 ]]; then ok "empty payload: exit 0, silent"; else fail "empty payload: rc=$rc out=$out"; fi

  out=$(printf 'not json at all {{{' | node "$CLI_BIN" hook plan-progress --state-dir "$state"); rc=$?
  if [[ -z "$out" && $rc -eq 0 ]]; then ok "garbage payload: exit 0, silent"; else fail "garbage payload: rc=$rc out=$out"; fi

  out=$(hook_call "$(stop_payload missing-t10 "$TMPROOT/does-not-exist.jsonl")" "$state"); rc=$?
  if [[ -z "$out" && $rc -eq 0 ]]; then ok "missing transcript file: exit 0, silent"; else fail "missing transcript: rc=$rc out=$out"; fi

  out=$(hook_call "$(stop_payload reentrant-t10 "$TMPROOT/does-not-exist.jsonl" true)" "$state"); rc=$?
  if [[ -z "$out" && $rc -eq 0 ]]; then ok "stop_hook_active:true: never re-fires"; else fail "stop_hook_active guard: rc=$rc out=$out"; fi
}

# --- Case 11: a turn with no tracked writes produces no output (proxy for the zero-git-spawn measurement) --
test_no_write_turn_is_free() {
  local repo tsc sid=t11 state="$TMPROOT/state-t11"
  repo=$(new_repo repo-t11)
  write_plan_template "$repo" '<!-- Status lifecycle: Backlog → In Progress → Shipped. -->' \
    '## Progress
## Surprises & Discoveries
## Decision Log
## Outcomes & Retrospective'
  write_plan "$repo" 001 "In Progress"

  tsc="$TMPROOT/t11.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$state" >/dev/null

  printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"%s"}}]}}\n' \
    "$repo/README.md" >>"$tsc"

  local out
  out=$(hook_call "$(stop_payload "$sid" "$tsc")" "$state")
  if [[ -z "$out" ]]; then
    ok "a turn with only a Read (no tracked write) produces no nudge"
  else
    fail "expected silence for a read-only turn, got: $out"
  fi
}

# --- Case 12: the state sweep never selects its own directory (the -type f regression) --------------
test_sweep_never_deletes_its_own_directory() {
  local repo tsc sid=t12
  local marketdir="$TMPROOT/vibe-ops-testmarket"   # name deliberately matches the sweep's -name glob
  mkdir -p "$marketdir"
  repo=$(new_repo repo-t12)
  write_plan_template "$repo" '<!-- Status lifecycle: Backlog → In Progress → Shipped. -->' \
    '## Progress
## Surprises & Discoveries
## Decision Log
## Outcomes & Retrospective'
  write_plan "$repo" 001 "In Progress"

  tsc="$TMPROOT/t12.jsonl"
  printf '{"seed":true}\n' >"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$marketdir" >/dev/null

  # Age the directory itself past the sweep's +7 day threshold.
  touch -t "$(date -v-10d +%Y%m%d%H%M 2>/dev/null || date -d '-10 days' +%Y%m%d%H%M)" "$marketdir" 2>/dev/null || true

  : >"$repo/README.md"
  transcript_line "$repo/README.md" >>"$tsc"
  hook_call "$(stop_payload "$sid" "$tsc")" "$marketdir" >/dev/null

  if [[ -d "$marketdir" ]]; then
    ok "the sweep never selects its own state directory, even when its name matches vibe-ops-*"
  else
    fail "the state directory itself was removed by the sweep — data-loss regression"
  fi
}

test_different_taxonomy_enumerates_its_own_sections
test_no_end_marker_points_at_template_not_sections
test_unknown_taxonomy_is_silent
test_detection_tolerant_of_spacing
test_stale_hardcoded_word_is_not_matched
test_first_stop_is_silent
test_writing_the_plan_itself_is_silent
test_already_nudged_suppressed_once
test_second_repo_gets_its_own_later_turn
test_malformed_payloads_are_silent
test_no_write_turn_is_free
test_sweep_never_deletes_its_own_directory

if [[ $FAILURES -gt 0 ]]; then
  echo "test-plan-progress-nudge: $FAILURES assertion(s) failed"
  exit 1
fi
echo "test-plan-progress-nudge: all assertions passed"
exit 0
