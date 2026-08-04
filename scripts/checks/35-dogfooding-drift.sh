#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# vibe-ops uses its own governance conventions, so a handful of files exist in two places: this
# repo's own copy, and the copy it SHIPS to every other repository under
# skills/repo-setup/templates/. Nothing kept them in sync mechanically — an edit to one and not the
# other is invisible from inside this repo, because both copies are individually well-formed.
#
# project/tasks/002-*.md found, while writing this check, that a naive byte comparison is the wrong
# tool: this repo's own copy of a template legitimately carries a copyright header the SHIPPED copy
# must NOT carry (scripts/checks/80-template-attribution.sh enforces that half already). Comparing raw
# bytes reported these as "drifted" when they were not — a false positive from the header alone would
# have trained whoever runs this to ignore its output. strip_leading_copyright_comment removes only a
# LEADING HTML comment block that contains the word "Copyright", so an ordinary leading comment (the
# PLAN TEMPLATE usage note, for instance) is left alone and still compared.

# strip_leading_copyright_comment <file> — the file's content with a leading `<!-- ... Copyright ...
# -->` block (plus the one blank line after it) removed; unchanged if no such block opens the file.
strip_leading_copyright_comment() {
  awk '
    NR == 1 && $0 ~ /^<!--[[:space:]]*$/ { incomment = 1; buf = $0 "\n"; next }
    incomment {
      buf = buf $0 "\n"
      if ($0 ~ /Copyright/) sawcopy = 1
      if ($0 ~ /-->/) {
        incomment = 0
        if (!sawcopy) printf "%s", buf
        else skipping = 1
        next
      }
      next
    }
    skipping && /^[[:space:]]*$/ { skipping = 0; next }
    { print }
  ' "$1"
}

check_dogfooding_drift() {
  head_
  local id="dogfooding-drift" problems=0
  local shipped="$ROOT/skills/repo-setup/templates" pair own ship a b

  if [ ! -d "$shipped" ]; then
    skip "$id" "no skills/repo-setup/templates/ — this repo does not ship a scaffold"
    return
  fi

  # Each pair: this repo's own copy, then its shipped counterpart. Deliberately a short, explicit
  # list rather than a path-guessing rule — the two trees are NOT meant to mirror each other
  # everywhere. README.md, CLAUDE.md and agents/rules/repo-guardrails.md are starting points/seeds a
  # consuming repo is expected to customize away from (repo-guardrails.md's shipped copy is a generic
  # "TODO: write your own repo's invariant here" placeholder, not a copy of vibe-ops's own
  # plugin-specific guardrails — confirmed by reading the actual divergence this check first reported,
  # rather than assuming the pair belonged on this list). These are the governance core vibe-ops
  # dogfoods and is the only kind of pair this check asserts about.
  for pair in \
    "project/templates/plan.md::skills/repo-setup/templates/project/templates/plan.md" \
    "project/templates/task.md::skills/repo-setup/templates/project/templates/task.md" \
    "project/templates/adr.md::skills/repo-setup/templates/project/templates/adr.md" \
    "project/templates/rfc.md::skills/repo-setup/templates/project/templates/rfc.md" \
    ".agents/rules/governance.md::skills/repo-setup/templates/agents/rules/governance.md" \
    "GOVERNANCE.md::skills/repo-setup/templates/root/GOVERNANCE.md" \
  ; do
    own="$ROOT/${pair%%::*}"
    ship="$ROOT/${pair##*::}"
    [ -f "$own" ] || continue
    [ -f "$ship" ] || continue
    a=$(strip_leading_copyright_comment "$own")
    b=$(strip_leading_copyright_comment "$ship")
    if [ "$a" != "$b" ]; then
      fail "$id" "${pair%%::*} and ${pair##*::} have diverged (past the copyright header) — one was edited without the other"
      problems=$((problems + 1))
    fi
  done

  [ "$problems" -eq 0 ] && pass "$id" "every dogfooded file matches its shipped counterpart"
}
