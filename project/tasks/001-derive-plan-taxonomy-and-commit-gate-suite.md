<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: Derive the plan taxonomy from the repository, and commit the Track 3b gate suite

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-08-03 |
| Author | Danilo Borges |
| Issue | pending |

<!-- Status lifecycle: Planned → In Progress → Done → (dossier removed; git history is the archive) -->

---

## Context

Status set to Done: all five work items landed and verified — `scripts/resolve-governance.sh` derives
`PLAN_ACTIVE`/`LIVING`, both plan templates carry the end marker (plus the umbrella's), the hook consumes
the derived values with three-tier degradation, and `scripts/test-plan-progress-nudge.sh` (18 assertions)
passes, as does `scripts/check-agents-md.sh` (10/10) and `claude plugin validate .`.

`hooks/plan-progress-nudge.sh` shipped in 0.7.0 (Plan-006) calling `scripts/resolve-governance.sh plan`
and extracting **only `DIR`**, discarding `AUTHORITY` — the file that defines a repository's own status
and living-section vocabulary. It then hardcodes vibe-ops's own taxonomy twice: the detection
(`grep -l '^| Status | In Progress |' … | head -1`) and the four section names plus entry shapes in the
nudge text.

Fixture-measured this session: a plan whose status is `Active`, or expressed in YAML frontmatter, is not
detected — a safe under-trigger. But a repo that *is* detected while naming its living sections
differently would be told to write sections that do not exist, which creates drift instead of preventing
it — the opposite of what the hook exists for. This is a plugin installed into other repositories, which
is exactly what the umbrella workspace's Plan-001 baseline review walks.

Plan-006's retrospective separately cut its own gate-case suite as debt (Track 3b), naming it *"the most
expensive open item, because both post-install defects are exactly what an extendable suite would have
covered."* The fix for the taxonomy bug and the suite that would have caught it are the same piece of
work, so they are joined here rather than filed separately.

Verified this session: `project/templates/plan.md` and the copy vibe-ops ships to other repos
(`skills/repo-setup/templates/project/templates/plan.md`) are byte-identical (`diff`, exit 0), as is
`.agents/rules/governance.md` against its shipped copy. Both already carry the two facts needed:
- `<!-- Status lifecycle: Backlog → In Progress → Shipped. … -->` — the active label is the middle term
- `<!-- ===== LIVING SECTIONS — maintained during the work, not written at the end ===== -->` followed by
  the `##` headings that name the living sections

Full design: `/Users/danilo/.claude/plans/entao-monta-um-plano-delightful-patterson.md`, Task 001.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `resolve-governance.sh` — derive `PLAN_ACTIVE` and `LIVING` for `plan` | S |
| 2 | P0 | Add a LIVING SECTIONS end marker to both plan templates | S |
| 3 | P0 | `plan-progress-nudge.sh` — consume the derived values, three-tier degradation | M |
| 4 | P1 | Optional: add the end marker to the umbrella's `project/templates/plan.md` | S |
| 5 | P0 | `scripts/test-plan-progress-nudge.sh` — commit the gate suite (Track 3b) | M |

### 1. Derive `PLAN_ACTIVE` and `LIVING` in the resolver — P0

**What:** Add two new `KEY=value` lines to `resolve-governance.sh plan`'s output, sourced from the `TPL`
it already resolves (fall back to `AUTHORITY`'s Plan section if `TPL` lacks the marker).
**Why:** The hook has no other cheap way to learn a repo's own vocabulary; re-deriving it inside the hook
duplicates the resolver's job, which ADR-0009 obligation 2 forbids.
**Change:** `PLAN_ACTIVE=In Progress` (middle term of the `Status lifecycle:` comment) or `(unknown)`.
`LIVING=Progress|Surprises & Discoveries|Decision Log|Outcomes & Retrospective` (the `##` headings between
the LIVING SECTIONS start marker and the new end marker) or `(unknown)`.

### 2. LIVING SECTIONS end marker — P0

**What:** A closing comment marker in both `project/templates/plan.md` and
`skills/repo-setup/templates/project/templates/plan.md`, paired with the existing start marker.
**Why:** Without an end marker the resolver cannot know where the living-section list stops; grabbing
every subsequent `##` heading would wrongly include `Open questions` / `Related`.
**Change:** `<!-- ===== END LIVING SECTIONS ===== -->` (or equivalent) placed right after the fourth
living section's content, before `## Open questions`.

### 3. Three-tier degradation in the hook — P0

**What:** Replace the hardcoded detection and nudge text with values read from the resolver.
**Why:** Never invent a section name for a repo whose taxonomy differs or is unknown.
**Change:**

| What the repo has | What the hook does |
|---|---|
| Both markers (`LIVING` resolved) | enumerate the real section names |
| Start marker only, no end marker | do not enumerate — name the template file instead: *"the sections below the LIVING SECTIONS divider in `<TPL>`"* |
| `PLAN_ACTIVE=(unknown)` | stay silent |

Also: detection tolerant of cell spacing (not just the exact `| Status | In Progress |` byte sequence),
and drop `head -1` — every `In Progress` plan the turn touched is named, not just the first match.

### 4. Umbrella template marker — P1, optional

**What:** One-line addition of the same end marker to
`/Users/danilo/Development/entelekheia/project/templates/plan.md`.
**Why:** Without it the nudge degrades to tier 2 in the workspace the maintainer actually works in.
**Change:** Same marker as item 2, same position. The only edit in this task outside `vibe-ops`.

### 5. Commit the gate suite — P0

**What:** `scripts/test-plan-progress-nudge.sh`, styled on `scripts/test-license-headers.sh` (self-contained
temp git repos, `ok`/`FAIL` lines, exit 0/1).
**Why:** Track 3b debt — the 10 cases from Plan-006 were run ad hoc and never committed, so from this
repo's point of view they never happened; two post-install defects escaped them.
**Change:** The original 10 gate cases, plus the ones that actually escaped:
- first `Stop` of a session seeds the offset and says nothing (the offset-reset false positive)
- the state sweep never selects its own directory (`-type f`)
- a plan whose status is `Active` (or YAML frontmatter): silent, not detected
- a repo whose template lacks the end marker: tier-2 text, never an invented section name
- garbage / empty / missing-transcript payloads exit 0 silently
- a turn that wrote nothing spawns zero `git` processes

## Implementation order

```
P0:  1, 2, 3, 5
P1:  4
```

## Surprises & Discoveries

- Observation: The planning-turn claim that `project/templates/plan.md` and
  `skills/repo-setup/templates/project/templates/plan.md` are byte-identical was wrong — they legitimately
  differ by the license header, which `scripts/checks/80-template-attribution.sh` requires shipped
  templates to omit. The apparent "diff, exit 0" confirmation was a shell scripting bug in the verification
  command itself (`diff … | head -40; echo "(exit $?)"` — `$?` captured `head`'s exit status, not `diff`'s,
  because `head` is the last stage of the pipe). A clean `diff` (no pipe) correctly reports exit 1.
  Evidence: `cmp` shows the first divergent byte at offset 6, inside the copyright block; stripping the
  10-line license header from `project/templates/plan.md` and comparing with `cmp` against the shipped
  copy shows the remaining content byte-identical, confirming this task's own edit (the LIVING SECTIONS
  end marker) landed correctly in both copies.
  Evidence: `md5 project/templates/plan.md skills/repo-setup/templates/project/templates/plan.md` — two
  different hashes, `4671` vs `4374` bytes, difference matches the header's length.
  **Routed:** promotion test — (1) recurs: a shell pipe hides the upstream command's exit status in `$?`,
  a general footgun; (2) non-discoverable from the diff wrapper's own compact output; (3) **already
  enforced** — `scripts/checks/35-dogfooding-drift.sh` (written in Task 002, the same session) makes the
  underlying mistake (missing that these two files legitimately diverge only by license header)
  mechanically impossible to ship silently going forward, for this specific pair and its five siblings.
  Question 3 says write the guard, not the prose — the guard already exists. No further promotion.

## Closure

- [x] Run `/vibe-ops:close task` — do not just delete this file.
