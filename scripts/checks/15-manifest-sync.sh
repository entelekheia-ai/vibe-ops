#
# Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
# Licensed under the Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0
#
# .claude-plugin/plugin.json and the vibe-ops entry inside .claude-plugin/marketplace.json describe
# the same plugin twice, and nothing kept them in sync: found this way — version, description and
# keywords had each drifted independently (project/tasks/002-*.md). The CHANGELOG's top heading is a
# third copy of the version alone. This check treats plugin.json as canonical for everything the
# marketplace entry duplicates, and the CHANGELOG heading as canonical for the version.
#
# jq only: both are JSON, and grepping fields out of hand-rolled JSON parsing is exactly what produced
# fragile 40-frontmatter.sh-style code for a shape this regular. A repo without jq skips loudly instead
# of parsing wrong silently.

check_manifest_sync() {
  head_
  local id="manifest-sync" plugin="$ROOT/.claude-plugin/plugin.json" market="$ROOT/.claude-plugin/marketplace.json"
  local changelog="$ROOT/CHANGELOG.md" problems=0

  if [ ! -f "$plugin" ]; then
    skip "$id" "no .claude-plugin/plugin.json — not a plugin repo"
    return
  fi
  if ! command -v jq >/dev/null 2>&1; then
    skip "$id" "jq not on PATH — both manifests are JSON and this check does not hand-parse JSON"
    return
  fi

  local p_version p_desc p_keywords
  p_version=$(jq -r '.version // empty' "$plugin")
  p_desc=$(jq -r '.description // empty' "$plugin")
  p_keywords=$(jq -c '(.keywords // []) | sort' "$plugin")

  if [ -f "$market" ]; then
    local p_name m_entry
    p_name=$(jq -r '.name // empty' "$plugin")
    m_entry=$(jq -c --arg n "$p_name" '[.plugins[]? | select(.name == $n)][0] // empty' "$market")
    if [ -z "$m_entry" ] || [ "$m_entry" = "null" ]; then
      skip "$id" "marketplace.json has no entry named \"$p_name\" — nothing to compare"
    else
      local m_version m_desc m_keywords
      m_version=$(printf '%s' "$m_entry" | jq -r '.version // empty')
      m_desc=$(printf '%s' "$m_entry" | jq -r '.description // empty')
      m_keywords=$(printf '%s' "$m_entry" | jq -c '(.keywords // []) | sort')

      if [ "$p_version" != "$m_version" ]; then
        fail "$id" "plugin.json version ($p_version) != marketplace.json's vibe-ops entry ($m_version)"
        problems=$((problems + 1))
      fi
      if [ "$p_desc" != "$m_desc" ]; then
        fail "$id" "plugin.json description differs from marketplace.json's vibe-ops entry — one was edited without the other"
        problems=$((problems + 1))
      fi
      if [ "$p_keywords" != "$m_keywords" ]; then
        fail "$id" "plugin.json keywords ($p_keywords) != marketplace.json's vibe-ops entry ($m_keywords)"
        problems=$((problems + 1))
      fi
    fi
  fi

  if [ -f "$changelog" ]; then
    local c_version
    c_version=$(grep -m1 -E '^## \[' "$changelog" | sed -n 's/^## \[\([^]]*\)\].*/\1/p')
    if [ -n "$c_version" ] && [ "$c_version" != "$p_version" ]; then
      fail "$id" "CHANGELOG.md's top heading ($c_version) != plugin.json version ($p_version) — the last release was not documented, or the version was bumped without a changelog entry"
      problems=$((problems + 1))
    fi
  fi

  [ "$problems" -eq 0 ] && pass "$id" "plugin.json, marketplace.json and CHANGELOG.md agree on version/description/keywords"
}
