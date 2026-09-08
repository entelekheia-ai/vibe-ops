---
vibe-ops-template: plan@3
---

# Plan-038: Concluding the fragment migration, and the measurement that leaves with it

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-09-07 |
| Author | Danilo Borges |
| Depends on | Plan-022 (the retirement bar), Plan-037 (the eleven fragments become gates) |

---

## Context

Every one of the seventeen shell check fragments under
`cli/packages/module-check/sh/checks/` now has a TypeScript counterpart — sixteen gates in
`cli/packages/gates/src/` and one node test at `cli/packages/harness/test/nudge-behaviour.test.ts`.
Plan-037 shipped the last of them and deliberately deleted nothing, because removing a fragment
before its port is shown to agree with it is how coverage disappears in silence.

Plan-022 wrote the bar for removing one: parity must have run over a corpus wide enough to exercise
the check, must never have reported a divergence, and **the port must fail on a fixture built to
break it**. That bar has never been applied, because the machinery to observe it does not exist.
Two holes:

1. **Only four of the seventeen fragments have a `fragment-parity` entry** — the four in
   `cli/packages/ops-mirror/ops.json` (`links`, `frontmatter`, `skill-frontmatter`, `memory-slugs`).
   For the other thirteen there is no comparison at all, so conditions 1 and 2 have no evidence.
2. **The two self-tests read disjoint corpora.** `check-agents-md.sh --self-test`
   (`cli/packages/module-check/sh/check-agents-md.sh:345-424`) builds one deliberately broken fixture
   and asserts fourteen shell ids fire on it; each ops declares per-entry fixtures
   (`OpsFixture`, `cli/packages/core/src/ops.ts:94-101`) that only the gates see. Neither side is
   ever shown the other's fixture, so condition 3 — the one that separates agreement from two
   implementations both looking at nothing — is measured by nothing, for any pair.

The intended outcome is that the migration ends: the shell fragments are deleted, `vibe-ops check`
is the whole gate, and the parity apparatus is deleted in the same act rather than surviving as
permanent scaffolding for a thing that no longer exists.

## Summary

Complete the comparison across all seventeen fragments, make agreement mean something by running one
shared fixture through both sides, then delete the fragments, the shell runner and the parity
apparatus together. The measurement is deliberately built where it dies — inside the shell runner's
own `--self-test` — so that removing the runner removes the measurement, instead of leaving a CLI
verb whose subject has left the repository.

## Goals

1. Every fragment either has a `fragment-parity` entry comparing it against its port, or a written,
   mechanically-checked exemption saying why it can never have one.
2. For every compared pair, both sides have been made to fail on one shared fixture — agreement is
   evidence rather than a coincidence.
3. A parity entry that compared nothing says so, instead of reporting agreement over an empty corpus.
4. `scripts/check.sh` runs `vibe-ops check` and nothing else; `sh/checks/`, `check-agents-md.sh`, the
   `fragment-parity` gate and all its entries are gone from the tree.
5. The consumer contract change — the commit gate now requires Node — is stated where a consumer
   reads it, not discovered on a broken pre-commit.

## Scope

### In scope

The seventeen fragments, their ports, the comparison between them, the shared fixture that makes the
comparison evidence, and the deletion of everything on the shell side once the bar is met — including
what `plugin/skills/setup/` copies into a target repository.

### Out of scope

**Rewriting any port.** Except where a port is incomplete and retirement would lose coverage
(Track 1), no gate's detection changes here. Improving a detector is a separate act from proving it
replaced something.

**The workspace's own consumers.** Sibling repositories under the entelekheia root resolve the runner
out of this checkout via `scripts/checks/_run.sh`; updating each of them is follow-on work in that
workspace, not a track here. This plan changes what vibe-ops ships and says so.

## Design

### Where the measurement lives, and why there

`fragment-parity` (`cli/packages/gates/src/fragment-parity/index.ts`) is already designed to be
temporary — it holds no repository knowledge, taking `{runner, fragment, against, options?}` from the
composition, which its own header says is "what lets this gate leave the repository the day its
`fragment` does". But it leaves by explicit removal, not by following the shell out.

The new half — the shared fixture — is therefore built into `self_test` in
`cli/packages/module-check/sh/check-agents-md.sh`, not as a new CLI verb or a new gate. The fixture it
needs already exists there. `git rm` of the runner takes the assertion with it, and there is no
surface left over whose subject has gone.

This reverses one earlier decision knowingly: `cli/packages/module-check/src/index.ts:248-272`
chains the ops self-tests in TypeScript rather than in the shell script, on the grounds that the
runner is what a consumer installs as `pre-commit` and must run Node-free on a bare checkout. That
constraint is retired by this plan's own first move — `scripts/check.sh` becomes a wrapper on
`vibe-ops check`, so Node is required either way — and the runner is being deleted regardless, so
what it depends on in its final months costs nothing.

### The two-sided fixture

```mermaid
flowchart LR
  F[the one broken fixture\ncheck-agents-md.sh self_test] --> S[the shell runner\nover the fixture]
  F --> P[vibe-ops check\nover the same fixture]
  S --> A{did FAIL '[id]' appear\nfor every composed fragment?}
  P --> B{did every port's rule\nappear for that fragment?}
  A -->|no| X[SELF-TEST FAILED\nthe fragment stopped detecting]
  B -->|no| Y[SELF-TEST FAILED\nthe port never looked]
  A -->|yes| Z[both sides made to fail\non purpose, on one input]
  B -->|yes| Z
```

`self_test` today builds the fixture at `$tmp`, runs the runner over it, and asserts fourteen ids
appear as `FAIL  [<id>]` (`check-agents-md.sh:426-446`), plus exact-count and decoy assertions
(`:449-533`). The addition is one more spawn over the same `$tmp` — `vibe-ops check "$tmp"` — and one
assertion per pair that the port's rule name appears in its output. The pair table (fragment id →
port rule) lives in the runner beside the existing id list, because that is the file being deleted.

The environment isolation already in place (`:322-343` unsets `VIBE_OPS_PRIVATE_LAYER`,
`VIBE_OPS_DISABLED_CHECKS` and `GATE_ARTIFACT_DIR`) covers the new spawn too, and must: a fixture
judged against an operator's declared disablements proves nothing on either side.

### Completeness, asserted rather than remembered

A parity table maintained by hand is a list of the pairs someone remembered. The set is closed with a
`mirror` entry using the gate's existing `compare: "group"` mode — left is the fragment ids the
runner's own `--list` prints (`report_composition`, `check-agents-md.sh:190-200`), right is the
`fragment` option of every `fragment-parity` entry plus a short declared-exemption list. A fragment
with neither is reported. No new gate: `mirror` already does exactly this shape of comparison, and the
entry is deleted with the rest.

### The hole to watch

`fragment-parity` compares **sets of file paths** — the files the fragment flagged against the files
the port's findings name (`index.ts:86-99`). For several of the thirteen unwired pairs the two sides
do not name the same file: a `mirror` group comparison reports the document that referenced a missing
target, where the shell fragment may report the target. Where the two are structurally
incomparable by path, the entry must be declared an exemption with the reason, never wired up to
produce silent agreement — that is the exact failure the gate's own header was written about.

## Tracks

- [x] **Track 1 — Close the two port gaps.** Two fragments were not honestly ported.
      `15-manifest-sync.sh` had **zero** of its four comparisons composed anywhere — Plan-037's own
      open question said one field pair was composed, and it was not; the only place that shape
      existed was a unit test proving the gate's *capability*, never wired into
      `cli/packages/ops-mirror/ops.json`. `27-nudge-behaviour.sh` became a node test
      (`cli/packages/harness/test/nudge-behaviour.test.ts`), which `fragment-parity` cannot compare
      against at all — its `against` option resolves a gate, and a node test is not one. At the end
      each has either a port a parity entry can name, or a written exemption stating what is
      deliberately not compared and what still covers it. Acceptance: no fragment is retired later on
      the strength of a port that does less than it did.

- [ ] **Track 2 — One parity entry per comparable pair.** Add the thirteen missing
      `fragment-parity` entries to `cli/packages/ops-mirror/ops.json`, each naming its fragment, its
      port and the port's options, and add the `mirror` completeness entry that fails when a composed
      fragment has neither an entry nor an exemption. Pairs found structurally incomparable by file
      path become declared exemptions with their reason, not entries. At the end every fragment is
      accounted for by machine. Acceptance: `vibe-ops mirror --verbose` names both versions
      (`instrument`) for every wired pair, and deleting one entry fails the completeness check.

- [ ] **Track 3 — The shared fixture, both sides.** Extend `self_test` in
      `cli/packages/module-check/sh/check-agents-md.sh` to run `vibe-ops check` over the same `$tmp`
      fixture and assert each port's rule fires there, alongside the existing per-fragment
      assertions. At the end agreement between a fragment and its port is evidence: both have been
      made to fail on purpose, on one input. Acceptance: removing a detection line from any wired
      port makes `--self-test` fail naming that port.

- [ ] **Track 4 — A comparison over nothing is not a comparison.** `fragment-parity` today returns a
      clean result when it examined zero files. Make it return `skipped` naming the empty population,
      the way `classification` and `mirror` already do
      (`gates/src/classification/index.ts:122`, `gates/src/mirror/index.ts:279`). At the end
      Plan-022's corpus-width condition is readable from the run rather than inferred from
      `data.population`. Acceptance: an entry scoped to a path this repository does not have prints
      `SKIP` naming why, and never `ok`.

- [ ] **Track 5 — The consumer contract moves to Node.** `plugin/skills/setup/templates/harness/check.sh`
      and the target's `scripts/check.sh` stop composing fragments and call `vibe-ops check`;
      `plugin/skills/setup/SKILL.md:349` stops copying `sh/checks/` into a target. Retire the
      "Node-free and standalone" claim in `cli/AGENTS.md` and state the new requirement in
      `README.md` and the setup skill. At the end a consumer reads the requirement before hitting it.
      Acceptance: a fresh `setup harness` into a scratch repository produces a working pre-commit that
      never references a fragment.

- [ ] **Track 6 — Delete the shell side.** For every fragment whose three conditions hold, remove the
      fragment; then remove `cli/packages/module-check/sh/` entirely, the `fragment-parity` gate
      folder, all its entries and the completeness entry, and the pair table in the runner. Record in
      this plan what the pairs were for. At the end the checks exist once. Acceptance: `npm test` and
      `vibe-ops check --self-test` are green, `git grep -n fragment-parity` returns nothing outside
      `project/`, and reintroducing a defect each retired fragment used to catch still fails the run.

- [ ] Run `/vibe-ops:close-plan` — retrospective against the goals, the demotion check, and the check
      for whether Plan-022 is now fully discharged. The plan file itself is kept.

## Success criteria

Run from the repository root:

- `node cli/packages/cli/dist/bin.js check --self-test` is green, and stays green only while every
  port still detects: deleting one detection line from any port makes it fail naming that port.
- `git grep -rn "sh/checks" -- ':!project/'` returns nothing; `cli/packages/module-check/sh/` does not
  exist.
- `git grep -rn "fragment-parity" -- ':!project/'` returns nothing.
- `npm test && npm run typecheck` from the workspace root are green after a from-scratch build
  (`rm -rf cli/packages/*/dist && npm run build`).
- A scratch repository set up with `/vibe-ops:setup harness` commits successfully with a pre-commit
  that calls `vibe-ops check`, and rejects a commit introducing a defect one retired fragment used to
  catch.

---

## Decision Log

- Decision: the parity measurement is built inside `check-agents-md.sh --self-test`, not as a new CLI
  verb or gate.
  Rationale: the measurement's subject is the shell suite, so it must leave when the suite does.
  A verb in `cli/` outlives its subject and becomes scaffolding for a thing that no longer exists.
  Date / Author: 2026-09-07 / Danilo Borges

- Decision: `scripts/check.sh` becomes a thin wrapper on `vibe-ops check`, retiring the "Node-free
  and standalone" invariant in `cli/AGENTS.md`.
  Rationale: the fragments are the only reason the runner could work without Node, and they are being
  deleted. Keeping a Node-free path after they go means keeping a second implementation of the gate.
  Date / Author: 2026-09-07 / Danilo Borges

- Decision: Plan-022's Track 3 — retiring the one eligible fragment — is absorbed here rather than run
  separately.
  Rationale: Plan-022 wrote the bar and scoped itself to the single fragment already eligible. This
  plan applies the same bar to all seventeen; running the singular track first would retire one
  fragment under machinery the other sixteen still lack.
  Date / Author: 2026-09-07 / Danilo Borges

- Decision: discovery and the thirteen mechanical `ops.json` entries may be handed to a subagent;
  deciding that a pair is structurally incomparable, and deciding that a fragment may be deleted, may
  not.
  Rationale: the entries are a closed contract with an existing shape to copy. The judgement that
  ends with a check silently gone is the one that must not be delegated — carried over verbatim from
  Plan-022's own decision log.
  Date / Author: 2026-09-07 / Danilo Borges

- Decision: `mirror` gained a `jsonSelect` source (an array entry chosen by matching a field against a
  value read from a separate file) and an `optional` flag on `capture`, to close `15-manifest-sync.sh`'s
  gap honestly rather than writing an exemption for it.
  Rationale: three of the fragment's four comparisons need the marketplace listing selected by the
  plugin's own name — hardcoding an index, as Plan-037's open question warned, would pass silently the
  day the plugin is renamed. The fourth (CHANGELOG heading vs. `plugin.json` version) must not fire
  while a repository has never cut a release, which is `mirror`'s existing `capture`+absent path
  turned into an unconditional finding; `optional` is the minimal change that lets an anticipated
  absence be nothing rather than drift. Both are small, general (not manifest-sync-specific), and
  tested in isolation (`cli/packages/gates/test/mirror.test.ts`) before being composed.
  Date / Author: 2026-09-07 / Danilo Borges

- Decision: `15-manifest-sync.sh` is now fully ported — four `mirror` entries in
  `cli/packages/ops-mirror/ops.json` (`manifest-version`, `manifest-description`, `manifest-keywords`,
  `manifest-changelog-version`) — but gets no `fragment-parity` entry; it is a declared exemption from
  that specific comparison, not from the port itself.
  Rationale: `fragment-parity` compares SETS OF FILES the two sides flagged
  (`cli/packages/gates/src/fragment-parity/index.ts:54-61` parses `FAIL  [<id>] <file>: message`).
  `15-manifest-sync.sh`'s own `fail` calls carry no `<file>:` prefix at all — its messages describe a
  field, not a file — so `failedFilesFor()` can never extract anything from them; the comparison is
  structurally impossible, not merely unwired. Verified live: all four new entries report `ok` against
  this repository's own `plugin.json`/`marketplace.json`/`CHANGELOG.md`, which already agreed.
  Date / Author: 2026-09-07 / Danilo Borges

- Decision: `27-nudge-behaviour.sh` is also a declared exemption from `fragment-parity`, on different
  grounds — the port is a node test, not a resolvable gate.
  Rationale: `fragment-parity`'s `against` option is loaded with `loadGate()`
  (`cli/packages/gates/src/fragment-parity/index.ts:97`), which resolves a `GateDefinition`; a
  `node:test` file exposes no such thing and is never composed into any ops. Coverage was compared by
  hand: the node test's six assertions (first-Stop silence, one-plan-newest, no self-rename, no
  re-arm-by-compliance, sibling-repo isolation with an exact count, cross-repo settling surviving a
  detour, and the four-field firing log) match the shell fragment's five numbered assertions plus its
  log check line for line — the port does not do less than the fragment. This closes the plan's
  open question: a test that provably covers the same ground as the fragment satisfies the bar,
  because the bar (Plan-022) is about proving agreement, and there is nothing here to compare against
  a fixture a second time — `npm test` already does that on every run.
  Date / Author: 2026-09-07 / Danilo Borges

## Outcomes & Retrospective

Track 1 is closed. `npm test` (643/643) and `npm run typecheck` are green. Neither exemption is yet
mechanically enforced — Track 2 adds the completeness entry that will read them.

---

## Related

- `project/plans/022-retiring-a-shell-fragment-its-port-has-replaced.md` — the bar this plan applies.
- `project/plans/shipped/037-the-eleven-fragments-become-gates.md` — the ports this plan retires
  behind.
- `project/plans/035-the-audience-boundary.md` — the fragment classification (17 fragments, 7
  portable, 10 internal).
- `project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md` — the gate/ops split.
