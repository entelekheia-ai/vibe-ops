---
"@entelekheia/vibe-ops-cli": minor
---

At a terminal, a run whose answer is a list of findings ends with a report block

`vibe-ops check`, and every ops (`governance`, `agents-md`, `exposure`, `mirror`, `for-vibe-ops`), now
close a rich run with a counts line — fail, warn, skip — then each finding grouped under the gate that
produced it, failures first, then the module's own summary line, unchanged. The block stands in for the
module's finding lines, which are not printed a second time; every other line the module wrote — a repair,
a hint — is printed above it, and `--verbose` prints the finding lines there too. A pipe, `--no-ui`, `CI`, `NO_COLOR` without `--ui`, and `--json` see none of this.
