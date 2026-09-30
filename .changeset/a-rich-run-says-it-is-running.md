---
"@entelekheia/vibe-ops-cli": minor
---

At a terminal, a run now tells you it is working and reads more easily. While a module runs, a `◌ vibe-ops check · running…` status line shows on stderr (only when stderr is a terminal) and is erased before anything else is drawn. With `--verbose`, the runners' `ok`, `FAIL`, `WARN` and `SKIP` lines are coloured and their `[id]` is bold, and the composition preamble is capitalised. A module's warnings stay in order with its other lines instead of landing ahead of them on stderr. The report block now opens with a sentence, `result of vibe-ops check – <repository>`, that names the repository even when you run from a linked git working tree. Output into a pipe, with `--no-ui`, under `CI`, under `NO_COLOR` without `--ui`, and with `--json` or `--print` is unchanged.
