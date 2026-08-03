<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Consistency audit of vibe-ops, and a guard for whatever is mechanical

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-08-03 |
| Author | Danilo Borges |
| Issue | pending |

<!-- Status lifecycle: Planned → In Progress → Done → (dossier removed; git history is the archive) -->

---

## Context

Requested directly. `bash scripts/check-agents-md.sh .` reports 10/10 green today, so the audit has to
look at what no existing fragment under `scripts/checks/` looks at. Per ADR-0004, anything mechanically
checkable becomes a guard, not a line — this task's output is a findings list plus at most one or two new
check fragments, not a report nobody reads.

Runs after Task 001 (which edits both plan templates and the resolver) and before Task 003/004 (which add
a new skill and new template rows), so the dogfooding-drift check it adds is in place to catch any
divergence those later tasks introduce.

Full design: `/Users/danilo/.claude/plans/entao-monta-um-plano-delightful-patterson.md`, Task 002.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | Manifest ↔ manifest ↔ CHANGELOG version/description/keywords agreement | S |
| 2 | P0 | `hooks.json` ↔ `hooks/` — registration completeness + literal count in description | S |
| 3 | P0 | `skills/` ↔ prose — every `/vibe-ops:<name>` mention resolves | M |
| 4 | P0 | Dogfooding drift — `skills/repo-setup/templates/` vs this repo's own tree | M |
| 5 | P1 | `references/records/<type>.md` exists for each resolver type | S |
| 6 | P1 | `--list` composition matches fragment files on disk | S |

### 1. Manifest/CHANGELOG agreement — P0

**What:** `.claude-plugin/plugin.json` version, `marketplace.json`'s vibe-ops entry version, and the top
CHANGELOG heading must all agree; their `description`/`keywords` must not have silently diverged.
**Why:** Two manifests carrying the same facts is exactly the shape that drifts unnoticed.
**Change:** New check fragment if divergence is found to be plausible/recurring; otherwise a one-time fix.

### 2. hooks.json ↔ hooks/ — P0

**What:** Every file registered in `hooks/hooks.json` exists on disk and vice versa; the description
field's literal count ("Five guards") stays accurate.
**Why:** Task 004 adds a sixth hook — the count is already about to go stale.
**Change:** Fix the count when Task 004 lands; add a fragment if this is likely to recur.

### 3. skills/ ↔ prose — P0

**What:** Every `/vibe-ops:<name>` mentioned in README, skills, and shipped templates resolves to a real
`skills/<name>/` directory.
**Why:** Ten distinct mentions found across README, skills and shipped templates this session; the four
commands removed in 0.7.0 are exactly the kind of drift this would have caught, and Task 003 is about to
rename two more.
**Change:** New check fragment (e.g. `scripts/checks/95-command-references.sh`).

### 4. Dogfooding drift — P0

**What:** Every file under `skills/repo-setup/templates/` with a same-named counterpart in this repo's own
tree (plan template, governance rule, GOVERNANCE.md) must still match it **below its own copy's license
header** — a shipped template deliberately omits the header
(`scripts/checks/80-template-attribution.sh`), so the two copies are never byte-identical; the fragment
must strip each file's own leading `<!-- Copyright … -->` block before comparing.
**Why:** Task 001's own verification first got this wrong — a `diff … | head` pipeline reported the wrong
command's exit code (`head`'s, not `diff`'s), which looked like confirmation of "byte-identical" when the
two copies actually differ by exactly the header. A header-aware fragment is what would have caught that
false confirmation instead of a maintainer's question or `cmp` catching it by chance.
**Change:** New check fragment, run before Task 001's edits land to establish the baseline is currently
green (header-stripped), then again after to confirm both copies of the plan template moved together.

### 5. references/records/ completeness — P1

**What:** `references/records/adr.md`, `rfc.md`, `plan.md`, `task.md` all exist (`resolve-governance.sh`
reads exactly these four).
**Why:** Cheap, already known to pass, worth a guard rather than trust.

### 6. --list composition — P1, turned out unnecessary

**What:** Investigated, not built. `compose_checks()` in `scripts/check-agents-md.sh` globs
`$HOME_ROOT/scripts/checks/[0-9][0-9]-*.sh` and hard `exit 2`s if a matched fragment defines no
`check_<id>()` function — there is no hardcoded list a fragment could fall out of. A fragment present on
disk is composed by construction; a composed fragment that does nothing is a load-time error, not a
silent gap.
**Why not built:** Would have been a guard for a failure mode the tool already makes impossible. Building
it anyway is exactly the promotion-test question this workspace already asks before writing anything down
— "is it not already enforced?" — answered no.

## Implementation order

```
P0:  4 (baseline, before Task 001 lands), 1, 2, 3
P1:  5, 6
```

## Surprises & Discoveries

- Observation: Real drift existed in exactly the two places predicted — `marketplace.json`'s vibe-ops
  entry was missing the `repo-ops` keyword and carried a shortened `description` that had silently
  diverged from `plugin.json`'s.
  Evidence: `scripts/checks/15-manifest-sync.sh`, first run against the live repo, before any fix.
  Fixed by syncing `marketplace.json` to `plugin.json` (canonical: it's what Claude Code reads for the
  installed plugin's own identity).
  **Routed:** already enforced — `15-manifest-sync.sh` guards this exact drift going forward. Question 3:
  write the guard, not the prose; done in the same task. No further promotion.

- Observation: A pair I assumed belonged on the dogfooding-drift list did not —
  `.agents/rules/repo-guardrails.md` is vibe-ops's own plugin-specific invariants, but
  `skills/repo-setup/templates/agents/rules/repo-guardrails.md` is a deliberate generic
  "TODO: write your own repo's invariant here" seed for adopting repos, never meant to match.
  Evidence: the check's first run flagged the pair; reading the actual diff (not just the FAIL line)
  showed the shipped side was scaffold boilerplate, not a stale copy. Removed from the pair list rather
  than "fixed" — there was nothing to sync.
  This is the session's recurring pattern once more, this time inside the very task meant to catch it:
  measure, then read the actual output, before deciding whether a FAIL is a bug or a wrong assumption.
  **Routed:** fails question 1 in the repo-specific sense (nothing here for vibe-ops to guard — there was
  no real drift, just a wrong assumption about which files should match) but is itself a *recurring
  personal practice*, not a repository fact: true in any repository, so it is not this repo's knowledge to
  hold (routing table, "True in any repository → the maintainer's own notes"). Already on record there
  (the user maintains a standing note on exactly this habit); not duplicated into vibe-ops.

- Observation: `scripts/checks/45-skill-frontmatter.sh` and `95-command-references.sh` (this task's own
  new check) were both composed by `--self-test` but never exercised — the fixture had no broken skill
  frontmatter and no broken `/vibe-ops:<name>` reference, so both silently reported `ok` on a repo that
  was supposed to be broken in every other way. `skill-frontmatter`'s gap predates this task; extending
  the fixture was in scope for the checks this task added, and I extended it for those five
  (`manifest-sync`, `hooks-registration`, `dogfooding-drift`, `references-completeness`,
  `command-references`) in `scripts/check-agents-md.sh`'s `self_test()`, and added all five to the
  asserted-FAIL list. `skill-frontmatter`'s gap is now visible in the same run but not this task's to
  close.
  Evidence: first `--self-test` run after adding the five fragments showed only `ok`/`SKIP` for four of
  them (no plugin.json/hooks.json/references/ or shipped-templates dir in the minimal fixture); after
  extending the fixture, all five report `FAIL` as expected and the self-test's overall assertions
  (target and temp dir unchanged, interrupted-run handling) still pass.
  **Routed:** already enforced — this observation's own fix (extending `self_test()`'s fixture and
  assertion list) *is* the guard. Question 3 satisfied by the same edit that found the gap. No further
  promotion; `skill-frontmatter`'s pre-existing share of the gap is now visible but out of this task's
  scope to close.

## Closure

- [x] Run `/vibe-ops:close task` — do not just delete this file.
