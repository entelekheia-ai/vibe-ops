---
"@entelekheia/vibe-ops-module-check": minor
---

A default `vibe-ops check` stops repeating the composition preamble, and `--verbose` prints the totals once

`composed N checks:`, the per-fragment source listing under it and `composed deny-list: …` now print only
under `--verbose`, beside the rest of a run's detail. A clean run with no findings reports its totals line
and nothing else. `FAIL` and `WARN` lines print as before, and so does `--self-test`, whose text is its
answer. The `N checks, M failed` line is unchanged.

`--verbose` no longer logs the totals itself: `@entelekheia/vibe-ops-cli` now prints the summary as that
bare line, and printing both gave a consumer's `--verbose` capture two matching lines. That is why this
is a minor rather than a patch — paired with a CLI older than this release, `--verbose` would print the
totals only behind the CLI's old prefix, and a gate grepping the bare line would find none. The released
CLI depends on `^0.1.2`, which does not take `0.2.0`, so the pairing cannot happen through an install.
