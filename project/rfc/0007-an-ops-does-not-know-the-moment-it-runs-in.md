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

# RFC-0007: An ops does not know the moment it runs in

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-09-09 |
| Author | Danilo Borges |
| Related | [RFC-0001](0001-gates-and-ops-as-the-cli-unit-of-composition.md) |

---

## Summary

A repository's half of the gate/ops split is three settings — `ignore` changes what was read, `disabled`
changes whether an entry ran at all, and `level` changes whether a finding blocks. All three are answered
once per repository, in configuration, and every caller of `vibe-ops check` receives the same answer.

There is no fourth: nothing in a composition knows *when* it is running. A commit hook, a per-write hook,
a closure ceremony and a release run all invoke the same command and are indistinguishable from inside,
so a finding whose cost depends on the moment cannot express that. The first concrete case is a detector
whose subject changes about once per package and whose remedy needs a person: warning on every commit is
noise, and failing on every commit is how a hook gets switched off, while the same finding at a closure
or before a publish is exactly where somebody can act. A second case already exists in the tree —
`template-version-behind` warns rather than fails because a template bump leaves every record behind at
once, which is right mid-migration and wrong for a repository that has finished one.

This proposes that the moment become declarable, so that levels — and possibly population and emission —
resolve against it, rather than each caller re-deciding by convention or each gate hardcoding one answer.

## Motivation

## Specification

## Rationale

## Implementation Notes

## Open Questions

- Which moments exist, and who names them? Today's callers are a `pre-commit` hook, the `PostToolUse`
  per-write hook, `close-plan` / `close-task`, the release workflow, and a person at a terminal — but
  only some of those are distinguishable to the process being invoked.
- Does the moment reach the ops as configuration, as an invocation flag, or as something the hook
  surface already carries on its payload?
- Does it govern only `level`, or also `ignore` and `disabled` — and if all three, is `settings.<ops>`
  keyed by moment, or does each key gain a per-moment form?
- What is a gate that cannot be asked at every moment? `registry-first-publish` reaches the network, so
  offline it reports a skip rather than a reading, and its own fixture cannot fire — which makes the
  detector self-test network-dependent. A moment axis could confine such a gate to moments where the
  cost is acceptable, but that is a claim this RFC has not yet made.
- Closure is a skill a person invokes, not a hook event: there is no `close` trigger in `hooks.json`
  today. Does this RFC need one, or does the skill pass the moment when it calls the gate?
- Is `--file`'s existing "a per-write reading is a different signal from a repository sweep" rule
  (RFC-0001) the same distinction under another name, and should the two collapse?

## Decisions Closed

## Related

- [RFC-0001](0001-gates-and-ops-as-the-cli-unit-of-composition.md) — the gate/ops split this extends, and
  the source of the rule that population and consequence belong to the composition rather than the
  detector.
