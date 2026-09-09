---
"@entelekheia/governance-license": minor
"@entelekheia/governance-classification": patch
"@entelekheia/vibe-ops-module-check": patch
---

`@entelekheia/governance-license` and `@entelekheia/governance-classification` each gain an `ownership.json` fragment (project/plans/040-\*.md Track 3) — both shipped files into a repository with no declaration naming them until now.

`@entelekheia/governance-license` also takes over what the `license-setup` skill used to ship: `scaffold/` now carries the NOTICE and AUTHORS templates, the header-check script and its two CI workflows, and the two license-rules documents — the skill names a package root instead of a file of its own. `get-license.sh`'s `fetch` and `verify` commands become two new CLI commands, `license get <id>` (`--out <file>`) and `license verify <file>` (`--id <id>`), reading the same registry (`templates/SOURCES.tsv`) and applying the same canonical-text comparison; `license list` is added too, since the skill's own Step 1 depends on it. `pin` (adding a new SPDX id) is deliberately not ported — it stays a maintainer-only, run-from-a-checkout operation, never a consumer-facing verb.

`vibe-ops-module-check`'s `90-license-texts.sh` fragment no longer shells out to the retired `get-license.sh`; the one comparison it used (this repository's own `LICENSE` against the Apache-2.0 pin) is inlined using the same canonical-text transform, keeping the fragment dependency-free (`CHECK_VERSION` bumped to 2).
