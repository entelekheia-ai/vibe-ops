---
"@entelekheia/governance-base": minor
"@entelekheia/vibe-ops-core": minor
"@entelekheia/vibe-ops-gates": minor
"@entelekheia/governance-instructions": minor
"@entelekheia/governance-license": minor
---

A type unit may declare `scaffold` — `{ dir, files: [{ from, to }], placeholders? }` — naming every file the package writes into a repository and where each one lands (project/plans/040-\*.md Track 6). Each destination is spelled out rather than derived: a file that must arrive as `.gitignore` or `.gitkeep` is stored without its leading dot, or this repository's own tooling would apply it here instead of shipping it, and a file may be named for what it is rather than where it goes (`NOTICE.template` → `NOTICE`). The field was first shipped as a bare `"./scaffold"` string that nothing read and nothing validated; it is now refused when malformed, and a destination that leaves the target repository is refused outright.

A unit's `lifecycle` may declare `notes`, a markdown fragment the owning package ships. `renderGovernanceRule` and `renderGovernanceDoc` build this repository's two governance documents from the activated types: the chain and everything that follows from it comes from the manifest, and the paragraphs that are genuinely prose come from that fragment, verbatim. `agents/rules/governance.md` renders whole; `GOVERNANCE.md` renders between two markers and every other line of the file is the repository's, permanently — the `shaped` half of the ownership boundary, which is what lets one document be both current with the activated types and a place someone can write.

`facet-completeness` (now `@2`) reads scaffold entries as well as facets, so a package declaring a file it does not ship is a finding here rather than a failure in someone else's repository. It no longer skips a package that declares a scaffold and no facet — which was every scaffold entry of the package that has the most.
