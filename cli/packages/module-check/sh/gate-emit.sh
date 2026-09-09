#!/bin/sh
# vibe-ops — turn one tool's diagnostics into the neutral gate artifact.
#
# usage, from a check fragment, AFTER the tool's own pass/fail run has already happened:
#
#   rumdl check . --no-cache --output-format json \
#     | sh gate-emit.sh --producer markdown --tool "rumdl@0.2.51" \
#         --unit file --examined 143 --moment attempt > "$GATE_ARTIFACT_DIR/markdown.jsonl"
#
# Output is JSONL: one header line naming the producer, the tool, the moment and the population
# actually examined, then one finding line per rule, sorted by rule id.
#
#   {"kind":"gate","producer":"markdown","tool":"rumdl@0.2.51","moment":"attempt", … }
#   {"kind":"finding","rule":"MD051","count":2}
#
# NOTHING HERE NAMES A MEANING. Not an observation, not a dialect, not a failure category — this
# script only knows what the tool reported and what its caller says it examined. The mapping from a
# rule id to what it is evidence of belongs to a translator on the receiving side, versioned there,
# in a repository that has a reason to know that vocabulary. See `vibe-ops harness policy --name pair --print`.
#
# WHY THIS RUNS HERE AND NOT AT THE DESTINATION. It captures the two things only the producing side
# can know. `--examined` is supplied by the caller and never derived: a linter reports diagnostics and
# generally does not report how many inputs it examined, so nothing downstream can recover a
# denominator nobody captured. And `--moment attempt` is knowable only where the attempt happens — a
# blocked commit never reaches anything that fires afterwards, and that reading is the data point, not
# a missing one.
#
# ZERO EXAMINED IS NOT A READING. A population of 0 writes nothing at all and exits clean: a record of
# nothing examined is indistinguishable from a record of nothing wrong. Zero *findings* over a
# non-empty population is a perfectly good reading and is written.
#
# jq REQUIRED, AND ABSENT IS SILENT — never a best-effort parse. Linter diagnostics are untrusted
# multi-line text that can carry quotes, backslashes and braces; hand-parsing them with sed is the one
# shortcut hooks/plan-approved-copy.sh already refuses for the same reason, and a mis-parse here
# fabricates a count rather than failing. jq is this plugin's established optional dependency and its
# absence is handled the same way everywhere: emit nothing, exit 0. A missing artifact is a missing
# reading; a wrong one is worse than none.
#
# Exit codes: 0 wrote an artifact, or deliberately wrote nothing (jq absent, population <= 0)
#             1 stdin was not valid JSON — refuse rather than emit a reading built on unread data
#             2 bad usage
set -u

PRODUCER=""
TOOL=""
UNIT=""
EXAMINED=""
MOMENT="attempt"

usage() {
  printf 'usage: gate-emit.sh --producer <id> --tool <name@version> --unit <what> --examined <n> [--moment <m>]\n' >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --producer) PRODUCER=${2:-}; shift 2 || usage ;;
    --tool)     TOOL=${2:-};     shift 2 || usage ;;
    --unit)     UNIT=${2:-};     shift 2 || usage ;;
    --examined) EXAMINED=${2:-}; shift 2 || usage ;;
    --moment)   MOMENT=${2:-};   shift 2 || usage ;;
    *) printf 'gate-emit: unknown option %s\n' "$1" >&2; usage ;;
  esac
done

[ -n "$PRODUCER" ] && [ -n "$TOOL" ] && [ -n "$UNIT" ] && [ -n "$EXAMINED" ] || usage

# An --examined that is not a number is a caller bug, not a population of zero. Saying so is the
# difference between "this run examined nothing" and "this run cannot describe what it examined".
case "$EXAMINED" in
  '' | *[!0-9-]* | '-') printf 'gate-emit: --examined must be an integer, got %s\n' "$EXAMINED" >&2; usage ;;
esac

[ "$EXAMINED" -gt 0 ] 2>/dev/null || exit 0

command -v jq >/dev/null 2>&1 || exit 0

RAW=$(cat)
[ -n "$RAW" ] || RAW='[]'

if ! printf '%s' "$RAW" | jq -e 'type == "array"' >/dev/null 2>&1; then
  printf 'gate-emit: stdin was not a JSON array of diagnostics; refusing to emit\n' >&2
  exit 1
fi

# `date -u` at second precision: BSD date has no %N, and the plugin must behave identically on a
# stock macOS and on Linux. The consumer strips colons out of this to build a spool filename and
# pairs it with a pid for uniqueness, so sub-second resolution buys nothing here.
PRODUCED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Field order matches the reading side's expectations and is written explicitly rather than left to a
# serializer's whim. jq does the escaping, which is the whole reason it is required.
jq -nc \
  --arg producer "$PRODUCER" \
  --arg tool "$TOOL" \
  --arg moment "$MOMENT" \
  --arg producedAt "$PRODUCED_AT" \
  --arg unit "$UNIT" \
  --argjson examined "$EXAMINED" \
  '{kind:"gate",producer:$producer,tool:$tool,moment:$moment,producedAt:$producedAt,
    population:{unit:$unit,examined:$examined}}'

# A diagnostic with no `rule` contributes nothing rather than a null bucket — the same silent skip the
# Python emitter this mirrors performs, and the reason a tool that reports unruled diagnostics still
# yields a usable artifact instead of one finding line named `null`.
printf '%s' "$RAW" | jq -c '
  [ .[] | .rule // empty ]
  | group_by(.)
  | map({kind:"finding", rule:.[0], count:length})
  | .[]
'
