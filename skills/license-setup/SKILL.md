---
name: license-setup
description: Set up or refresh a repo's license — LICENSE file, NOTICE/AUTHORS for a fork with dual attribution, the license-rules section of AGENTS.md, and optional pre-commit + CI header enforcement. Use when scaffolding a new repo, when a repo is missing a LICENSE, or when license-header conventions need centralizing/fixing.
disable-model-invocation: true
argument-hint: "[--fork] [--enforce=none|script|ci]"
effort: inherit
---

# /license-setup — one shared license convention, not one per repo

Two repos in this workspace hand-rolled two different license schemes independently (a simple "root
LICENSE covers everything, code gets an Apache header" rule, and a much more elaborate SPDX + dual-
attribution + pre-commit + CI scheme for a fork). This skill is the shared source for both, selected by
answers instead of reinvented per repo.

**Usage:** `/license-setup` — ask everything; or pass flags to skip prompts.

---

## Step 1 — Ask

1. **License** — default **Apache-2.0**. (Other SPDX ids are possible but the shipped templates are
   Apache-2.0; a different choice means supplying your own `LICENSE` text.)
2. **Is this repo a fork requiring dual attribution?** Default **no**. If yes, collect: origin project name,
   origin author, origin URL, origin license (full name + short SPDX id, e.g. "MIT"), origin copyright year.
3. **Header enforcement level** — default depends on context: **none** for a fresh/low-traffic repo, **script
   + CI** if the repo already has `.github/workflows/` (it's clearly maintained beyond solo scratch work).
   Options: `none` (docs only) / `script` (local pre-commit only) / `ci` (script + CI check).
4. **Project name** (for `NOTICE`/`AUTHORS` and header text) and **maintainer name/email** — read from
   `package.json` / `git config user.name|user.email` if available, confirm rather than re-ask.
5. **Source file glob** — default `*.ts *.tsx *.js *.jsx`; ask if the repo is a different language.

## Step 2 — Write LICENSE

Copy `${CLAUDE_PLUGIN_ROOT}/skills/license-setup/templates/LICENSE-apache-2.0` → `LICENSE` verbatim (full
Apache-2.0 text, not the plugin's own `LICENSE` — this repo's copy is independent).

## Step 3 — NOTICE + AUTHORS (fork case only)

If **not** a fork, skip this step entirely — no `NOTICE`/`AUTHORS` files.

If a fork: from `templates/NOTICE.template` and `templates/AUTHORS.template`, substitute
`{{PROJECT_NAME}}` `{{YEAR}}` `{{ORIGIN_AUTHOR}}` `{{ORIGIN_PROJECT}}` `{{ORIGIN_URL}}`
`{{ORIGIN_LICENSE}}` `{{ORIGIN_YEAR}}` `{{AUTHOR_NAME}}` `{{AUTHOR_EMAIL}}` `{{AUTHOR_URL}}` and write
`NOTICE` + `AUTHORS` at the repo root.

## Step 4 — License-rules section for AGENTS.md

Pick the variant by fork status:
- **Not a fork** → `templates/license-rules-simple.md`.
- **Fork** → `templates/license-rules-spdx-mandatory.md`, stripping the `<!-- FORK_ONLY:start -->` /
  `<!-- FORK_ONLY:end -->` marker lines themselves (keep the content between them — it only belongs in the
  fork case, which is why you're using this variant at all).

Substitute `{{SOURCE_GLOB}}` `{{LICENSE_ID}}` `{{PROJECT_NAME}}` and (fork only) `{{ORIGIN_LICENSE_SHORT}}`
`{{ORIGIN_PROJECT}}`. Insert the result into `AGENTS.md` as its own `## License rules` section (append if the
file has no such section yet; replace if refreshing one that's drifted) — same insertion pattern
`authoring-agents-md` uses for the rest of the file.

## Step 5 — Enforcement (skip if level = none)

From `templates/ensure-license-headers.sh`:
- Substitute `{{SOURCE_GLOB_ARRAY}}` (bash array literal, e.g. `"*.ts" "*.tsx" "*.js" "*.jsx"`),
  `{{LICENSE_ID}}`, and — fork case only — `{{ORIGIN_LICENSE_SHORT}}` `{{ORIGIN_PROJECT}}` `{{ORIGIN_AUTHOR}}`
  `{{PROJECT_NAME}}`.
- **Not a fork**: strip the `<!-- FORK_ONLY:start -->` … `<!-- FORK_ONLY:end -->` blocks (markers and
  content both) — the script keeps only the plain-header path.
- **Fork**: strip just the marker lines, keep the content.
- Write the result to `scripts/ensure-license-headers.sh`, `chmod +x` it.
- Wire it in: `git config core.hooksPath .githooks`, create `.githooks/pre-commit` calling the script with no
  args, and add an npm `"prepare": "git config core.hooksPath .githooks"` script so a fresh clone re-wires
  the hook on `npm install`.

If level = **ci**: also copy `templates/license-headers-ci.yml` → `.github/workflows/license-headers.yml`.
Adjust the `branches:` trigger if the repo has release branches beyond `main`.

## Checklist

- [ ] `LICENSE` present and is the real license text (not a copy of some other repo's/the plugin's own)
- [ ] `NOTICE` + `AUTHORS` present **only** if fork/dual-attribution; absent otherwise
- [ ] `AGENTS.md` has one `## License rules` section, the variant matching fork status, no leftover `{{...}}`
- [ ] If enforcement ≥ script: `scripts/ensure-license-headers.sh` executable, `.githooks/pre-commit` wired,
      `core.hooksPath` set, `prepare` npm script added
- [ ] If enforcement = ci: `.github/workflows/license-headers.yml` present and points at the script
- [ ] No `<!-- FORK_ONLY -->` marker comments left in any written file
