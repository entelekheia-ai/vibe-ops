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

check_machine_paths() {
  head_
  local id="machine-paths" hits=0 line
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

  if [ -z "$(tracked_md)" ]; then
    skip "$id" "no tracked markdown outside templates/ to examine"
    return
  fi

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    fail "$id" "a machine path appears in $line"
    hits=$((hits + 1))
  done <<EOF
$(git -C "$ROOT" grep -nE -- "$pattern" -- '*.md' 2>/dev/null | grep -v '/templates/' || true)
EOF

  [ "$hits" -eq 0 ] && pass "$id" "no committed markdown carries a home directory or checkout path"
}
