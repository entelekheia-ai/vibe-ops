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

# ADR-0012: A finding's level belongs to configuration, not to the detector that raised it

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-08-11 |
| Deciders | Danilo Borges |
| Related | [ADR-0011](0011-population-belongs-to-configuration-not-a-gate.md), [RFC-0001](../rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md), [Plan-012](../plans/012-versions-travel-with-the-record.md) |

---

## Context

`GateFinding.level` decides whether a finding fails a run or merely warns. It was written by the gate and
read by nothing else: `finding.level ?? "fail"`, with no way for a repository to disagree.

The repository already carried the argument against that, applied to a different field.
[ADR-0011](0011-population-belongs-to-configuration-not-a-gate.md) put **population** in configuration —
`ignore` and `disabled` change *what was read*, which only the composition can decide, and a gate
filtering its own population by a repository-specific rule produced three divergent copies of one
exclusion and thirteen false findings.

`level` is the same argument about a different half. The field's own documentation says it is stripped
before anything reaches the emitter, *because a producer that records a verdict has already done the
consuming product's job for it*. If that reasoning holds for the artifact, it holds for the gate: whether
a rule blocks is a judgement, and judgement belongs to the consumer.

The concrete case that forced it: `template-version-behind` warns rather than fails, because a template
version bump leaves every existing record behind at once and they are migrated one at a time. A gate that
goes red for the whole of that interval is the gate people switch off within the week. But a repository
that has finished its migration should be able to hold the line — and could not, because the word `warn`
was compiled into a detector shared by every repository that loads it.

## Decision

**A finding's level is resolved from the repository's configuration, with the gate's declaration as the
default underneath.**

`GovernedSettings` gains `level`, joining `ignore` and `disabled` as the third thing an ops's settings
slice may carry:

```ts
settings: {
  governance: {
    ignore: { "*": ["**/templates/**"] },
    disabled: { "record-header-rfc": "still migrating" },
    level: { "template-version-behind": "fail" },
  },
},
```

Resolution order, **most specific wins** — deliberately unlike `ignore`, which is additive:

1. the finding's own `rule`
2. the entry's `label`
3. `"*"`, every finding this ops produces
4. the gate's declared `level`
5. `fail`

A gate still declares a level, and that declaration remains meaningful: it is the detector saying what it
believes its finding is worth, which is the right default for a repository that has expressed no opinion.

## Consequences

**A gate can no longer be wrong about a repository it has never seen.** The same detector serves a
repository mid-migration and one that has finished, without either editing it.

**The verdict stays out of the artifact.** `level` is still stripped before emission, and a test asserts it
never appears in an observation — an override changes reporting, never what was recorded. Two runs of the
same gate under opposite `level` settings produce identical observations, which is the property that lets
one observation serve products with opposite requirements.

**A silenced rule is a ledger entry, not a silence.** `disabled` already takes a reason string rather than
a boolean for this purpose. `level` does not, and that is a knowing asymmetry: softening a rule to `warn`
still reports the finding on every run, so it cannot hide the way a disabled gate can. Nothing is
suppressed — only its effect on an exit code.

**Accepted risk: a repository can turn its own gate into a no-op** by setting `"*": "warn"`. That is
visible in a committed config file and reports every finding regardless, which is a different and much
louder failure than a detector that quietly decided on its own that nothing it finds matters.

## Alternatives considered

**Leave the level with the gate, and fork a gate per policy.** Two detectors identical but for one word,
diverging from the first bug fixed in one of them. This is the shape ADR-0011 already rejected for
population.

**Put it in the gate's own `options`, which are free-form.** `options` is *how a gate judges*, validated by
the gate itself — so every gate would invent its own key and its own precedence, and eleven gates would
have eleven spellings of one idea. The whole reason `ignore` and `disabled` are typed in the ops layer is
that a repository-facing setting must not be re-invented per detector.

**A single global severity floor.** Cannot express the real case, which is per-rule: one gate raises four
rules here and only one of them is a distance rather than a defect.

## References

- Implemented in `cli/packages/core/src/ops.ts` (`GovernedSettings`, and the resolution at the finding
  loop), under [Plan-012](../plans/012-versions-travel-with-the-record.md), Track 2.
- Eight tests in `cli/packages/core/test/ops.test.ts` cover the three keys, the precedence, and that an
  override never reaches an emitted observation.
