#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# vibe-ops uses its own governance conventions, so a handful of files exist in two places: this
# repo's own copy, and the copy it SHIPS to every other repository under
# skills/setup/templates/. Nothing kept them in sync mechanically — an edit to one and not the
# other is invisible from inside this repo, because both copies are individually well-formed.
#
# project/tasks/002-*.md found, while writing this check, that a naive byte comparison is the wrong
# tool: this repo's own copy of a template legitimately carries a copyright header the SHIPPED copy
# must NOT carry (scripts/checks/80-template-attribution.sh enforces that half already). Comparing raw
# bytes reported these as "drifted" when they were not — a false positive from the header alone would
# have trained whoever runs this to ignore its output. strip_leading_copyright_comment removes only a
# LEADING HTML comment block that contains the word "Copyright", so an ordinary leading comment (the
# PLAN TEMPLATE usage note, for instance) is left alone and still compared.

# Plan-012 moved every template's version declaration into YAML frontmatter at offset 0, which put a
# block ahead of the copyright comment this function exists to strip. The original keyed on NR == 1, so
# the comment stopped being recognised the moment frontmatter preceded it — and the failure was not a
# missed strip but a permanent one: the licence block then entered the comparison, the shipped copy has
# none by design (80-template-attribution.sh enforces that), and the two sides could never match again.
# So the leading frontmatter is passed through UNCHANGED — the version must agree between the two copies,
# and a mismatch there is real drift — and the copyright comment is then looked for at the first content
# line after it, rather than at line 1.

# strip_leading_copyright_comment <file> — the file's content with a leading `<!-- ... Copyright ...
# -->` block (plus the one blank line after it) removed; unchanged if no such block opens the file.
# A leading `---` frontmatter block is printed as-is and does not stop the copyright block being found.
strip_leading_copyright_comment() {
  awk '
    BEGIN { atstart = 1 }
    # Leading frontmatter: emitted verbatim, then the search for the copyright block resumes after it.
    NR == 1 && $0 == "---" { print; infm = 1; atstart = 0; next }
    infm { print; if ($0 == "---") { infm = 0; afterfm = 1 } next }
    afterfm && /^[[:space:]]*$/ { print; next }
    afterfm { afterfm = 0; atstart = 1 }
    atstart && $0 ~ /^<!--[[:space:]]*$/ { incomment = 1; atstart = 0; buf = $0 "\n"; next }
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
    { atstart = 0; print }
  ' "$1"
}

CHECK_VERSION=1

check_dogfooding_drift() {
  head_
  local id="dogfooding-drift" problems=0
  local shipped="$PLUGIN_DIR/skills/setup/templates" pair own ship a b

  if [ ! -d "$shipped" ]; then
    skip "$id" "no skills/setup/templates/ — this repo does not ship a scaffold"
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
  #
  # The two sides resolve against DIFFERENT roots, and it matters: the shipped copy always lives inside
  # the plugin ($PLUGIN_DIR), while the dogfooded copy may be repository-level (GOVERNANCE.md,
  # .agents/rules/) or plugin-level (the templates). Hardcoding `plugin/` into both sides instead made
  # every pair unreachable in a repository laid out flat — including this check's own self-test fixture,
  # which is exactly where that mistake surfaced.
  for pair in \
    "plugin/templates/plan.md::skills/setup/templates/project/templates/plan.md" \
    "plugin/templates/task.md::skills/setup/templates/project/templates/task.md" \
    "plugin/templates/adr.md::skills/setup/templates/project/templates/adr.md" \
    "plugin/templates/rfc.md::skills/setup/templates/project/templates/rfc.md" \
    ".agents/rules/governance.md::skills/setup/templates/agents/rules/governance.md" \
    "GOVERNANCE.md::skills/setup/templates/root/GOVERNANCE.md" \
  ; do
    own="$ROOT/${pair%%::*}"
    ship="$PLUGIN_DIR/${pair##*::}"
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
