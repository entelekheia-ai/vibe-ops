---
"@entelekheia/vibe-ops-cli": patch
---

`vibe-ops hook check-global` groups warnings by check: a check with one warning keeps its line, a check with more prints one line with the count and two examples, and failures are still listed whole. A workspace root's Stop output drops from 11 352 to 2 142 bytes, under the size at which Claude Code moves a hook's output into a file and shows only a preview.
