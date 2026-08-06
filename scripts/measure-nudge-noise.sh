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
# measure-nudge-noise.sh — what the plan-progress nudge actually cost, read from session transcripts.
#
# This exists because the firing log the hook writes cannot answer the question the hook was changed
# to fix. The log records what the HOOK did; it has no access to the model's output, so it cannot tell
# a refusal delivered in silence from a refusal delivered as three paragraphs — which is the single
# quantity Plan-008 is driving to zero. That is only visible here.
#
# It is a development instrument, not shipped behaviour: it may require jq outright, unlike the hooks,
# which must degrade when jq is absent.
#
# Usage:
#   measure-nudge-noise.sh [transcript-dir]   # default: this working tree's own project directory
#   measure-nudge-noise.sh --since 2026-08-07 # only firings at or after a date (the release boundary)
#   measure-nudge-noise.sh --until 2026-08-07 # only firings before it — how to re-read an old window
#
# `--until` is what makes a before/after comparison honest. Transcripts accumulate, so a bare run
# measures a window that keeps growing and silently mixes the new behaviour into the old baseline.
# Bound both ends and the same command answers the same question twice.
#
# THE INPUT SET IS PINNED AND PRINTED, and that is the point rather than a courtesy. The first version
# of this measurement scanned "the ten most recently modified transcripts" and reported 22 firings; the
# same code minutes later reported 42, because the files were being appended to while it ran. Nothing
# failed and nothing was swallowed — the window moved. Every individual run looked clean, and the wrong
# answer was the reassuring one. Run it twice: a number that changes between two identical runs is
# measuring the clock.
#
# Exit codes: 0 measured · 2 bad usage or no transcripts found.

set -uo pipefail

SINCE=""
UNTIL=""
DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --since) SINCE="${2:-}"; shift 2 ;;
    --until) UNTIL="${2:-}"; shift 2 ;;
    -h | --help) sed -n '21,31p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) DIR="$1"; shift ;;
  esac
done

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 2; }

# Claude Code files a project's transcripts under a directory named after the working tree, with every
# character that is not a letter or a digit replaced by a hyphen. Derived, never written down: this
# script ships publicly and a hard-coded path would carry someone's home directory with it.
if [ -z "$DIR" ]; then
  root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  DIR="$HOME/.claude/projects/$(printf '%s' "$root" | sed 's/[^A-Za-z0-9]/-/g')"
fi

[ -d "$DIR" ] || { echo "no transcript directory at $DIR" >&2; exit 2; }

files=("$DIR"/*.jsonl)
[ -e "${files[0]}" ] || { echo "no .jsonl transcripts in $DIR" >&2; exit 2; }

printf 'input set: %d transcripts in %s\n' "${#files[@]}" "$DIR"
[ -n "$SINCE" ] && printf 'restricted to firings at or after %s\n' "$SINCE"
[ -n "$UNTIL" ] && printf 'restricted to firings before %s\n' "$UNTIL"
printf '\n'

# One pass per file, emitting one object per firing. A firing owns every assistant turn that follows it
# until the next real user prompt or the next firing, whichever comes first.
#
# Deduplicated by timestamp afterwards, across files rather than within one: resuming a session copies
# its history into a new transcript, so the same firing is present in every file descended from it.
per_file='
# `.attachment.content` is a string for some hook events and an array of blocks for others, and jq
# refuses `test` on the array rather than returning false — so every record must be flattened before
# it is matched, not just the ones this measurement cares about.
def content: (.attachment.content // "") | if type == "string" then . else tostring end;

def firing: .type == "attachment"
  and (.attachment.type // "") == "hook_additional_context"
  and (content | test("living sections were not part of that write"));

# A real prompt from the person, not a tool result wearing the same type.
def prompt: .type == "user" and (.isMeta != true) and (
    ((.message.content | type) == "string")
    or (((.message.content | type) == "array")
        and ([.message.content[]? | select(.type == "tool_result")] | length == 0)));

[ .[]
  | if firing then
      { k: "fire", ts: .timestamp,
        # Every .md path the message names, kept only when it looks like a plan. The message quotes one
        # path per plan it asks about, so this is also how many plans a firing named.
        plans: [ content | scan("[^ \n\"]+\\.md") ] | map(select(test("plan"))) | unique }
    elif prompt then { k: "user" }
    elif .type == "assistant" then
      { k: "asst",
        out: (.message.usage.output_tokens // 0),
        tools: [ .message.content[]? | select(.type == "tool_use") ],
        text: ([ .message.content[]? | select(.type == "text") | .text ] | join("") | gsub("\\s"; "") | length) }
    else { k: "skip" } end ]
| map(select(.k != "skip"))
| reduce .[] as $e ({ cur: null, out: [] };
    if $e.k == "fire" then
      (if .cur != null then .out += [.cur] else . end)
      | .cur = { ts: $e.ts, plans: $e.plans, turns: 0, tools: 0, tokens: 0, text: 0, written: [] }
    elif $e.k == "user" then
      (if .cur != null then .out += [.cur] | .cur = null else . end)
    elif .cur != null then
      .cur.turns += 1
      | .cur.tokens += $e.out
      | .cur.tools += ($e.tools | length)
      | .cur.text += $e.text
      | .cur.written += [ $e.tools[]
          | select(.name == "Edit" or .name == "Write" or .name == "NotebookEdit")
          | (.input.file_path // .input.notebook_path // empty) ]
    else . end)
| (if .cur != null then .out + [.cur] else .out end)
| .[]
'

summary='
  unique_by(.ts)
| map(. + {
    # Two different questions, deliberately counted apart. "Answered" means an entry went into one of
    # the plans this firing actually named. "Recorded" is looser: an entry went into some plan file,
    # possibly a different plan, in a different repository. The gap between them is not noise — it is
    # the hook naming the plans of the repository that was written while the lesson belonged
    # elsewhere, a limit Plan-006 accepted and Plan-008 observed a second time. A measurement that
    # folded the two together would count that case as a failure and could never reach zero.
    answered: (((.plans - (.plans - .written)) | length) > 0),
    recorded: ((.written | map(select(test("[Pp]lans?/") and endswith(".md"))) | length) > 0),
    spoke: (.text > 0) })
| (map(select(.spoke and (.recorded | not)))) as $noise
| { firings: length,
    plans_mean: (if length == 0 then 0 else ((map(.plans | length) | add) / length) end),
    plans_max: (if length == 0 then 0 else (map(.plans | length) | max) end),
    turns: (map(.turns) | add // 0),
    tools: (map(.tools) | add // 0),
    tokens: (map(.tokens) | add // 0),
    answered: (map(select(.answered)) | length),
    recorded: (map(select(.recorded)) | length),
    silent: (map(select(.spoke | not)) | length),
    noise: ($noise | length),
    noise_tokens: ($noise | map(.tokens) | add // 0),
    tools_on_noise: (if ($noise | length) == 0 then 0 else (($noise | map(.tools) | add // 0) / ($noise | length)) end),
    tools_on_useful: ((map(select(.recorded))) as $u
      | if ($u | length) == 0 then 0 else (($u | map(.tools) | add // 0) / ($u | length)) end),
    repeats: ([ .[] | .plans[] ] | group_by(.) | map(select(length > 1) | length) | max // 0) }
'

# One `jq -s` per file, never one over all of them: slurping the whole set into a single array would
# concatenate unrelated sessions end to end, and a firing at the tail of one file would adopt the turns
# at the head of the next. stderr is deliberately not discarded — a jq program that stops matching
# reports zero firings, which reads exactly like a hook that has been fixed.
for f in "${files[@]}"; do
  jq -s -c "$per_file" "$f"
done \
| jq -s --arg since "$SINCE" --arg until "$UNTIL" '
    map(select(($since == "" or (.ts >= $since)) and ($until == "" or (.ts < $until))))
  | '"$summary"'
  | to_entries[] | "\(.key)\t\(.value)"' -r \
| awk -F'\t' '
  BEGIN {
    label["firings"]        = "Firings"
    label["plans_mean"]     = "Plans named per firing (mean)"
    label["plans_max"]      = "Plans named per firing (max)"
    label["turns"]          = "Assistant turns caused"
    label["tools"]          = "Tool calls caused"
    label["tokens"]         = "Output tokens caused"
    label["answered"]       = "Firings answered in a plan they named"
    label["recorded"]       = "Firings that wrote some plan entry"
    label["silent"]         = "Firings that were fully silent"
    label["noise"]          = "Firings with visible text and no entry"
    label["noise_tokens"]   = "Output tokens spent on those"
    label["tools_on_noise"] = "Tool calls per firing, on the noisy ones"
    label["tools_on_useful"]= "Tool calls per firing, on the useful ones"
    label["repeats"]        = "Times the worst-affected plan was named"
  }
  { v = $2; if (v ~ /\./) v = sprintf("%.1f", v)
    printf "%-42s %s\n", label[$1], v }'
