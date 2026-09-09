---
---

Deliberately empty. The changelog link fix touches no published artifact: `npm pack --dry-run` on
`governance-base` lists 46 files and `CHANGELOG.md` is not among them — no package declares it in
`files`, and npm does not add it on its own. Bumping six packages for a link that reaches nobody who
installs them would be exactly the version noise releasing through changesets exists to avoid.

The rule this fix adds to `cli/AGENTS.md` is the durable half; this file is only the gate's answer.
