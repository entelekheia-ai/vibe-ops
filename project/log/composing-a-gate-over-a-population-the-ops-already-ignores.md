---
vibe-ops-template: log@2
name: composing-a-gate-over-a-population-the-ops-already-ignores
description: A gate added to an ops whose `ignore` blankets its population under `"*"` reports `0 examined` and passes; the exclusion belongs to the entry that needs it, not to the ops.
kind: trap
path:
  - "vibeops.config.*"
  - "cli/packages/ops-*/src/index.ts"
attempted: 2026-08-13
source: Plan-024, Track 8
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Adding a gate to an ops whose `ignore` already excludes the files that gate exists to read

> **Not current truth.** This records what was attempted on 2026-08-13 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Composing `unstated-destination` — a gate whose subject is the migration notes — into the `self` ops,
which reads prose describing this repository's own machinery. The entry declared
`paths: ["<plugin>/skills/migrate/migrations/*.md"]`, which is where those notes live.

## What happened

The run reported `ok [unstated-destination] 0 examined, 7 ignored` and the ops passed. Every note was
removed from the population before the gate saw it, by the ops's own `ignore` in `vibeops.config.ts`:

```ts
self: { ignore: { "*": ["plugin/skills/migrate/migrations/**", …] } }
```

A green line, an entry composed, a gate that read nothing. The run reports `ignored` beside `examined`
precisely so this is visible — but only to someone reading the numbers rather than the verdict.

## The mechanism

`ignore` is additive and has no negation, so an entry cannot opt out of a `"*"` line. The exclusion was
correct when it was written: the notes are `template-heading-drift`'s **source**, and a source is not a
document to be corrected. It becomes wrong the moment a second entry takes the same files as its
**subject**, and nothing about adding that entry surfaces the older decision.

## What to do instead

Scope the exclusion to the label that needs it, leaving `"*"` as the safe default for everything else:

```ts
self: {
  ignore: {
    "template-heading-drift": ["plugin/skills/migrate/migrations/**"],
    "*": [ /* everything that really is true of every entry */ ],
  },
}
```

Then check the number, not the verdict: the new entry must report a non-zero `examined`, and the existing
one must report the same count it did before. Here that was 7 and 66 respectively.

The heavier fix — a separate ops — is right when the two entries disagree about the *whole* exclusion
list rather than one line of it; that is why `self` exists apart from `governance`. One path is not that.
