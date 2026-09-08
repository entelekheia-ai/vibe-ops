#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# A home directory written into a committed document is the one leak in
# references/exposure-contract.md that needs no list to detect: the shape is identical on every
# machine, and a repository-relative path is always available instead. It arrives by the most ordinary
# route there is — a command pasted out of a terminal into a plan's Success criteria, or an approved
# plan-mode plan carrying the | Repository | row it was filed by.
#
# Unlike 50-private-names.sh this one CAN name what it found. The point of a machine path is the
# username inside it; that username is already in the tracked tree at the moment this fires, so
# printing it discloses nothing new — and a report that hid the hit would leave nobody able to fix it.
#
# The character class after the prefix is [A-Za-z0-9] and not the full path class on purpose: it is
# what keeps `/Users/…/somewhere` and `/Users/.../somewhere` passing. A document that *describes* this
# failure — an ADR, a plan's Decision Log, this contract itself — writes the elided form, and a guard
# that fires on the description of the rule is a guard people switch off.

CHECK_VERSION=2

check_machine_paths() {
  head_
  local id="machine-paths" hits=0 line examined

  local pattern='(/Users/|/home/|[Cc]:[\\/]+Users[\\/]+)[A-Za-z0-9]'

  # The one repository this must not fire in is the private layer itself — the place the exposure
  # contract explicitly permits to name paths, because that is what it is for. A repository declares
  # itself that layer; it is never inferred. "No remote" was tried as the discriminator and is wrong:
  # several repositories here have no remote yet and fully intend to publish, and a check that goes
  # quiet until the day someone runs `git remote add` hands them a backlog at exactly the wrong moment.
  #
  # SKIP, never a silent pass: "no machine path found" and "I was told not to look" are different
  # answers, the same distinction 50-private-names.sh makes about its own supplied list.
  if [ -n "${VIBE_OPS_PRIVATE_LAYER:-}" ]; then
    skip "$id" "declared the private layer (VIBE_OPS_PRIVATE_LAYER) — named paths belong here by design"
    return
  fi

  # examined = tracked_md()'s own count, the same enumeration this check already uses to decide
  # whether to skip below, and it is safe to also treat as the search's own population here — unlike
  # 40-markdown.sh's rumdl, which walks the filesystem itself and dedupes a symlink against its target
  # (git ls-files counts both paths, rumdl counts one), the search two lines down is ALSO a git
  # pathspec match ('*.md'), so it and tracked_md() enumerate the identical set of tracked paths. See
  # harness-pair.md's population rules and the symlink-bridge learning this reasoning route around.
  examined=$(printf '%s\n' "$(tracked_md)" | grep -c .)

  if [ "$examined" -eq 0 ]; then
    skip "$id" "no tracked markdown outside templates/ to examine"
    return
  fi

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    fail "$id" "${line%%:*}: a machine path appears here — ${line#*:}"
    hits=$((hits + 1))
  done <<EOF
$(git -C "$ROOT" grep -nE -- "$pattern" -- '*.md' 2>/dev/null | grep -v '/templates/' || true)
EOF

  [ "$hits" -eq 0 ] && pass "$id" "no committed markdown carries a home directory or checkout path"

  emit_machine_paths_artifact "$hits" "$examined"
}

# Plan-020 Track 5. Same env-gated, best-effort shape as 40-markdown.sh's emitter call: absent
# GATE_ARTIFACT_DIR, this does nothing beyond what check_machine_paths already did above — no jq
# invocation, no new file. The rule id is fixed at one value ("home-path") because this fragment
# checks exactly one shape; a second pattern here would need its own id, not a second call.
#
# The emitter is resolved via $HOME_ROOT, not the literal ${CLAUDE_PLUGIN_ROOT} harness-pair.md
# describes — HOME_ROOT is wherever check-agents-md.sh itself was resolved from (a target repo's
# snapshot, the sibling vibe-ops checkout Plan-020 Track 1 added, or a real plugin install), so it is
# correct under all three resolution paths without special-casing any of them; the literal env var is
# usually unset. Divergence written back to harness-pair.md — Plan-020 Track 6.
emit_machine_paths_artifact() {
  local hits="$1" examined="$2"
  [ -n "${GATE_ARTIFACT_DIR:-}" ] || return 0

  local emitter="$HOME_ROOT/sh/gate-emit.sh"
  [ -x "$emitter" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0

  local diagnostics
  diagnostics="[]"
  if [ "$hits" -gt 0 ]; then
    diagnostics=$(jq -nc --argjson n "$hits" '[range($n) | {rule:"home-path"}]')
  fi

  mkdir -p "$GATE_ARTIFACT_DIR" 2>/dev/null || return 0

  local tmp
  tmp="$GATE_ARTIFACT_DIR/.machine-paths.jsonl.tmp.$$"
  if printf '%s' "$diagnostics" | sh "$emitter" \
      --producer machine-paths --tool "vibe-ops-machine-paths@$CHECK_VERSION" \
      --unit file --examined "$examined" --moment attempt >"$tmp" 2>/dev/null; then
    if [ -s "$tmp" ]; then
      mv "$tmp" "$GATE_ARTIFACT_DIR/machine-paths-$(artifact_stamp_ "$tmp")-$$.jsonl"
    else
      rm -f "$tmp"
    fi
  else
    rm -f "$tmp"
  fi
}

# A local copy of 40-markdown.sh's artifact_stamp(), not a shared call: the two fragments are composed
# independently and neither may depend on the other having run first or existing at all in a given
# composition (VIBE_OPS_CHECK_DIRS may include one without the other).
artifact_stamp_() {
  local produced
  produced=$(head -n1 "$1" | grep -oE '"producedAt":"[^"]*"' | head -n1 | cut -d'"' -f4)
  printf '%s' "${produced//:/}"
}
