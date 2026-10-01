---
"@entelekheia/vibe-ops-cli": patch
---

`vibe-ops hook check-global` no longer lists each skipped check. The summary line carries the count
instead — `70 checks, 0 failed, 11 skipped` — and the reasons stay where the repository declared them,
readable with `vibe-ops check --verbose`. A skip is a declaration that is identical on every turn, and the
Stop hook speaks into the conversation on every turn; the terminal already hid it outside `--verbose`.
Failing and warning findings are reported exactly as before.
