---
"@entelekheia/vibe-ops-harness": minor
"@entelekheia/vibe-ops-mirror": minor
"@entelekheia/vibe-ops-module-check": patch
---

`vibe-ops harness install <target>` writes the commit gate's four files — `scripts/check.sh`, `scripts/checks/_run.sh`, `.githooks/pre-commit` and the CI workflow — from the harness package itself. They arrive by their own verb rather than through `setup scaffold` because the harness is not a governance: it has no type, no records and no binding, and its files are the apparatus a repository runs the governances through.

A destination that already exists is kept and named. The one case that gets more than that is a `pre-commit` that does not call the gate: it is kept AND reported, because silently keeping it would leave the gate uninstalled while the run said nothing — and replacing it would delete somebody's hook.

`dogfooding-drift` retires with its last pair (`@entelekheia/vibe-ops-mirror`). It compared the five record templates and the two governance documents this repository ships against the copies its own scaffold kept; the scaffold now reads each template from the package that owns the type, and both documents are rendered, so there is no second copy left to drift from. `55-references-completeness.sh` (`@6`) reads `plugin/references/` only where one still exists — this plugin's is gone.
