---
vibe-ops-template: rfc@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0002: Bootstrapping a repository, and what auto-configuration may decide alone

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-08-13 |
| Author | Danilo Borges |
| Related | [Plan-025](../plans/025-the-harness-module-and-the-norm-it-promulgates.md) |

---

## Summary

vibe-ops ships as two products with different reach — a Claude Code plugin installed once per operator,
and an npm package installed per repository — and neither reaches everything. A repository's first
contact with the harness is therefore still a skill someone runs by hand, and nothing detects a
repository that never had it run. This RFC proposes settling **which channel performs the first wiring**,
and the limit on **what an automatic step may configure without being asked**. It proposes no
implementation: the second question has no obvious answer and is the reason this is an RFC rather than a
plan track.

## Motivation

**The two channels have different reach, and the difference is not cosmetic.**

The plugin registers hooks across six events, five of them invoking the CLI by name with no shipped
script. Those hooks fire in every repository the operator opens, with no per-repository installation
step. The npm package is the opposite: it must be installed into each repository, and only a repository
that is an npm project can install it at all. Several kinds of repository this tooling is meant to serve
are not npm projects.

So a mechanism that depends on the npm side reaches a subset; a mechanism that depends on the plugin side
reaches every repository but knows nothing about any of them until it looks.

**The first wiring is the step nothing observes.** `/vibe-ops:setup` is prose executed by a model. It
works, and it leaves no machine-readable trace that it ran, against which version, or how completely. The
question *"which repositories are on version N of the norm?"* has no answer today, and it is the question
that decides whether promulgating a change is a five-minute command or an afternoon.

**A survey of six repositories found the same defect in all six**, and it makes the point concretely:
each keeps its commit hook out of version control, in the clone-local ignore list rather than the
committed one, because the hook embeds a path that is specific to one machine. The consequence is that
the single most important thing "installed" means cannot be delivered by *any* channel — not the plugin,
not npm, not a hand-run skill. It has to be re-created per clone, by hand, forever. Plan-025 Track 2
removes the cause; this RFC exists because removing the cause exposes the next question, which is who
performs the delivery.

**An automatic step that decides too much is worse than no automatic step.** The failure is not
hypothetical: this repository already ships a hook (`prefer-mcp`) declared temporary in its own
registration, precisely because a permanently-installed nudge that fires outside its own stated scope
gets discounted wholesale rather than corrected. Whatever performs the first wiring inherits that
constraint — it must either be right or be silent, and "right" for a repository it has never seen is a
strong claim.

## Specification

*Direction, not settled.* Three candidate channels, and they are not exclusive — the likely answer uses
more than one, with a declared division.

### Candidate A — an npm lifecycle script

The package declares a lifecycle script that wires the repository at install time. Attractive because it
requires nobody to remember anything, and because the moment is unambiguous.

Three known costs:

- **`prepare`, not `postinstall`.** `postinstall` also runs when the package is installed as a transitive
  dependency of someone else's project and under production-only installs, where writing configuration
  into the tree is wrong. `prepare` runs on a local install and not in those cases. This is the same
  conclusion the husky project reached after shipping `postinstall` first.
- **It is blocked by default in exactly the careful repositories.** This repository's own manifest carries
  an `allowScripts` block naming three packages by exact version, which is the shape produced by a
  toolchain that refuses install scripts unless allowlisted. A lifecycle script from this package would be
  refused there, silently, which is the worst failure mode available.
- **It cannot reach a non-npm repository at all**, so a manual sibling path has to exist regardless.

### Candidate B — the plugin's session hook

A `SessionStart` entry alongside the six events already registered. It reaches every repository the
operator opens with no installation step, which is the reach no other candidate has.

Its limit is the mirror of Candidate A's: it fires for an operator who has the plugin, and does nothing
for a contributor who does not, or for continuous integration. It is a **per-operator** mechanism wearing
the appearance of a per-repository one, and that distinction has to be stated wherever it is relied upon.

Plan-025 Track 3 builds this hook for a narrower job — comparing an applied-version stamp against the
installed one and staying silent when they match. Whether the same hook may also perform a *first* wiring,
in a repository that has no stamp at all, is open question 1 below.

### Candidate C — an explicit command, and nothing else

The status quo, made deterministic: the skill stops being the mechanism and becomes a caller of a CLI verb.
Nothing fires unasked. Cheapest to build, cheapest to reason about, and it does not answer the motivating
complaint — a repository that nobody thought about stays unwired and unreported.

### The limit on what an automatic step may decide

Independent of the channel, and probably the more durable half of this RFC:

- An automatic step **MAY** write files the norm owns, create clone-local state, and enable a check that
  the norm ships as off.
- An automatic step **MUST NOT** modify a file the repository owns, disable a check, or resolve a conflict
  between what the norm ships and what the repository already had. Each of those is a judgement, and the
  correct behaviour for all three is to report and stop.
- The boundary between "the norm owns it" and "the repository owns it" is not this RFC's to invent — it is
  Plan-025 Track 1, and this RFC is blocked on it in the sense that its central rule is unstatable without
  it.

## Rationale

The alternative shape considered first was a **temporary always-on instruction** carried by the new
version — a rule that tells the agent the repository was updated and what to configure, removed once the
configuration happened. It is rejected on two counts. An always-on instruction costs attention in every
session while describing an event that happens once; and it has no way to know it has been discharged, so
removing it depends on someone remembering, which is the same defect the whole proposal exists to remove.
The information it would carry is derivable from a version stamp, and a derived signal cannot be left
switched on by accident.

That rejection is what produces the shape in Plan-025 Track 3: **store the version applied, derive the
rest.** There is no flag to clear, because there is no flag.

## Implementation Notes

Deliberately not written. Nothing here is decided, and the load-bearing prerequisite — the ownership
boundary — is a Plan-025 track that has not shipped.

## Open Questions

1. **May the session hook perform a first wiring, or only report one is missing?** Reporting is safe and
   leaves the work to a human turn. Performing it means a hook writes files into a repository the operator
   merely opened, which is a much larger claim than "this repository is two versions behind".
2. **What does a repository with no stamp mean?** It is indistinguishable from a repository that is not
   meant to have the harness at all. Without an answer, any detector proposed here fires on every
   unrelated repository the operator opens — the precision failure that makes a signal ignorable.
3. **Does an automatic step ever run in continuous integration?** A lifecycle script does by default. Every
   candidate needs an explicit answer, because "wire the repository" in a throwaway build container is
   pure cost and can mask a missing commit.
4. **What is the manual sibling, and is it the same command?** If a non-npm repository must be wired by
   hand anyway, the automatic path saves a step in some repositories and adds a second code path in all of
   them. That trade is not obviously worth taking, and Candidate C exists to keep the question honest.

## Decisions Closed

- **A temporary always-on instruction is not the carrier.** Rationale: it costs attention every session for
  an event that happens once, and cannot know it has been discharged. What it would announce is derivable
  from a version stamp. 2026-08-13.
- **The state to store is the version applied, not a set of switches.** Rationale: a stored switch requires
  someone to clear it, and a signal that keeps firing after it is satisfied is ignored rather than
  corrected. Comparing an applied version against an installed one is self-clearing by construction.
  2026-08-13.
- **If a lifecycle script is used, it is `prepare`.** Rationale: `postinstall` also runs where writing
  configuration is wrong — as a transitive dependency, and under production-only installs. 2026-08-13.
- **The reach of each channel is a property to state, not to smooth over.** Rationale: the plugin path is
  per-operator and the npm path is per-repository, and treating either as the other produces a mechanism
  that appears installed and is absent for the next person. 2026-08-13.

## Related

- [Plan-025](../plans/025-the-harness-module-and-the-norm-it-promulgates.md) — the module this RFC's answer
  would be delivered through; its Track 1 defines the ownership boundary this RFC's central rule needs, and
  its Track 3 builds the version stamp the derived-signal decision rests on.
- [RFC-0001](0001-gates-and-ops-as-the-cli-unit-of-composition.md) — the split between a detector and the
  composition that decides its scope, which is the same separation applied one level up: what promulgates
  the norm is not what verifies it.
