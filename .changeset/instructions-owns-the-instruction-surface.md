---
"@entelekheia/governance-instructions": minor
"@entelekheia/vibe-ops-core": minor
"@entelekheia/vibe-ops-cli": minor
"@entelekheia/vibe-ops-harness": minor
---

A new package, `@entelekheia/governance-instructions`, owns the instruction surface — `AGENTS.md`'s
`CLAUDE.md` import, the `.agents/` ↔ `.claude/` bridge, and `repo-guardrails.md` (project/plans/040-\*.md
Track 5, RFC-0005 §2). It ships no record and no gate — it is policy-only, the same shape
`@entelekheia/governance-base` uses, with `numbered: false` and no `template`/`authoring`/`migrations` in
its `type.json` — and gates keep resolving from `@entelekheia/vibe-ops-gates` alone (RFC-0001); the
`agents-md` ops is unchanged.

`instruction-surfaces.md` moves from `plugin/references/` into the package as a `policy` facet, keeping its
`vibe-ops-reference: instruction-surfaces@1` stamp byte-identical: `vibe-ops records norm --type
instructions --facet policy --name surfaces --print`. Every skill and gate that read it by path now names
that command instead.

Three files move out of `plugin/skills/setup/templates/` into the package's own `scaffold/` directory,
mirroring their destination-relative shape (`scaffold/root/CLAUDE.md`, `scaffold/agents/rules/repo-
guardrails.md`, `scaffold/agents/skills/gitkeep`) and declared under a new `scaffold` key in `type.json` —
inert until Plan-040 Track 6 builds the `setup scaffold` composition that reads it, the same "declare now,
wire later" precedent Track 2 set for `lifecycle`. The package's own `ownership.json` fragment classifies
`CLAUDE.md` as `norm` and `.agents/rules/repo-guardrails.md` / `.agents/skills/.gitkeep` as `seed` — the
guardrails file ships with a `TODO` placeholder for the operator, which is why it is `seed` rather than
`norm`. The three matching entries move out of `@entelekheia/vibe-ops-harness`'s own base `ownership.json`
fragment, which no longer needs to carry paths a single package now owns; this changes no repository's
composed classification for any of the three, because `instructions` joins `DEFAULT_GOVERNANCE_BINDINGS`
in the same commit.

`instructions: "@entelekheia/governance-instructions"` joins `DEFAULT_GOVERNANCE_BINDINGS` in
`@entelekheia/vibe-ops-core`, alongside `base` — bound by default, like `base`, because the instruction
surface is universal rather than opt-in the way `license`/`classification` are.
