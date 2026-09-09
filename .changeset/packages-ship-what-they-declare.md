---
"@entelekheia/governance-base": patch
"@entelekheia/governance-adr": patch
"@entelekheia/governance-knowledge": patch
"@entelekheia/governance-plan": patch
"@entelekheia/governance-rfc": patch
"@entelekheia/governance-task": patch
---

Six packages declared paths their tarballs did not carry, so an npm install received a manifest pointing
at files that were not there.

`governance-base` omitted `scaffold/` — the fifteen files `setup scaffold` writes, and the two prose
fragments both governance documents are framed by. From a published install the verb wrote a fraction of
a repository, and neither `GOVERNANCE.md` nor `.agents/rules/governance.md` was written at all.

Five type packages omitted `lifecycle-notes.md`, the prose half of every rendered lifecycle section. Each
section rendered as its heading plus the sentence saying the fragment was missing.

Found by `facet-completeness@3` running from the global install — the artifact this repository never
checks, because here every declared path resolves from the workspace whether or not it is published.
