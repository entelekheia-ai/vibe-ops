---
"@entelekheia/vibe-ops-core": minor
"@entelekheia/governance-base": minor
"@entelekheia/governance-plan": minor
---

A type manifest may declare `units`, an array of full type units, so one package can serve more than one artifact (project/plans/040-\*.md Track 2, [ADR-0020](../project/adr/0020-one-artifact-one-unit-and-a-package-may-ship-several.md)). A binding picks which through the `#type` fragment RFC-0003 already defined, and the activation cache is keyed by `<package>#<type>` rather than by package name — keyed by package alone, a second binding to the same package was handed whatever the first had resolved, which is the same unit under a different name and reports no error. A manifest declaring both a top-level `type` and `units` is refused, as are two units naming the same type and an empty array.

`defineGovernance` takes `type` to say which unit a module serves; it is required when the manifest declares several and refused when it declares one, both at load rather than at dispatch.

A unit may declare `lifecycle` — the status `chain` in order, plus `active`, `terminal`, `living`, `archive` and `immutableFrom`, each validated against that chain. Where a type declares one, it is what `resolve` answers with; where it does not, every field is still derived from the template's own prose exactly as before. `governance-plan` declares its own, so `PLAN_ACTIVE`, `PLAN_TERMINAL` and `LIVING` now come from data instead of from parsing a template comment. A unit may also declare `targets`, the advisory artefact list a style package documents.
