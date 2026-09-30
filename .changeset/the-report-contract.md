---
"@entelekheia/vibe-ops-core": minor
---

`readReport` and `isReport`: the report shape a module's `data` carries when its answer is a list of findings

A module whose `data` holds `findings` and `skipped` arrays — every ops, and `check` — now satisfies one
exported contract, `Report`. `readReport(data)` returns it normalised, with each entry's origin under `id`
whether the producer called it `gate` or `check`, and returns `undefined` for anything else, including a
payload with one malformed entry. Its first reader is the CLI's report view, in the same release.
