#!/usr/bin/env bash
# check.sh — the canonical way to run this repository's own governance gate by hand.
#
# vibe-ops is not a *consumer* of the harness apparatus the way every other repository under this
# workspace root is — this repository IS the built-ins. Its own cli/sh/checks/ holds the real
# seventeen fragments, not an extra directory composed on top of a runner living elsewhere, so this
# script calls cli/sh/check-agents-md.sh directly against this repository ("."), with no
# VIBE_OPS_CHECK_DIRS and no sibling resolution. Plan-020 Track 3.
#
# GATE_VERBOSE=1 prints the full run; otherwise a clean run prints only its summary line and a failing
# one prints only what failed or warned — see the runner's own header for why.
set -uo pipefail

SELF_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(git -C "$SELF_DIR" rev-parse --show-toplevel)

OUT=$("$SELF_DIR/check-agents-md.sh" "$ROOT" 2>&1)
RC=$?

if [ "${GATE_VERBOSE:-}" = "1" ]; then
  printf '%s\n' "$OUT"
  exit "$RC"
fi

if [ "$RC" -ne 0 ]; then
  printf '%s\n' "$OUT" | grep -E '^(FAIL|WARN) ' || printf '%s\n' "$OUT"
  exit "$RC"
fi

printf '%s\n' "$OUT" | grep -E '^WARN ' || true
printf '%s\n' "$OUT" | grep -E '^[0-9]+ checks, [0-9]+ failed'
exit 0
