---
"@entelekheia/vibe-ops-harness": patch
---

The scaffolded `scripts/checks/_run.sh` states the real reason it runs `vibe-ops check --verbose`: the
composition listing its "your fragments were composed" check reads appears only under `--verbose`. The
comment it replaces said the totals line is printed only there, which stopped being true when the CLI
began printing that line bare in every mode. Comment only; the script behaves as before.
