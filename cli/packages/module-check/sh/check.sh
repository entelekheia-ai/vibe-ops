#!/usr/bin/env bash
# check.sh — the canonical way to run this repository's own governance gate by hand.
#
# vibe-ops is not a *consumer* of the harness apparatus the way every other repository under this
# workspace root is — this repository IS the built-ins. Its own checks/ holds the real seventeen
# fragments, not an extra directory composed on top of a gate living elsewhere, so this script runs
# `vibe-ops check` against this repository with no VIBE_OPS_CHECK_DIRS to compose. Plan-020 Track 3.
#
# It stopped invoking check-agents-md.sh by path in Plan-038 Track 5, with every other gate under this
# workspace root: the CLI is what composes the checks, so the CLI is what a gate calls — here too,
# rather than this repository keeping a shorter path to the same checks that nobody else may take.
# `vibe-ops` resolves from PATH; see cli/README.md for the install recipe.
#
# GATE_VERBOSE=1 prints the full run; otherwise a clean run prints only its summary line and a failing
# one prints only what failed or warned — see the runner's own header for why.
set -uo pipefail

SELF_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$(git -C "$SELF_DIR" rev-parse --show-toplevel)

if ! command -v vibe-ops >/dev/null 2>&1; then
  echo "check.sh: no \`vibe-ops\` on PATH — the gate cannot run." >&2
  echo "  npm i -g @entelekheia/vibe-ops-cli      # the published CLI" >&2
  echo "  npm link -w @entelekheia/vibe-ops-cli   # or this checkout's own build, to work on it" >&2
  exit 2
fi

OUT=$(vibe-ops check --verbose "$ROOT" 2>&1)
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
