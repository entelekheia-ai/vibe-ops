---
vibe-ops-template: log@2
name: guarding-a-fragment-on-plugin-dir-while-globbing-root
description: A shell fragment whose existence guard tests `$PLUGIN_DIR` and whose loop globs `$ROOT`
             reads nothing in every repository layout but one, and reports it as `ok` or as an
             inapplicable `SKIP` — a fragment prints no examined count, so its own output cannot say
             which.
kind: trap
path:
  - "cli/packages/module-check/sh/checks/*.sh"
  - "cli/packages/module-check/sh/check-agents-md.sh"
attempted: 2026-09-01
source: demoted from the workspace learnings base; first measured against dot-agent-spec on 2026-08-14
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Reading a shell fragment's verdict as a reading of the repository

> **Not current truth.** This records what was attempted on 2026-09-01 and what happened then. Check it
> against the present state before acting on it.

## What was attempted

Taking `check-agents-md.sh`'s per-fragment lines at face value — `ok` as "this was checked and is clean",
`SKIP` as "this does not apply here" — and, on that basis, treating a fragment as evidence about the tree
it ran over: to clear a repository being brought to the baseline, and to judge a fragment against its
TypeScript port under the parity bar in
[Plan-022](../plans/022-retiring-a-shell-fragment-its-port-has-replaced.md).

## What happened

`45-skill-frontmatter.sh` reads no skills at all in either layout, and says so in neither.

**In this repository**, `bash cli/packages/module-check/sh/check-agents-md.sh .` prints:

```text
ok    [skill-frontmatter] every skill's frontmatter parses and declares a description
…
17 checks, 0 failed
```

There is no root `skills/` directory here — its 11 skills live in `plugin/skills/` — so the loop
`for skill in "$ROOT"/skills/*/SKILL.md` matched nothing and the pass line was printed unconditionally by
the `problems -eq 0` branch. The port, over the same unchanged tree:

```text
$ node cli/packages/cli/dist/bin.js agents-md --verbose
ok    [skill-frontmatter] 11 examined
```

**In a repository laid out flat** whose skills live under `.agents/skills/` — the convention this plugin
itself ships — the guard `[ ! -d "$PLUGIN_DIR/skills" ]` is true and the fragment reports
`skip … no skills/ directory`, which reads as *inapplicable*. Measured against `dot-agent-spec` on
2026-08-14: ten of seventeen fragments skipped there, and its ported `skill-frontmatter` entry reported
`2 examined` against the same tree.

## The mechanism

Established, and it is one line of the fragment disagreeing with the next.
`check-agents-md.sh` resolves the two roots to different directories whenever the target ships its plugin
from a subdirectory:

```sh
if [ -f "$ROOT/plugin/.claude-plugin/plugin.json" ]; then PLUGIN_DIR="$ROOT/plugin"; else PLUGIN_DIR="$ROOT"; fi
```

Its own comment states the rule the fragment breaks: *a fragment that probes a plugin surface uses
`$PLUGIN_DIR`, and one that probes the repository itself uses `$ROOT`*. `45-skill-frontmatter.sh` guards
on `$PLUGIN_DIR/skills` and iterates `$ROOT/skills/*/SKILL.md`, so the pair is coherent only in a flat
repository that keeps skills at its root. Everywhere else it fails one of two ways — guard true and glob
empty (green over nothing), or guard false (a `SKIP` that blames the repository).

Both outcomes are what [ADR-0011](../adr/0011-population-belongs-to-configuration-not-a-gate.md) and the
[FAQ](../../docs/faq.md) already name: a population that shrank to zero in silence is indistinguishable
from a clean run. What is specific to the fragments is that **a fragment has no `examined` count to read.**
`pass`/`skip`/`fail` is its entire vocabulary, so the check the FAQ prescribes cannot be performed from a
fragment's own output. The ops layer refuses to record an observation over an empty population; the shell
layer has no such refusal.

## What to do instead

- **Give a fragment one root per population.** The guard and the glob that follows it must name the same
  directory. Mixing `$PLUGIN_DIR` and `$ROOT` inside one fragment is legitimate — several do it for two
  genuinely different surfaces — but never for the existence check and the loop of a single population.
- **Get the count from the port, not the fragment.** `node cli/packages/cli/dist/bin.js <ops> --verbose`
  prints `N examined` (and `ignored`) per entry. A fragment line agreeing with a port line means nothing
  until that number is non-zero on both sides — which is Plan-022's first retirement condition, and the
  reason `fragment-parity` is not satisfied by zero divergences.
- **Treat every `SKIP` as a claim owing evidence.** Ask whether the check declined or was pointed at a
  directory this repository does not use, and confirm the population it would have read.
