# @entelekheia/vibe-ops-for-vibe-ops

What this repository claims about itself, checked against what it is.

```bash
vibe-ops for-vibe-ops              # run it
vibe-ops for-vibe-ops --list       # the gates composed, and the paths each runs over
vibe-ops for-vibe-ops --self-test  # assert every gate that declares a fixture still fires on it
```

## Why this is not part of `governance`

`governance` asks *"is this record well formed?"*, and every one of its entries is scoped to a record
directory. The entries here ask the near-complement — *"does the prose describing our own machinery still
match the machinery?"* — so the population is, deliberately, everything that is **not** a record.
[RFC-0001](../../../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md)'s test is exactly
that: a signal's identity includes the population it was read over.

The split has a concrete cause rather than a taxonomic one. `governance` excludes `**/templates/**` from
every entry through a single `"*"` line, because a shipped template's content resolves in the *target*
repository rather than this one. That is true of each of its entries and false for
`template-heading-drift`, whose whole subject is the text those shipped copies carry. `ignore` is additive
with no negation, so composing both under `governance` meant replacing one `"*"` line with thirteen
per-label ones — and the thirteen lines were never the cost. The cost was that `"*"` had been a **safe
default**: a gate added to `governance` inherited the exclusion without anyone thinking about it, and
after the split it would inherit nothing and read the shipped templates in silence, green.

## Composed here

| Gate | What it catches |
|---|---|
| `template-heading-drift` | a document claiming a record carries a section its template no longer has, or stating the wrong count of living ones — per record type, so a heading dropped from one template but live in another is judged against the type the sentence is about |

## What else belongs here

Anything whose subject is this repository's own claims about its own machinery.
[Plan-014](../../../project/plans/shipped/014-the-prose-that-describes-a-template-is-checked-against-it.md)
leaves two named and unbuilt: a document that fails to mention a section a template **gained**, and a
**renamed** section, where the old name is forbidden and the new one required in the same places. Both
share this population and this exclusion list, which is what makes this a composition rather than a
package built around one detector.

## Configuration

The path policy lives in the repository's own `vibeops.config.ts` under `settings.self`, never inside a
gate ([ADR-0011](../../../project/adr/0011-population-belongs-to-configuration-not-a-gate.md)). It is what
separates a record that **has** an old heading — legitimate, it was written against an older template —
from a document that **says** records have it, which is the defect. Note what it does not exclude:
`**/templates/**`, because the shipped copies are the population this ops exists to read.
