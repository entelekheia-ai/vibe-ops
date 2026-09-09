# @entelekheia/governance-instructions

## 0.2.0

### Minor Changes

- 54a6052: A type unit may declare `scaffold` — `{ dir, files: [{ from, to }], placeholders? }` — naming every file the package writes into a repository and where each one lands (project/plans/040-\*.md Track 6). Each destination is spelled out rather than derived: a file that must arrive as `.gitignore` or `.gitkeep` is stored without its leading dot, or this repository's own tooling would apply it here instead of shipping it, and a file may be named for what it is rather than where it goes (`NOTICE.template` → `NOTICE`). The field was first shipped as a bare `"./scaffold"` string that nothing read and nothing validated; it is now refused when malformed, and a destination that leaves the target repository is refused outright.

  A unit's `lifecycle` may declare `notes`, a markdown fragment the owning package ships. `renderGovernanceRule` and `renderGovernanceDoc` build this repository's two governance documents from the activated types: the chain and everything that follows from it comes from the manifest, and the paragraphs that are genuinely prose come from that fragment, verbatim. `agents/rules/governance.md` renders whole; `GOVERNANCE.md` renders between two markers and every other line of the file is the repository's, permanently — the `shaped` half of the ownership boundary, which is what lets one document be both current with the activated types and a place someone can write.

  `facet-completeness` (now `@2`) reads scaffold entries as well as facets, so a package declaring a file it does not ship is a finding here rather than a failure in someone else's repository. It no longer skips a package that declares a scaffold and no facet — which was every scaffold entry of the package that has the most.

- c7d4e3c: A new package, `@entelekheia/governance-instructions`, owns the instruction surface — `AGENTS.md`'s
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

### Patch Changes

- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [c3741f0]
  - @entelekheia/governance-base@0.2.0
  - @entelekheia/vibe-ops-core@0.2.0
