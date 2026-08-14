# Research — how much of the ownership boundary promulgation actually delivers

Feeds the decision about what to build after the harness module's tracks closed.

**The answer.** The promulgation mechanism is complete and the payload it carries is a seventh of the
boundary it claims to govern: `vibe-ops harness sync` writes 1 of the 7 `norm` entries in
`plugin/ownership.json` and none of the 10 `seed` entries. The distance between *promulgation exists* and
*promulgation is how repositories receive their governance* is one function, not an architecture.
Confidence **high** — both counts come from reading the declaration and running the code, not from
inspection.

> **Attribution.** There is no external source in this investigation. **Everything below is our own
> measurement**, taken by executing this repository's own code against its own checkout.

## Terms

- **The norm** — the set of files this tooling is the author of: the governance templates, the record
  lifecycle rule, and the wiring that composes the commit gate.
- **Promulgation** — writing a version of the norm into a target repository, implemented as
  `vibe-ops harness sync`.

## Coverage is one entry in seven

`plugin/ownership.json` declares 7 `norm` entries, 10 `seed` and 5 `repo`. `sync` writes exactly one
`norm` entry — `project/templates/{adr,rfc,plan,task,log}.md`, which expands to five files — and nothing
from `seed`.

The six undelivered `norm` entries are the record lifecycle rule, the `CLAUDE.md` import shim, the
`.claude/rules/*` bridge symlinks, the manual gate entrypoint, the gate runner, and the commit hook. Every
one is a path this tooling claims authority over and does not write.

This is not a defect in the machinery. The branch, the tag, the staged-content verification and the
boundary consent all work against whatever the content function returns; the gap is in that function.

**Two of the six cost more than the other four and should be costed before being promised.**

The bridge entries are symlinks. Writing a symlink through a linked working tree is not writing a file,
and the mode bit is precisely what the `bridge` gate reads — a copy that looks correct and is not is the
failure that gate exists to catch. Promulgating them needs its test before it needs its code.

The commit hook is one write, but making git *use* it is `git config core.hooksPath`, which is clone-local
configuration no clone inherits, and which
[ADR-0007](../adr/0007-license-enforcement-writes-no-git-config.md) already constrains. Promulgation
writing git config is a decision, not an implementation detail.

## User documentation behaves as a defect sensor

Three defects in the harness module were found by writing its user documentation rather than by
exercising its code. None appeared in a 447-test suite or in a 17-check gate. The pattern is the finding;
the three cases are its evidence.

Each surfaced from a sentence asserting an effect in the user's voice, which is then immediately
checkable: *"and this is what lets `status` answer next time"* was false, because the verb recorded the
consent it had been given and never the versions it had applied — so a freshly promulgated repository went
on reporting that it had never been promulgated to. The other two were an argument-handling declaration
absent from a module whose subject is a repository, and a written state file covered by no ignore rule.

The proposed explanation: task documentation forces the effect of each step to be stated as the user would
experience it, and a stated effect is verifiable at once. A unit test asserts the behaviour of the code
that was written; the sentence asserts the behaviour the user expected. Confidence **moderate** — this is
reasoning over three cases, not a measurement.

## The gate runs neither the test suite nor the type checker

`scripts/check.sh` composes seventeen shell fragments and none of them invokes `npm test` or
`npm run typecheck`. The consequence, measured: three packages had accumulated nine type errors, all in
test files, all invisible until someone ran the command by hand — and the suite was able to stay red
without anything reporting it.

Highest value per unit of cost on this page, and a question about gate composition rather than a feature.

## How this was established

Run 2026-08-14 against this repository, on Node 26.6.0.

Class counts, read from the declaration rather than counted by eye:

```bash
node -e 'const o=require("./plugin/ownership.json");const c={};for(const p of o.paths)(c[p.class]??=[]).push(p.match);for(const k of["norm","seed","repo"])console.log(k+": "+c[k].length)'
# norm: 7 · seed: 10 · repo: 5
```

The real payload, by calling the function rather than reading it:

```bash
node -e 'const {normContent}=await import("./cli/packages/module-harness/dist/sync.js");
         const m=await normContent(process.cwd()+"/plugin");console.log(m.size)' --input-type=module
# 5
```

In the same run: `npm test` → 448 pass, 1 fails; `vibe-ops check .` → 17 checks, 0 failed.

**One measurement came out wrong and changed this page's scope.** The first count of `norm` entries was
made by reading the file and counting blocks by eye, and produced "seven other paths" — treating the
templates entry as though it were not `norm` and adding one to the six that remain. The programmatic count
above returns 7 entries in total, of which 1 is delivered and 6 are not. The wrong count was the more
dramatic one and would have supported the same qualitative conclusion by a false route.

**The single test failure predates this work.** `template-version-undeclared` fails on a task dossier that
declares no `vibe-ops-template` line in its frontmatter; `git show HEAD:<path> | head -3` shows the H1 at
offset 0 at `HEAD` as well, and nothing under `packages/gates/` or `packages/ops-governance/` was touched.

## What was rejected, and what would reopen it

- **Checking a remote for a newer version of the norm.** The norm is a local installation, so "what
  version is available" is a file read; a network check would add a failure mode and answer nothing.
  *Reopens if* the norm is ever distributed through a channel the clone does not contain.
- **Making the ownership classes configurable per repository.** A boundary each repository can redraw is
  not a boundary; it is a negotiation held at the worst possible moment, with someone mid-promulgation who
  wants the run to finish. *Reopens if* a repository appears whose correct classification is genuinely
  different rather than merely inconvenient — the signal would be a `repo` entry requested for a path the
  norm versions.
- **A `docs/reference/` page per CLI verb.** A reference that lives away from the code it describes is the
  copy that goes stale. *Reopens if* the convention that each package documents its own surface is
  abandoned.
- **An in-place mode for `sync`.** Cut deliberately: it exists in the design only for when isolation is
  unwanted, and it is the one mode needing a clean-tree check and a prompt. *Reopens* when someone asks;
  nobody has.

## What is still open

- **`status` across several repositories is still one invocation each.** The module contract hands a
  module exactly one repository, and the honest reading is that many targets are the caller's loop. But
  "which repositories are on version N?" is the question the module was built to answer, and answering it
  costs a shell loop plus a mental model of which repositories exist.
- **Two detectors are written, tested and composed into nothing.** `runner-provenance` and
  `disabled-declared`. Which population they belong to is unresolved: their subject is the mechanical
  apparatus, which is neither a record nor prose about machinery, so no existing ops fits without
  inheriting exclusions chosen for a different population.
- **Not verified**: whether `sync` behaves against a target with submodules, one whose `core.hooksPath` is
  already redirected, or on Windows. None of the three was executed.
- **Not measured**: how much of the undelivered payload is actually wanted. Six unwritten `norm` entries
  describe a coverage gap; whether all six *should* be promulgated is a product decision this
  investigation does not take.
