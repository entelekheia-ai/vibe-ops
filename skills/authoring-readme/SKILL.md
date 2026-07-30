---
name: authoring-readme
description: Write or clean up a README — repo or package — as pure presentation and usage, not process history. Use when scaffolding a new repo/package, when a README has drifted into a decision log or status narrative, or when the user asks to write/fix/review a README.
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

**This is a target-state skill** — the six sections below are the target, and an absent README is just the
maximum-gap case of the same job. Read
[`${CLAUDE_PLUGIN_ROOT}/references/convergence-policy.md`](../../references/convergence-policy.md) for the
four verbs before changing an existing README, and
[`authoring-style.md`](../../references/authoring-style.md) for phrasing and language.

The shape below is derived in
[`${CLAUDE_PLUGIN_ROOT}/project/research/readme-presentation-practices.md`](../../project/research/readme-presentation-practices.md),
which separates what published sources claim from what we concluded. Consult it when a rule here needs a
reason; do not restate it.

---

## Step 0 — Gather what the repository cannot tell you

Three inputs decide the result and **none is discoverable from the working tree.** Ask for all three at
once, before writing a line. Inventing any of them produces a README that looks finished and is wrong.

1. **The canonical claim.** Does the project have a public site or landing page? If yes, read it and take
   its wording as the starting point — **the site owns the framing, the README owns the facts.** The site
   is written for persuasion and is what a stranger meets first, so it sets the vocabulary and the angle.
   It does not get to make the README claim something untrue: sites go stale and describe roadmaps as if
   shipped, so adopt the framing and state only what is true today. Where the two cannot both hold, say so
   — the site is what gets updated. If there is no site, the README's own opening becomes the canonical
   claim and any later site inherits from it. **Never compose a tagline without checking first.**
2. **The proof artefact** — see Step 2. For anything you cannot produce yourself, ask, and *brief the
   shot* rather than requesting "a screenshot".
3. **Which badges are true.** Only what the reader can verify: a published package's version, a CI
   workflow that actually runs, a platform that actually has installers. Not stars, not download counts.

## Step 1 — The opening

Six elements, in this order, before any prose. This is the part a reader decides on.

1. **A centred mark** — logo or wordmark. **Optional**: skip it when the project has none. Never ask
   anyone to commission artwork for a README. If one exists, use `<picture>` with
   `prefers-color-scheme` so it survives both GitHub themes.
2. **The `<h1>`** — the project's name, nothing else.
3. **The claim** — one bold line, plus one sentence that clarifies it. This is the only element that is
   never optional, and it comes from Step 0.
4. **Badges** — the true ones, on one centred row.
5. **One centred row of navigation links.** Not a table of contents: GitHub auto-generates an outline from
   the headings, so a nested list is redundant, while a horizontal bar above the fold is not. Mix in-page
   anchors with external destinations.
6. **The proof** — Step 2.

Then the body, in this order: **why** (immediately after whatever raises the question, in the author's own
voice — its position is relative, not a fixed slot) · **install**, one real copyable command · **usage**,
the entry points 90% of readers need, with the rest pushed to `docs/reference/` behind a link ·
**requirements** · **license** and pointers.

For a monorepo: the **root** README introduces the set and links to each package's own README (a table:
package → one-line purpose → link). Each **package** README is self-contained and OSS-quality on its own —
it's what ends up on the npm page — and follows the same shape independently.

## Step 2 — Show the output, in the medium this project actually has

The single rule the rest depends on. "Add a screenshot" is wrong for a library; "show a code example" is
impossible for an application. Pick by what the project's output *is*:

| The project is… | The proof is… |
|---|---|
| A library | A code block: install, call, result. This *is* its visual — a pure library needs no image. |
| A CLI, or a tool driven by commands | A terminal transcript, a before-and-after directory tree, or a still of the command surface. |
| An application with an interface | A screenshot. |

**Prefer a proof that can be regenerated from the thing it depicts.** A tree produced by running the tool
is text: diffable, reviewable, reproducible when behaviour changes. A recording is a binary that nothing
verifies and that diverges silently at the first change.

**Copy a runnable example; never compose one.** You are the least able to write this project's code
sample, and the front page is the worst place for invalid syntax. Take an example from the repository's
own `examples/` or tests and shorten it. If none exists, say so and leave a marked placeholder rather than
inventing a snippet.

**Capture against the version being documented.** An artefact showing an installed tool is a snapshot of
whatever was installed when it was taken — update the installation first, or it will advertise commands
that no longer exist.

**Briefing a screenshot, when you must ask for one.** A screenshot is a **privacy surface**: it captures
whatever was on screen, into the most-read file of a public repository, permanently in git history.
Reviewing one afterwards catches what is wrong with it; only a brief makes it show the right thing. Ask
for a specific frame:

- the feature that distinguishes this project, visible — not a generic view of it
- neutral content: no personal data, no real names, addresses or credentials, no customer data
- a realistic state — not empty, not littered with throwaway test records
- debug and developer affordances off, unless they are the subject

## Step 3 — Strip what doesn't belong

Read the current README (or draft) looking specifically for:

- **Decision history** — "why we chose X over Y", "originally this was Z but we changed it", any narrative
  of how the design evolved. Move it to an ADR, or `project/log/` if it's richer context an ADR is too terse
  for. Leave at most a single link, if the reader would plausibly want the history — never the narrative
  itself.
- **Internal process leakage** — issue numbers, extraction-wave/migration-stage language, "Phase 2 of the
  platform plan," anything that only makes sense to someone who was in the room. A README travels further
  than the team that wrote it.
- **Status as body content** — a stub package can carry *one* line ("Not yet implemented — see
  `project/plans/…`"), not a running commentary. If status changes often, point at the doc that tracks it.
  **Distinguish *how the project is doing* from *how this will break for you*.** A roadmap or a progress
  report is status and moves out. A known limitation the reader will hit in their first hour — with the
  symptom and a workaround — is usage, and it stays, however unflattering.
- **Contributor material** — build toolchains, workspace commands, release tagging conventions, CI layout.
  Neither decision history nor status; simply addressed to the wrong reader. It belongs in
  `CONTRIBUTING.md`, and in practice it is the bulkiest thing to move.
- **An example that doesn't run** — either because it depends on unstated setup, or references an API that
  changed. If you can't verify it runs, don't leave it as if it does; simplify until it's true.
- **A repository-layout table.** `AGENTS.md` is for agents navigating the repo; the README is for a human
  evaluating or using it. Not a smaller table here — none. Pointers to `docs/`, `GOVERNANCE.md` and
  contributing belong in the closing line, not in a file-by-file map.

## Step 4 — Write

Draft or edit directly into the shape from Steps 1–2. Prefer concrete, runnable text over abstract
description — "install X, call Y(), get Z" beats "provides a flexible integration layer."

Length is not the constraint people think it is: READMEs that work are routinely well past any word count
you have been told. What matters is the first screenful. Do not cut substance to hit a number.

## Checklist

- [ ] Step 0 run — the site was checked (or its absence confirmed), the proof artefact obtained, badges
      verified true. No tagline was composed without checking for an existing canonical one
- [ ] The opening has the claim; the mark is present or deliberately absent
- [ ] Someone who has never heard of the project can tell **what problem it solves** — the `why` is
      present, in the author's voice, and the file does not go from its opening straight to Install
- [ ] The proof matches the project's medium, and was copied or captured — not composed from memory
- [ ] Any screenshot was briefed, and carries no personal or customer data
- [ ] Navigation is one row, not a nested table of contents
- [ ] No decision history, no internal process/issue references, no status commentary, no contributor
      material, no repository-layout table
- [ ] Monorepo: root README links to each package; each package README stands alone
- [ ] License section present and matches the repo's actual `LICENSE` (see `/vibe-ops:license-setup`)
