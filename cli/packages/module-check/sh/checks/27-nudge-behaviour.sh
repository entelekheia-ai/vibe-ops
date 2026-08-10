#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# The plan-progress nudge is the one hook whose defects are invisible from its own output: it fires
# correctly, says something true, and is still wrong — because what makes it wrong is what it said
# LAST time. Plan-006 verified it with ten payload cases run by hand and never automated any of them,
# so the two memory defects Plan-008 fixes shipped in 0.8.0 and were found months later by reading a
# state file. This fragment is that missing automation.
#
# Five assertions, and every one of them was run against the 0.8.0 hook before being written down —
# all five fail there, each on a different defect. An assertion nobody has seen fail is a guess:
#
#   1. One plan per firing (0.8.0 named three), and it is the most recently modified one.
#   2. The plan the turn just wrote is not named in the same firing.
#   3. Nor a turn later. This step deliberately stays inside one repository, so only the compliance
#      defect can explain it — 0.8.0 skipped a written plan with a bare `continue` placed before the
#      memo was repopulated, which is how obeying the nudge is what re-armed it.
#   4. A turn spent only in a sibling repository is nudged about that repository, not the other.
#   5. And coming back from that detour, everything already settled stays settled — 0.8.0 rebuilt the
#      set from the repositories the turn touched, so working elsewhere erased it for everywhere else.
#
# The firing log is checked too, because the silence Plan-008 introduces is only acceptable while the
# firing remains recoverable from disk. A log that stopped being written would restore the old cost
# without restoring the old visibility.
#
# Fixtures, not the real repository: the hook resolves each repo's own plan taxonomy, so a fixture
# with a known template and known modification times is the only way to assert WHICH plan gets named
# rather than merely that one did. Everything is built under the run's temporary directory — the
# repository being checked stays read-only, as it must for every fragment here.

# The fixture path is resolved with `pwd -P` before anything is written into it. On macOS TMPDIR is
# reached through a symlink (/var -> /private/var), and `git rev-parse --show-toplevel` answers with
# the physical path while a transcript records the logical one. The hook compares those two strings
# to decide whether the turn wrote the plan file itself, so an unresolved fixture path would make
# assertion 2 pass for the wrong reason — the paths would simply never match.

_nudge_fixture() { # $1 = fixture root, $2 = repo root under $ROOT's scripts
  local repo="$1/$2" n
  mkdir -p "$repo/project/plans" "$repo/project/templates"
  git -C "$repo" init -q 2>/dev/null
  {
    printf '# Plan-NNN: Title\n\n| Field | Value |\n|---|---|\n| Status | Backlog |\n\n'
    # The arrow is U+2192, not "->": resolve-governance.sh derives the active status word by splitting
    # the lifecycle comment on it, and an ASCII fixture yields the whole line as PLAN_ACTIVE, which
    # then matches no status row at all. The failure looks exactly like the hook staying silent.
    printf '<!-- Status lifecycle: Backlog \342\206\222 In Progress \342\206\222 Shipped. -->\n\n## Summary\n\n'
    printf '<!-- ===== LIVING SECTIONS ===== -->\n\n'
    printf '## Progress\n\n## Surprises & Discoveries\n\n## Decision Log\n\n'
    printf '## Outcomes & Retrospective\n\n'
    printf '<!-- ===== END LIVING SECTIONS ===== -->\n'
  } > "$repo/project/templates/plan.md"
  for n in 001 002 003; do
    printf '# Plan-%s\n\n| Field | Value |\n|---|---|\n| Status | In Progress |\n\n## Progress\n' \
      "$n" > "$repo/project/plans/$n-thing.md"
  done
  # Distinct, pinned modification times. Created in a loop they would share a second, and `ls -t`
  # breaks that tie in an unspecified order — which would make "the newest plan is named" an
  # assertion about the filesystem's mood.
  touch -t 202601010000 "$repo/project/plans/001-thing.md"
  touch -t 202601020000 "$repo/project/plans/002-thing.md"
  touch -t 202601030000 "$repo/project/plans/003-thing.md"
  printf 'x\n' > "$repo/code.txt"
}

_nudge_wrote() { # $1 = fixture root, $2 = file path the turn wrote — appended as one assistant turn
  printf '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"%s"}}]}}\n' \
    "$2" >> "$1/transcript.jsonl"
}

_nudge_fire() { # $1 = fixture root, $2 = session id — prints whatever the hook returned
  printf '{"session_id":"%s","transcript_path":"%s/transcript.jsonl","stop_hook_active":false}' \
    "$2" "$1" \
  | CLAUDE_PLUGIN_ROOT="$NUDGE_HOOK_ROOT" CLAUDE_PLUGIN_DATA="$1/state" \
      sh "$NUDGE_HOOK_ROOT/hooks/plan-progress-nudge.sh" 2>/dev/null
}

_nudge_named() { # reads a firing's output on stdin, prints one line per plan it named
  grep -o '/repo2*/project/plans/[0-9][0-9][0-9]-thing\.md' || true
}

check_nudge_behaviour() {
  head_
  local id="nudge-behaviour" hook="$PLUGIN_DIR/hooks/plan-progress-nudge.sh"
  local fx out named problems=0

  if [ ! -f "$hook" ]; then
    skip "$id" "no hooks/plan-progress-nudge.sh — this repository does not ship the plan-progress nudge"
    return
  fi
  if [ ! -f "$PLUGIN_DIR/scripts/resolve-governance.sh" ] || [ ! -f "$PLUGIN_DIR/scripts/session-touched-repos.sh" ]; then
    skip "$id" "the hook's runtime scripts are absent from this tree — there is nothing to exercise it against"
    return
  fi
  if ! command -v git >/dev/null 2>&1; then
    skip "$id" "git is not on PATH — the fixture repositories cannot be created"
    return
  fi

  make_workdir
  # The hook is run with CLAUDE_PLUGIN_ROOT pointing here, so it must be the directory an *installed*
  # plugin would present — $PLUGIN_DIR, not the repository root. They stopped being the same thing when
  # the CLI was split out and the plugin moved under plugin/.
  NUDGE_HOOK_ROOT="$PLUGIN_DIR"
  fx="$(cd "$WORKDIR" && pwd -P)/nudge"
  mkdir -p "$fx/state"
  : > "$fx/transcript.jsonl"
  _nudge_fixture "$fx" repo
  _nudge_fixture "$fx" repo2

  # The first Stop of a session seeds the byte offset and says nothing by design, so the transcript
  # has to be empty for it — otherwise the whole file counts as "this turn".
  out=$(_nudge_fire "$fx" NUDGEFIX)
  if [ -n "$out" ]; then
    fail "$id" "the first Stop of a session spoke; it must only seed the transcript offset"
    problems=$((problems + 1))
  fi

  # Firing 1 — a turn that wrote code in repo. Three plans are eligible; one may be named, the newest.
  _nudge_wrote "$fx" "$fx/repo/code.txt"
  named=$(_nudge_fire "$fx" NUDGEFIX | _nudge_named)
  if [ "$(printf '%s\n' "$named" | grep -c .)" -ne 1 ]; then
    fail "$id" "a firing named $(printf '%s\n' "$named" | grep -c .) plans; at most one may be named per firing"
    problems=$((problems + 1))
  fi
  if [ "$named" != "/repo/project/plans/003-thing.md" ]; then
    fail "$id" "the firing named ${named:-nothing} rather than the most recently modified plan"
    problems=$((problems + 1))
  fi

  # Firing 2 — the turn wrote the plan it was just asked about. It must not come back.
  _nudge_wrote "$fx" "$fx/repo/project/plans/003-thing.md"
  named=$(_nudge_fire "$fx" NUDGEFIX | _nudge_named)
  case "$named" in
    */003-thing.md)
      fail "$id" "the plan the turn had just written was named again in the same firing"
      problems=$((problems + 1)) ;;
  esac

  # Firing 3 — an ordinary turn in the same repository, immediately after. This is where compliance
  # used to be punished, and the step is deliberately kept inside one repository so that only the
  # compliance defect can explain a failure here: nothing has erased the memo except obeying it.
  _nudge_wrote "$fx" "$fx/repo/code.txt"
  named=$(_nudge_fire "$fx" NUDGEFIX | _nudge_named)
  case "$named" in
    */003-thing.md)
      fail "$id" "a plan written after being named was named again a turn later — complying re-arms the nudge"
      problems=$((problems + 1)) ;;
  esac

  # Firing 4 — the turn wrote only in the sibling repository. Whatever it names must come from there.
  _nudge_wrote "$fx" "$fx/repo2/code.txt"
  named=$(_nudge_fire "$fx" NUDGEFIX | _nudge_named)
  case "$named" in
    /repo/*)
      fail "$id" "a turn that wrote only in a sibling repository was nudged about the other one"
      problems=$((problems + 1)) ;;
  esac

  # Firing 5 — back in repo, where every plan has now been named or written. The memo must have
  # survived the detour, so the correct output is nothing at all. This is the half of the defect a
  # single-repository fixture cannot see: the set used to be rebuilt from the repositories the turn
  # touched, so a detour erased everything known about the ones it did not.
  _nudge_wrote "$fx" "$fx/repo/code.txt"
  named=$(_nudge_fire "$fx" NUDGEFIX | _nudge_named)
  if [ -n "$named" ]; then
    fail "$id" "after a turn spent in another repository, plans already settled this session were named again"
    problems=$((problems + 1))
  fi

  # Every firing that spoke must have left a line behind, or the silence Plan-008 introduces would be
  # unauditable — which is the whole reason the silence was acceptable.
  local logged
  logged=$(cat "$fx"/state/vibe-ops-nudge-log-*.tsv 2>/dev/null | grep -c . || true)
  if [ "${logged:-0}" -lt 4 ]; then
    fail "$id" "the firing log holds ${logged:-0} lines; every firing that named a plan must append one"
    problems=$((problems + 1))
  elif [ "$(awk -F'\t' 'NF != 4' "$fx"/state/vibe-ops-nudge-log-*.tsv 2>/dev/null | grep -c .)" -ne 0 ]; then
    fail "$id" "the firing log has a line that is not four tab-separated fields (when, session, plan, mtime)"
    problems=$((problems + 1))
  fi

  [ "$problems" -eq 0 ] && pass "$id" \
    "the nudge names at most one plan per firing, newest first, and never re-names one the session already wrote or was already asked about"
}
