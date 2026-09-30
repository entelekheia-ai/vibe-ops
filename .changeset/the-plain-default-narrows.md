---
"@entelekheia/vibe-ops-module-check": patch
---

A default `vibe-ops check` stops repeating the composition preamble

`composed N checks:`, the per-fragment source listing under it and `composed deny-list: …` now print only
under `--verbose`, beside the rest of a run's detail. A clean run with no findings reports its totals line
and nothing else. `FAIL` and `WARN` lines print as before, and so does `--self-test`, whose text is its
answer. The `N checks, M failed` line is unchanged.
