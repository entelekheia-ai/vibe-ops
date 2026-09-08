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
# itself. The original is cli/sh/ in https://github.com/entelekheia-ai/vibe-ops — refresh by copying
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
#   VIBE_OPS_PRIVATE_LAYER    set in the one repository that IS the private layer — the place named
#                             paths belong. Makes machine-paths report SKIP rather than pass; every
#                             other repository keeps it active, whether or not it has a remote yet
#   VIBE_OPS_CHECK_DIRS       colon-separated extra fragment directories, composed after the built-ins
#   VIBE_OPS_DISABLED_CHECKS  newline-separated "id:reason" pairs. A composed check whose id appears
#                             here is never run; it reports SKIP naming the reason instead of running,
#                             so the disablement is a ledger entry rather than a silent pass — set from
#                             a repository's own scripts/checks/_run.sh, never a plugin default.
#                             `vibe-ops check` also sets it from settings.check.disabled and appends
#                             after whatever is already here, so a declaration made at the point of
#                             invocation still wins: the first line carrying an id is the one matched
#
# Exit codes: 0 all checks passed · 1 at least one check failed · 2 bad usage.

set -uo pipefail

# A git hook hands its child the committing repository: in a linked worktree that is an ABSOLUTE
# GIT_DIR and GIT_INDEX_FILE, exported. Every fragment that builds a fixture repository and runs git
# inside it would then read the committing repository instead — measured 2026-09-03, where
# nudge-behaviour failed under pre-commit in a worktree and passed everywhere else. The root this
# script checks arrives as an argument or is derived from the working directory, never from these.
unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE GIT_PREFIX

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
# head_, norm_rel, tracked_md, $ROOT and $PLUGIN_DIR; it must not write anything into $ROOT.
#
# It must also set CHECK_VERSION, an integer that moves only when a consumer of this check's output has
# to handle it differently — the same rule and the same axis as `version` on a GateDefinition, which
# `defineGate` likewise refuses to construct without. Two readings recorded under one check id are only
# comparable while that number has not moved, so a fragment that declares nothing makes every reading it
# ever produced unattributable. The variable is reset before each source and demanded after: a fragment
# that forgot would otherwise silently inherit the previous fragment's number, which is worse than the
# omission because it looks like an answer.

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
COMPOSED_VER=()

compose_checks() {
  local dirs="$HOME_ROOT/sh/checks${VIBE_OPS_CHECK_DIRS:+:$VIBE_OPS_CHECK_DIRS}"
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
      # Cleared before the source, demanded after: a sourced fragment leaves its globals behind, so an
      # undeclared one would inherit its predecessor's number and report a version nobody wrote.
      CHECK_VERSION=""
      # shellcheck disable=SC1090
      . "$frag" || { echo "cannot source fragment: $frag" >&2; exit 2; }
      if ! command -v "$fn" >/dev/null 2>&1; then
        echo "fragment $frag defines no $fn()" >&2
        exit 2
      fi
      # MINE MUST DECLARE; YOURS IS REPORTED. A fragment shipped with this runner is refused without a
      # version — it is authored here and there is no reason for it to be missing. A fragment CONTRIBUTED
      # by the repository being checked (VIBE_OPS_CHECK_DIRS) reads `unknown` and still runs: this runner
      # is resolved live by every repository under one checkout, so refusing would take eight commit gates
      # red at once for a declaration none of them agreed to make, which is how a gate gets switched off
      # within the week. Unknown is never silently a number — it is printed as `<id>@unknown` in --list and
      # travels as such — which is the same rule the record side follows: report it, never default it.
      case "$CHECK_VERSION" in
        ''|*[!0-9]*)
          if [ "$dir" = "$HOME_ROOT/sh/checks" ]; then
            echo "fragment $frag declares no integer CHECK_VERSION" >&2
            exit 2
          fi
          CHECK_VERSION="unknown"
          ;;
      esac
      COMPOSED_IDS+=("$id")
      COMPOSED_SRC+=("$frag")
      COMPOSED_VER+=("$CHECK_VERSION")
    done
  done
  if [ "${#COMPOSED_IDS[@]}" -eq 0 ]; then
    echo "no checks composed — expected fragments in $HOME_ROOT/sh/checks" >&2
    exit 2
  fi
}

report_composition() {
  local i src
  printf 'composed %d checks:\n' "${#COMPOSED_IDS[@]}"
  for i in "${!COMPOSED_IDS[@]}"; do
    src="${COMPOSED_SRC[$i]}"
    # `<id>@<version>`, the same token the emitted record's instrument field carries and the same one
    # `fragment-parity` reads back to say which two things a parity result compared.
    printf '  %-18s %s\n' "${COMPOSED_IDS[$i]}@${COMPOSED_VER[$i]}" "${src#"$HOME_ROOT"/}"
  done
  printf '\n'
}

# A declared disablement is a ledger entry, never a silent pass. VIBE_OPS_DISABLED_CHECKS is
# newline-separated `id:reason` pairs — one check id per line, colon-separated from why it is off, set
# from a repository's own scripts/checks/_run.sh the same way VIBE_OPS_PRIVATE_LAYER already is (never
# from the plugin's own defaults). Newline rather than a comma list: a reason is prose and may contain
# commas, and a repository declaring several checks off reads as a small table this way. `disabled_id`
# is matched on the whole line up to the first colon, so a reason itself may still contain one.
disabled_reason_for() { # $1 = check id; prints the reason, or nothing if not declared off
  local id="$1" entry eid
  [ -n "${VIBE_OPS_DISABLED_CHECKS:-}" ] || return 0
  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    eid="${entry%%:*}"
    if [ "$eid" = "$id" ]; then
      printf '%s' "${entry#*:}"
      return 0
    fi
  done <<EOF
$VIBE_OPS_DISABLED_CHECKS
EOF
}

run_checks() {
  local id reason
  for id in "${COMPOSED_IDS[@]}"; do
    reason=$(disabled_reason_for "$id")
    if [ -n "$reason" ]; then
      # head_ + skip, not a bare `continue`: a declared-off check still counts as composed and run,
      # the same way a check that skips from inside its own fragment (machine-paths in the private
      # layer) does — the summary line's count must not quietly shrink because of a declaration.
      head_
      skip "$id" "declared off: $reason"
    else
      "check_${id//-/_}"
    fi
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

# --- fixture -------------------------------------------------------------------------------------
# The one deliberately-broken repository both this script's own --self-test and the TypeScript side's
# `check --self-test` assert against (plan-038 track 3) — built once, here, so there is exactly one
# definition of "broken" rather than two that can drift apart without either side noticing.

# build_fixture <dir> — populate an already-`git init`-ed directory with a repository broken the same
# five ways this script's own header describes, and `git add -A` it. Callers own the temp directory's
# lifetime (creation and cleanup); this only writes into it.
build_fixture() {
  local tmp="$1"
  mkdir -p "$tmp/.agents/rules" "$tmp/.claude/rules"
  # over budget, a link that does not resolve, one that climbs out of the repo, a memory slug
  { yes 'padding line' | head -n 200; } > "$tmp/AGENTS.md"
  {
    echo '- [gone](docs/does-not-exist.md)'
    echo '- [escape](../../etc/passwd)'
    echo '- [memory](x) see [[project_something]]'
    echo '- run `${CLAUDE_PLUGIN_ROOT}/scripts/does-not-ship.sh` — a path in a command, not a link'
    echo '- built from `/Users/somebody/checkouts/thing` — a home directory in a committed document'
    # a ${CLAUDE_PLUGIN_ROOT}/../ climb (plan-009) — unreachable from any install even though it
    # resolves in this fixture's own tree, beside one marked allow that must NOT fire
    echo '- run `${CLAUDE_PLUGIN_ROOT}/../cli/ghost.sh` — climbs out of the plugin root'
    echo '- run `${CLAUDE_PLUGIN_ROOT}/../cli/shipped.sh` — plugin-root-paths: allow'
  } >> "$tmp/AGENTS.md"
  # `[[...]]` shapes that are NOT memory links, beside one that is. A fixture with only the real slug
  # would pass whether or not the check distinguishes them, so the two decoys are what give the assertion
  # below its meaning: exactly one hit, and it is the one on the un-fenced, un-quoted line.
  {
    echo '# decoys'
    echo '```toml'
    echo '[[language]]'
    echo 'name = "description"'
    echo '```'
    echo 'inline `[[also_not_a_link]]` quoted as code'
    echo 'the elided forms `/Users/…/thing` and `/Users/.../thing`, which describe the rule'
  } > "$tmp/decoys.md"
  printf -- '---\npaths: ["x/**"]\n---\n\nno description above.\n' > "$tmp/.agents/rules/nodesc.md"
  printf 'not a symlink\n' > "$tmp/.claude/rules/nodesc.md"
  # a shipped template attributing a real person, in a repository that is not theirs
  mkdir -p "$tmp/skills/demo/templates"
  printf '<!--\n Copyright (c) 2026 Some Person (https://example.invalid)\n-->\n\n# demo\n' \
    > "$tmp/skills/demo/templates/demo.md"
  # a broken /vibe-ops:<name> reference, on the one live surface that check exists to cover
  printf '# demo\n\nUse `/vibe-ops:ghost` for this.\n' > "$tmp/skills/demo/SKILL.md"
  printf 'See /vibe-ops:ghost in the README.\n' > "$tmp/README.md"
  # two manifests that disagree with each other on version, description and keywords
  mkdir -p "$tmp/.claude-plugin"
  printf '{"name":"fixture","version":"1.0.0","description":"A","keywords":["a","b"]}\n' \
    > "$tmp/.claude-plugin/plugin.json"
  printf '{"plugins":[{"name":"fixture","version":"1.0.1","description":"B","keywords":["a"]}]}\n' \
    > "$tmp/.claude-plugin/marketplace.json"
  # a hook that is registered but does not exist, and one that exists but is not registered, plus a
  # description whose literal count is wrong either way
  mkdir -p "$tmp/hooks"
  printf '{"description":"Five guards.","hooks":{"Stop":[{"hooks":[{"type":"command","command":"sh","args":["${CLAUDE_PLUGIN_ROOT}/hooks/missing.sh"]}]}]}}\n' \
    > "$tmp/hooks/hooks.json"
  : > "$tmp/hooks/orphan.sh"
  # a skill's OWN hooks: frontmatter block (plan-009) — an event that does not exist, so hooks.json
  # existing at all does not accidentally cover this second, unrelated population
  mkdir -p "$tmp/skills/broken-hook"
  printf -- '---\nname: broken-hook\ndescription: fixture\nhooks:\n  NotARealEvent:\n    - matcher: "Write"\n      hooks:\n        - type: command\n          command: vibe-ops\n---\n\nfixture\n' \
    > "$tmp/skills/broken-hook/SKILL.md"
  # a dogfooded pair that has diverged: this repo's own GOVERNANCE.md against its shipped counterpart
  mkdir -p "$tmp/skills/setup/templates/root"
  printf '# Governance\n\nThe real one.\n' > "$tmp/GOVERNANCE.md"
  printf '# Governance\n\nA stale copy.\n' > "$tmp/skills/setup/templates/root/GOVERNANCE.md"
  # a references/records/ that is missing two of the four types /new reads
  mkdir -p "$tmp/references/records"
  printf 'adr rules\n' > "$tmp/references/records/adr.md"
  printf 'plan rules\n' > "$tmp/references/records/plan.md"
  git -C "$tmp" add -A >/dev/null 2>&1
}

# --- self-test ----------------------------------------------------------------------------------
# Acceptance for this script is "fails on a deliberately broken copy and passes on this repository".
# The second half is running it; this is the first half, so the claim is not taken on trust.

self_test() {
  local expected got rc irc before after leftover zero_got disabled_got

  # The fixture must be judged on its own merits, never on the operator's environment. An engineer
  # running this from inside the repository that declares itself the private layer would otherwise
  # inherit VIBE_OPS_PRIVATE_LAYER, machine-paths would skip on the broken fixture, and the assertion
  # below would fail for a reason that has nothing to do with the check. Unset once here rather than
  # per invocation, so an invocation added later inherits the isolation instead of the bug.
  unset VIBE_OPS_PRIVATE_LAYER
  # Same hazard, same fix, second instance: an operator's shell that happens to carry a declared
  # disablement would make the fixture below pass a check it should fail, for a reason that has
  # nothing to do with the check. Cleared once, here, rather than per invocation.
  unset VIBE_OPS_DISABLED_CHECKS
  # Third instance, and the one that actually escaped. Every fragment that emits writes into
  # GATE_ARTIFACT_DIR, and this fixture is DESIGNED to be broken — so inheriting the variable means the
  # fixture's own fabricated findings are spooled into whatever destination the operator set, and from
  # there a drain ingests them as if a real repository had violated the rule. Measured 2026-08-07: a
  # pre-commit in this repository staged a fragment, which ran this self-test with GATE_ARTIFACT_DIR
  # exported by the hook, and the fixture's deliberate machine path reached the production registry as a
  # reading over 9 files — indistinguishable, in the record, from a real violation. Nothing errored and
  # both the self-test and the gate passed.
  unset GATE_ARTIFACT_DIR
  # not local: the EXIT trap runs after this function has returned
  tmp=$(mktemp -d) || exit 2
  denylist=$(mktemp) || exit 2
  fragdir=$(mktemp -d) || exit 2
  # a TMPDIR of its own for the runs under test. Asserting against the shared one would mean asserting
  # that nothing else on the machine wrote a temporary file during those two seconds, which is not true
  # and made this check fail about one run in six.
  runtmp=$(mktemp -d) || exit 2
  # a second, separate fixture: a repository with zero ${CLAUDE_PLUGIN_ROOT}/ references anywhere, to
  # prove plugin-root-paths reports itself skipped rather than vacuously passed when it examined nothing
  zero=$(mktemp -d) || exit 2
  trap 'rm -rf "$tmp" "$denylist" "$fragdir" "$runtmp" "$zero"' EXIT

  git -C "$tmp" init -q
  build_fixture "$tmp"
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
  # The eight that remain. Nine ids left this list in Plan-038 track 7 with the fragments themselves —
  # they had met the retirement bar, and their ports now carry the fixture instead: `check --self-test`'s
  # `ports` phase asserts every one of the nine still FAILS on this very fixture, built through
  # `--emit-fixture`. THE FIXTURE ITSELF IS UNCHANGED and must stay that way: every defect the retired
  # fragments used to catch is still in it, because it is now the ports' evidence rather than theirs.
  for expected in private-names plugin-root-paths manifest-sync hooks-registration \
    references-completeness command-references; do
    if ! printf '%s\n' "$got" | grep -q "FAIL  \[$expected\]"; then
      echo "SELF-TEST FAILED: check '$expected' did not fire on the fixture"
      return 1
    fi
  done
  # The decoy assertions for `memory-slugs` and `machine-paths` left with those fragments (track 7). The
  # decoys they were written about are STILL IN THE FIXTURE, deliberately: the ports that replaced them
  # inherit the same trap, and `gates/test/classification.test.ts` is where that discrimination is now
  # asserted. Deleting the decoys along with the assertions would have quietly weakened the fixture the
  # ports are measured against.
  # plugin-root-paths' climb guard (plan-009) must fire on the unmarked ../ reference and NOT on the
  # one carrying "plugin-root-paths: allow" — the two decoys are what give this assertion its meaning,
  # the same way the memory-slugs and machine-paths decoys above do.
  if ! printf '%s\n' "$got" | grep -q 'plugin-root-paths.*ghost\.sh climbs out'; then
    echo "SELF-TEST FAILED: an unmarked \${CLAUDE_PLUGIN_ROOT}/../ reference did not fire plugin-root-paths"
    return 1
  fi
  if printf '%s\n' "$got" | grep -q 'plugin-root-paths.*shipped\.sh'; then
    echo "SELF-TEST FAILED: a \${CLAUDE_PLUGIN_ROOT}/../ reference marked \"plugin-root-paths: allow\" still fired"
    return 1
  fi
  # hooks-registration must fire on BOTH populations, not only the older hooks.json one — a skill's own
  # hooks: block naming an unknown event is a distinct fixture from the missing-script hooks.json above,
  # and the generic "did hooks-registration fire at all" assertion in the loop cannot tell them apart.
  if ! printf '%s\n' "$got" | grep -q 'hooks-registration.*unknown event'; then
    echo "SELF-TEST FAILED: a skill's hooks: block naming an unknown event did not fire hooks-registration"
    return 1
  fi
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

  # a population of zero ${CLAUDE_PLUGIN_ROOT}/ paths is not the same as thirty verified ones — the
  # check must say so rather than reporting the same "ok" it would print after actually verifying something
  git -C "$zero" init -q
  printf '# fixture\n\nnothing here names a ${CLAUDE_PLUGIN_ROOT} path.\n' > "$zero/AGENTS.md"
  git -C "$zero" add -A >/dev/null 2>&1
  zero_got=$(TMPDIR="$runtmp" "$0" "$zero" 2>&1)
  if ! printf '%s\n' "$zero_got" | grep -q 'SKIP  \[plugin-root-paths\]'; then
    echo "SELF-TEST FAILED: plugin-root-paths did not report itself skipped on a repository with zero paths to check"
    return 1
  fi
  if printf '%s\n' "$zero_got" | grep -q 'ok    \[plugin-root-paths\]'; then
    echo "SELF-TEST FAILED: plugin-root-paths passed vacuously on a repository with zero paths to check"
    return 1
  fi

  # A declared disablement, proven in both directions on the same fixture. The subject is `private-names`
  # rather than the retired `machine-paths` (track 7) — the assertion is about the DISABLEMENT MECHANISM,
  # so it needs any check the fixture already proved red above, and this one it did.
  disabled_got=$(AGENTS_MD_MAX_LINES=150 PRIVATE_NAME_LIST="$denylist" TMPDIR="$runtmp" \
    VIBE_OPS_DISABLED_CHECKS="private-names:self-test fixture" "$0" "$tmp" 2>&1)
  if printf '%s\n' "$disabled_got" | grep -q 'FAIL  \[private-names\]'; then
    echo "SELF-TEST FAILED: private-names still failed while declared off via VIBE_OPS_DISABLED_CHECKS"
    return 1
  fi
  if ! printf '%s\n' "$disabled_got" | grep -q 'SKIP  \[private-names\] declared off: self-test fixture'; then
    echo "SELF-TEST FAILED: a declared-off check did not report SKIP naming its reason"
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
  --emit-fixture)
    # Internal seam for `check --self-test`'s TypeScript-side comparison (plan-038 track 3) — builds
    # the SAME broken repository this script's own --self-test uses and exits, without asserting
    # anything. Not documented in --help: a caller outside module-check has no use for a fixture with
    # no runner to compare it against.
    dir="${2:?--emit-fixture requires a directory}"
    [ -d "$dir" ] || { echo "not a directory: $dir" >&2; exit 2; }
    git -C "$dir" init -q
    build_fixture "$dir"
    echo "$dir"
    exit 0
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

# Where the *plugin* surface of the target repository lives — skills/, hooks/, references/,
# .claude-plugin/plugin.json. A repository that publishes a Claude Code plugin from a subdirectory
# (vibe-ops itself, since the CLI was split out into cli/) keeps them under plugin/; one laid out flat
# keeps them at the root. Resolved once, here, so no fragment has to guess: a fragment that probes a
# plugin surface uses $PLUGIN_DIR, and one that probes the repository itself uses $ROOT.
if [ -f "$ROOT/plugin/.claude-plugin/plugin.json" ]; then
  PLUGIN_DIR="$ROOT/plugin"
else
  PLUGIN_DIR="$ROOT"
fi
# shellcheck disable=SC2034  # read by fragments sourced in compose_checks, not by this file directly
export PLUGIN_DIR

compose_checks

printf 'check-agents-md — %s\n\n' "$ROOT"
report_composition
compose_denylist
run_checks

printf '\n%d checks, %d failed\n' "$CHECKS" "$FAILURES"
[ "$FAILURES" -eq 0 ] || exit 1
