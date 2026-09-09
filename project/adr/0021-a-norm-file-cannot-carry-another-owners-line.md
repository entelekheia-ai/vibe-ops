---
vibe-ops-template: adr@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0021: A `norm` file cannot carry another owner's line

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-09 |
| Deciders | Danilo Borges |
| Related | [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md), [ADR-0007](0007-license-enforcement-writes-no-git-config.md), [Plan-040](../plans/040-every-shipped-file-belongs-to-a-governance.md) |

---

## Context

`.githooks/pre-commit` has two writers and one owner.

The harness base fragment claims it as `norm` — "wiring with no check logic", so promulgation overwrites
it. That classification is right about what the file is: `harness install` writes it, and a repository is
not meant to edit it.

The `license-setup` skill also writes it. At enforcement level `script` it creates
`.githooks/pre-commit` calling `scripts/ensure-license-headers.sh`, and that file is not named in any
governance fragment. So a repository that took the `script` level and later received a promulgation had
its licence hook silently replaced by the harness's, with nothing reporting the loss.

Plan-040 Track 6 made the collision easier to see rather than creating it. `harness install` now keeps an
existing `pre-commit` and reports that the gate needs appending to it — which is the right behaviour for
the *first* install and does nothing about the *second* promulgation, where `norm` still means overwrite.

The obvious repair — adding the path to `governance-license`'s fragment — makes it worse. Two fragments
claiming one path with different classes is a **conflict**, refused naming both claimants, and the
refusal would fire in every repository that activates licence enforcement.

## Decision

We will treat a `norm` path as unable to carry any other owner's content, and move the licence line out
of the hook rather than reclassifying the hook.

- `.githooks/pre-commit` keeps exactly one claimant, the harness, at `norm`.
- The `license-setup` skill's `script` level stops writing that file. The licence-header check becomes a
  **check the gate composes** (RFC-0001: a gate is a detector, an ops decides where it runs), which is
  where a per-commit check belongs and where every other per-commit check already is.
- Until that gate exists, `script` is documented as unavailable and `ci` is the enforcement level the
  skill offers — the CI workflow it already ships, which no promulgation touches.

## Options considered

- **Option A — `governance-license` claims the path too.** Rejected: two claimants disagreeing on class
  is a refusal by design, so this converts a silent overwrite into a hard failure for every repository
  that wants licence enforcement.
- **Option B — reclassify `.githooks/pre-commit` as `shaped`**, the tooling owning a delimited block and
  the repository the rest. Rejected for now, and the reason is evidence rather than taste: `shaped` was
  built and proved in Plan-040 Track 6 for `GOVERNANCE.md`, where the boundary is a pair of markers in
  **markdown**. A shell script whose meaning depends on control flow is a different problem — a block
  that is syntactically intact and unreachable still "survived" by every test a marker-based merge can
  run. Nothing measured says `shaped` holds there, and adopting it would be assuming it does.
- **Option C (chosen) — the line moves out of the file.** A per-commit check composed by the gate is what
  RFC-0001 already says such a thing is. The hook keeps one owner and one meaning.

## Consequences

**Easier.** One claimant per path, so the composed boundary answers without a conflict. A repository that
promulgates cannot lose a licence hook, because it never had one. And the licence-header check joins the
population every other check is in, where `ignore`, `disabled` and `level` already work on it.

**Harder, and stated plainly: this removes a capability before its replacement exists.** A repository
that wants licence headers enforced *at commit time* has, between this decision and that gate, only CI.
That is a real regression for that repository, accepted because the alternative is a hook that silently
disappears on the next promulgation — a check that vanishes is worse than a check that was never offered,
since only one of the two is visible.

**The follow-up is named, not implied.** The header check becomes a gate in `@entelekheia/vibe-ops-gates`
composed by an ops, with the fixture that proves it fires. Until then `plugin/skills/license-setup/SKILL.md`
must not instruct anyone to write `.githooks/pre-commit`.

## Related

- [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) — a gate detects, an ops decides
  where it runs; this is that split applied to a check that had escaped it.
- [ADR-0007](0007-license-enforcement-writes-no-git-config.md) — the earlier decision that this skill does
  not write git config on the user's behalf. Same principle, one layer up: it does not write another
  owner's file either.
- [Plan-040](../plans/040-every-shipped-file-belongs-to-a-governance.md) — Track 6, where `shaped` was
  built and where this collision became visible.
