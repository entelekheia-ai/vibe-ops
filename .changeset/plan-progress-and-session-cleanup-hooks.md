---
"@entelekheia/vibe-ops-cli": minor
"@entelekheia/governance-plan": minor
---

Two more `plugin/hooks/*.sh` scripts become CLI hook surfaces (project/plans/040-*.md Track 7): `vibe-ops hook plan-progress` replaces `plan-progress-nudge.sh`, and `vibe-ops hook session-cleanup` replaces `session-state-cleanup.sh`. The nudge's decision logic — which plan, if any, this turn should be asked about — is now `planProgressNudge`, exported by `@entelekheia/governance-plan`; the transcript-reading helper that used to be `plugin/scripts/session-touched-repos.sh` is now a CLI-internal function (`touchedRepos`). Both new surfaces take `--state-dir`, supplied by `hooks.json`'s own `${CLAUDE_PLUGIN_DATA}` expansion, instead of reading that (or any other host) environment variable themselves. Behaviour is unchanged from the two scripts they replace.
