---
name: authoring-readme
description: Write or clean up a README — repo or package — as pure presentation and usage, not process history. Use when scaffolding a new repo/package, when a README has drifted into a decision log or status narrative, or when the user asks to write/fix/review a README.
disable-model-invocation: true
argument-hint: "[path to package, default repo root]"
effort: inherit
---

# /authoring-readme — presentation and usage, nothing else

A README answers *"what is this, and how do I use it?"* for someone who has never seen the project before.
It is not a changelog, not a decision log, not a status report. When those leak in — and they do, because
they're what's top of mind right after building the thing — the README stops being the entry point and
becomes an artifact of how the work happened instead of what it produced. That belongs in an ADR or
`project/log/`, not here.

**Usage:** `/authoring-readme` (repo root) or `/authoring-readme packages/<name>` (one package).

---

## Step 1 — Canonical section order

Write or reorder into this shape. Skip a section if it genuinely doesn't apply — don't pad.

1. **Title + one-line description** — what it is and who it's for, no internal jargon or codename the
   reader hasn't been introduced to.
2. **The problem / boundary**, one short paragraph — written for someone who has never heard of the project.
   What does it do, what does it explicitly not do.
3. **Install** — one real, copyable command.
4. **Quickstart** — the *smallest* example that actually runs and demonstrates the value. One example, not
   three variations of it. If it can't be copy-pasted and run, it doesn't belong here.
5. **Usage / API** — the handful of entry points 90% of users need. Push the rest to `docs/reference/`
   with a link; don't inline an exhaustive API dump.
6. **Requirements** (runtime/versions) · **License** · pointers (`docs/`, `GOVERNANCE.md`, contributing).

For a monorepo: the **root** README introduces the set and links to each package's own README (a table:
package → one-line purpose → link). Each **package** README is self-contained and OSS-quality on its own —
it's what ends up on the npm page — and follows the same six-section shape independently.

## Step 2 — Strip what doesn't belong (the actual work of this skill)

Read the current README (or draft) looking specifically for:

- **Decision history** — "why we chose X over Y", "originally this was Z but we changed it", any narrative
  of how the design evolved. Move it to an ADR, or `project/log/` if it's richer context an ADR is too terse
  for. Leave at most a single link, if the reader would plausibly want the history — never the narrative
  itself.
- **Internal process leakage** — issue numbers, extraction-wave/migration-stage language, "Phase 2 of the
  platform plan," anything that only makes sense to someone who was in the room. A README travels further
  than the team that wrote it.
- **Status/roadmap as body content** — a stub package can carry *one* line ("Not yet implemented — see
  `project/plans/…`"), not a running commentary. If status changes often, point at the doc that tracks it
  instead of restating it here.
- **An example that doesn't run** — either because it depends on unstated setup, or references an API that
  changed. If you can't verify it runs, don't leave it as if it does; simplify until it's true.
- **Duplication with `AGENTS.md`** — `AGENTS.md` is for agents navigating the repo; the README is for a human
  evaluating or using it. A repo-layout tree belongs in `AGENTS.md`, not repeated here.

## Step 3 — Write

Draft or edit directly into the six-section shape. Prefer concrete, runnable text over abstract description
— "install X, call Y(), get Z" beats "provides a flexible integration layer."

## Checklist

- [ ] Opens with what it is + who it's for, in the first two sentences — no unexplained jargon
- [ ] Quickstart example is real and minimal — one example, not several
- [ ] No decision history, no internal process/issue references, no running status commentary
- [ ] Section order matches the canonical shape (skipped sections are genuinely inapplicable, not just cut)
- [ ] Monorepo: root README links to each package; each package README stands alone
- [ ] License section present and matches the repo's actual `LICENSE` (see `/vibe-ops:license-setup`)
