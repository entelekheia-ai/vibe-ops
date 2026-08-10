<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

<!-- vibe-ops-template task@0.2 — KEEP THIS LINE. /vibe-ops:migrate reads it to find artifacts written
     against an older template. Removing it makes this file invisible to migration. -->

# Task: The governance ops, and the population contract under it

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-08-10 |
| Author | Danilo Borges |
| Issue | none |
| Plan | plans/010-the-document-model-under-the-gates.md — Tracks 5 and 6 |

<!-- Status lifecycle: Planned → In Progress → Done → (dossier removed; git history is the archive) -->

---

## Context

The last task of Plan-010: Track 5 (frontmatter for the record types), Track 6 (the ops that composes
everything), and the plan's own closure.

Sizing Track 6's acceptance — "a clean run on this repository" — meant running the Track 3 and Track 4
gates the way an ops actually would, over every tracked markdown file rather than a hand-filtered list.
They were **not** clean: 14 findings, all false. Both defects shipped in the previous task and both were
hidden by the same thing — that task's corpus probe excluded `plugin/skills/*/templates/` by hand, which
neither gate does.

So this task is not two tracks. It is two tracks plus the population contract that should have been
there before either gate was composed, because the rule those false positives come from currently exists
in three divergent copies and writing a fourth copy inside a third gate would extend the pattern rather
than end it.

Track 5 also turned out to rest on two false premises, both measured below: the records do not carry
YAML frontmatter at all, and one of the four types it names has nothing to check against.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `ignore` and `disabled`: the population contract, in config | L |
| 2 | P0 | The two false positives the link and reference gates ship with | S |
| 3 | P0 | `gates/record-header/` — Track 5 | M |
| 4 | P0 | `gates/fragment-parity/` — Track 6's comparison | M |
| 5 | P0 | `ops-governance/` — the composition | M |
| 6 | P1 | The documents this task makes false | S |
| 7 | P0 | Close Plan-010 | S |

### 1. `ignore` and `disabled`: the population contract, in config — P0

**What:** two keys the core owns, typed and honored by `defineOps`, declared per repository rather than
compiled into any gate:

```ts
settings: {
  governance: {
    ignore: {
      "*": ["**/templates/**"],              // every entry in this ops
      "markdown-link": ["docs/vendor/**"],   // additionally, just this one
    },
    disabled: { "record-header": "records still migrating" },
  },
},
```

**Why:** a signal's identity includes the population it was read over (RFC-0001), so population may not
be free-form. If each gate carries its own exclusion, an emitted series changes meaning with nothing
declared anywhere. That is not hypothetical here — the same `/templates/` rule is written three
different ways today, and the copy that is *missing* is worth 13 false findings.

Behaviour is the opposite case and stays where it is: only a gate can validate `schema: "adr"`, and
choosing a schema does not change what was examined. The split already exists on `OpsGateEntry` as
`paths` (the core understands it; it shapes the population) versus `options` (free-form; the gate
validates it). `ignore` and `disabled` are the missing siblings of `paths`, not new inhabitants of
`options`.

The asymmetry between `paths` living in the composition and `ignore` living in configuration is
deliberate: **the ops declares what it is about; the repository declares what does not apply to it.**
`**/templates/**` matters here only because this repository publishes a plugin that ships templates —
that is a fact about the repository, not about the composition.

**Change:**

- The per-ops settings slice gains `ignore` and `disabled`, typed in `cli/packages/core/`.
- `defineOps` applies `ignore` where it already narrows — the `filterByGlobs(files, patterns)` step —
  subtracting the entry's own globs plus those under `"*"`. `filterByGlobs` has no negation syntax, so
  this is a subtraction at the call site rather than a pattern the ops could have declared.
- **`disabled` takes a reason string, never a boolean.** The shell runner already carries this doctrine
  as `VIBE_OPS_DISABLED_CHECKS` with `id:reason` pairs, and states it in its own header: a declared
  disablement is a ledger entry, never a silent pass. A boolean would let a check be switched off
  leaving nothing to grep for.
- **A disabled gate reports `SKIP` naming its reason** — never silently absent, never counted green.
- **The run reports `ignored` beside `examined`.** A population that shrinks in silence is exactly the
  defect `examined` already exists to prevent: 13 findings becoming 0 must not read as a repair.
- **`SKIP` moves behind `--verbose`**, joining the `ok` line that is already gated that way and matching
  the shell runner, which filters `SKIP` out of a non-verbose run. Measured before proposing it: the one
  test asserting a `SKIP` line already runs with `verbose: true`, so it passes unchanged.
- **Delete `memory-slug`'s hardcoded `/templates/` filter** and declare it in configuration instead.
  This is a demotion — an instruction encoded in gate code that a mechanism now makes redundant — and it
  is available immediately rather than at closure.

### 2. The two false positives the link and reference gates ship with — P0

**What:** the 13 template findings from `markdown-link` and the one bare-prefix finding from
`breadcrumb`.

**Why:** Track 6's acceptance is a clean run, and today the composition would produce 14 findings that
are all noise. Neither is a detection fault. `markdown-link` is *correct* that the link does not resolve
here; the point is that a template's links are written to resolve in the target repository, so this
repository is not the one they answer to.

**Change:** the first needs **no gate code at all** — item 1's configuration entry removes it, and that
it does is the evidence item 1 has the right shape.

The second is a real gate fix. `breadcrumb` treats any code span starting with `git show ` as an
attempted reference and excludes only text containing `<`. Require **a colon and no `<`**: a passing
mention such as the bare prefix has no colon, a documentation placeholder has `<`, and a real reference
has a colon and no `<`. To be verified against every occurrence in the corpus and against the existing
fixtures, including the short-sha case that must still report `malformed`.

### 3. `gates/record-header/` — Track 5 — P0

**What:** a new gate reading the block layer's header table — **not** a third schema on
`check-frontmatter`.

**Why:** the two guarded surfaces today are the ones a *machine* parses, and both guards exist because a
machine broke on them. The records are read only by people and agents, so no breakage ever forced a
guard; sensor placement has followed tool failure rather than how load-bearing the field is.

`check-frontmatter` was built so a third type would cost a schema rather than a fragment, and that
promise holds when types differ in *which fields they require*. These differ in *where the fields live*:
the gate reads YAML frontmatter and never touches the model, while a record carries an ordinary markdown
table. Reporting a table fault under the rule name `frontmatter` would name something the file does not
have and never should, against the contract that a finding's `rule` names the failure mode.

**Change:** take the first `pipe_table` reached before the first level-2 heading. Measured over all 28
documents under `project/`, that discriminator yields 21 header tables and 7 correct misses with no
misfires, where "the first `pipe_table`" instead returns a body table in 4 of the 5 research documents.
Read each row's first cell as the key, then require the type's fields:

| Schema | Required | Optional — never demanded |
|---|---|---|
| `adr` | `Status`, `Date`, `Deciders` | `Supersedes`, `Superseded by` |
| `plan` | `Status`, `Created`, `Author` | `Depends on`, `Tracking issue`, `Related` |
| `rfc` | `Status`, `Created`, `Author` | `Depends on`, `Related` |
| `task` | `Status`, `Created`, `Author`, `Issue` | `Plan` |

**Presence only; the value is not validated.** A status vocabulary exists, but it lives in prose in the
governance rule, and reading it mechanically is a separate act with its own scope.

**Research gets no schema.** Track 5 names it, and it has nothing to check against: no template, no
record reference, the governance resolver rejects the type outright, the skill that would create such
documents is still in the backlog and describes itself as a placeholder, and none of the five existing
research documents carries a header table. Defining one here would settle a shape no record has agreed
on — the same act Track 4 already refused for the reference form. Deferred to the plan that owns it,
with this reason recorded.

Acceptance: this repository's own 21 records pass, and a deliberately stripped copy of each fails.

### 4. `gates/fragment-parity/` — Track 6's comparison — P0

**What:** a gate that runs a shell fragment and the gate that ports it, and reports only what the
fragment saw and the port did not.

**Why:** the shell suite is still the real gate — the commit hook runs it, and the ops runs beside it —
and a fragment is removed only once the pair is shown to agree (RFC-0001). Nothing crosses the two lists
today: the shell speaks during a commit, the ops speaks when run by hand, and no one compares them.

The previous task nearly shipped precisely that failure. Without the supplement queries, the link gate
would have seen 83 fewer links than its fragment, and because the repository has no broken link both
sides would have printed zero — agreement in appearance, over a hole.

Track 6 asks the ops to carry this comparison, but `defineOps` is purely declarative and has no seam for
custom logic. Making it a gate needs no change to any existing contract, generalizes to the other five
ports by changing its options, and leaves the repository when the fragment does.

**Change:** the gate holds no repository knowledge; the composition passes it in.

```ts
{ gate: "fragment-parity",
  options: { runner: "cli/packages/module-check/sh/check-agents-md.sh",
             fragment: "links", against: "markdown-link" } },
```

It spawns the runner, parses its `FAIL  [<fragment>]` lines, resolves `against` through the existing
`loadGate`, runs it **with its own context** so both sides walk the same population, and reports the
fragment-only difference as `port-regression`. The gate-only direction is expected and is deliberately
not a finding. Costs about two seconds and does not touch the commit path, which runs the shell runner
directly rather than through an ops. It reports zero today by construction — its value is the day
someone edits the port.

### 5. `ops-governance/` — the composition — P0

**What:** a third module beside `check` and `agents-md`.

```ts
export default defineOps({
  id: "governance",
  version: "0.0.1",
  summary: "The governance surface: records, links and archival references",
  gates: [
    { gate: "record-header", paths: ["project/adr/*.md", "project/rfc/**/*.md",
                                     "project/plans/*.md", "project/tasks/*.md"] },
    { gate: "markdown-link", emits: true },
    { gate: "breadcrumb",    emits: true },
    { gate: "fragment-parity", options: { /* as above */ } },
  ],
});
```

**Why these two emit:** `markdown-link` and `breadcrumb` are recurrent and outlive this plan — links rot
as files move, and every task closure adds another archival reference that a rewritten history can
break. `record-header` is structural: once a record has a `Status` it keeps it. `fragment-parity` is
temporary by construction, and a series that dies with its subject is one nobody reads.

**Change:** add the module to `BUILTINS` and to this repository's own configured module list.
Acceptance is `--list` naming every gate with its paths, and a clean run — which items 1 and 2 are what
make possible.

### 6. The documents this task makes false — P1

The CLI's `AGENTS.md`: the gates row gains the two new gates; a new row for the ops package; and — the
one that matters most — **the Configuration section gains the `ignore` / `disabled` definition**, since
that is the fact a reader needs before assuming a gate's population is whatever its `paths` say. The
CLI's `README.md` gains the third command and the new packages.

### 7. Close Plan-010 — P0

Tick Tracks 5 and 6, then run `/vibe-ops:close plan`: the retrospective written against the plan's own
Goals and Success criteria one at a time, the demotion check, living docs propagated, **the file kept**.

Two things belong in that retrospective and will be lost if it is written from memory. Goal 5 was met by
a route the plan did not anticipate — a gate, because the ops contract had no seam for it. And Track 3's
acceptance predicted a specific direction of divergence that the measurement contradicted; a criterion
is a prediction, and recording which way it was wrong is worth more than quietly editing it.

## Implementation order

- [x] P0 — `ignore` + `disabled` in the core, `SKIP` behind `--verbose`, `ignored` reported alongside
      `examined`, and `memory-slug`'s hardcoded filter deleted (item 1). Sensor confirmed: the 13
      `markdown-link` findings go to zero with no change to that gate's own code — only a config entry.
- [x] P0 — `breadcrumb`'s bare-prefix false positive (item 2). Fixed by requiring a colon in addition to
      the existing `<`-exclusion.
- [x] P0 — `gates/record-header/` and its test (item 3). Shipped with a `task` schema in addition to the
      three named in the work item — see Surprises.
- [x] P0 — `gates/fragment-parity/` and its test (item 4).
- [x] P0 — `ops-governance/`, `BUILTINS`, and the configured module list (item 5). Shipped as four
      separate `record-header` entries (one per schema, each labelled), not the single combined entry
      the work item's own illustrative snippet showed — the snippet omitted `options.schema`, which
      each type actually requires.
- [x] P1 — The documents (item 6).
- [x] P0 — Tick Tracks 5 and 6 in Plan-010, then run `/vibe-ops:close plan` (item 7).

Verification, from the npm workspace root:

```bash
npm run build
npm run typecheck
npm test
sh cli/packages/module-check/sh/check.sh          # 17 checks, still 0 failed
node cli/packages/cli/dist/bin.js governance --list
node cli/packages/cli/dist/bin.js governance      # must be clean
```

Done when `npm test` passes; `governance` reports a clean run over this repository with `ignored`
visible rather than implied; each new gate fires on a fixture carrying one of each failure mode and
stays silent on a clean one; a gate declared `disabled` reports `SKIP` with its reason rather than
passing; and Plan-010 is closed with its file kept.

## Surprises & Discoveries

Five entries exist before the work starts, all found while sizing it — the rest is filled while the work
happens; reconstructed at the end it is worthless.

- Observation: both gates from the previous task report false positives the moment an ops runs them over
  the whole repository, and that task's own measurement missed it because the probe filtered by hand
  what the gates do not.
  Evidence: over all 94 tracked markdown files, `markdown-link` reports 13 findings across 5 files under
  `plugin/skills/*/templates/`, and `breadcrumb` reports 1. The previous task's corpus probe passed a
  list already filtered on `/templates/`, so it examined 72 files and reported 0 — a clean result
  produced by the harness rather than by the gate.

- Observation: the `/templates/` exclusion exists in three divergent copies, and the divergence *is* the
  defect — a fourth copy inside `markdown-link` would have matched the pattern rather than ended it.
  Evidence: the shell runner's `tracked_md()` greps `/templates/` out; `memory-slug` filters it in gate
  code with `if (file.includes("/templates/")) continue;`; `markdown-link` has no filter at all. And
  `filterByGlobs` has no negation syntax, so the exclusion could not have been declared in the ops's
  `paths` either.

- Observation: the fix for one false positive introduced another, inside the sentence describing that
  fix.
  Evidence: `breadcrumb` excludes an attempted reference containing `<`, which cleared the 7 placeholder
  mentions found in the previous task. A line written during that same closure contains the code span
  `` `git show ` `` — the bare prefix, no sha, no colon, no `<` — so it matches the trigger, fails the
  pattern, and is reported as malformed.

- Observation: a document's *first* `pipe_table` is not its header table, and the naive reading goes
  wrong in exactly the folder Track 5 intended to add a schema for.
  Evidence: over the 28 documents under `project/`, "the first `pipe_table` reached before the first
  level-2 heading" yields 21 header tables and 7 correct misses with 0 misfires. "The first
  `pipe_table`" instead returns a body table for 4 of the 5 research documents — one of them at line 90,
  whose own first column is literally `Field`.

- Observation: research is not a governance record type in this repository's tooling at all, so Track
  5's fourth schema had nothing to validate against.
  Evidence: the governance resolver accepts `adr|rfc|plan|task` and exits non-zero on anything else;
  there is no research template and no research record reference; the plan that would create the skill
  is in the backlog and opens by calling itself a deliberately thin placeholder; and 0 of the 5 existing
  research documents carry a header table.

- Observation: a `GateFinding.rule` set to the gate's bare id, when one gate is composed under several
  labels distinguishing a schema, makes the FAIL line ambiguous even though the ops's own log lines
  (`ok`/`SKIP`) print the label.
  Evidence: with `record-header`'s `rule` hardcoded to `"record-header"`, all four schema entries
  (`adr`/`plan`/`rfc`/`task`) produced identical `FAIL  [record-header] …` lines — the ops log format
  (`ops.ts`) prints `finding.rule`, not the composing entry's label, for the FAIL/WARN line specifically,
  unlike the `ok`/`SKIP` lines which do print the label. Fixed by setting `rule` to
  `record-header-${schema}`, matching the precedent `check-frontmatter` already set (`rule: "frontmatter"`
  vs `"skill-frontmatter"`) for the same reason.

- Observation: this task's own illustrative composition snippet (`{ gate: "record-header", paths: [...four
  types...] }`, no `options.schema`) could not have shipped as written — `record-header` requires a schema
  per type, and the four types need different required fields.
  Evidence: `cli/packages/gates/src/record-header/index.ts` throws if `options.schema` is absent or not
  one of `adr`/`plan`/`rfc`/`task`. The composition shipped as four separate entries instead, each with
  its own `paths` and `options.schema`, each individually labelled — see `ops-governance/src/index.ts`.

## Closure

- [x] Run `/vibe-ops:close task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
