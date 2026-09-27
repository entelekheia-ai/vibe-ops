---
"@entelekheia/vibe-ops-harness": minor
"@entelekheia/vibe-ops-cli": minor
---

`harness status` reads this repository's own templates, not only the promulgation receipt

`config.harness.applied` is a receipt, and a repository whose templates arrived any other way — scaffolded,
copied, or written by hand — has none. `harness status` bailed on that absence and answered `behind: []`,
which reads as clean. So did the `SessionStart` hook, which shares the comparison.

The generator is now read off disk alongside the receipt, through the repository's own
`records.templates` declaration or the first `project/templates/<type>.md` present. The receipt still wins
where both answer: a template newer than the receipt is a promulgation in flight, not a finding.

Measured across a nine-repository workspace on 2026-09-26: of six repositories reporting the empty answer,
three had a drifted or unstamped generator. One was authoring `plan@0.1` records the day before, against a
`plan@3` norm, with its `template-version` gate reporting `ok, 12 examined` — correctly, because that
gate's ruler is the local template by design. Nothing else compared the ruler to the norm.

A finding now says which reading it came from, because the repair differs: a `promulgated` entry means the
records are behind and `/vibe-ops:migrate` converts them, while a `template` entry means every record
produced from now on is born behind, so the template is replaced first.

A template that exists and declares no orderable version is reported apart from one that is behind, and is
never resolved to a number — including the pre-integer spelling (`plan@0.1`), which is reported as the
declaration it is rather than as declaring nothing.

**Precision is unchanged for a repository this norm does not govern.** A type with no template file and no
receipt still says nothing, and an undeclared template is reported only for a type the installed norm
actually ships — this reading runs at the start of every session in every repository the operator opens.
