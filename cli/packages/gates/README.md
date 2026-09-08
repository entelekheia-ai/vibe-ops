# @entelekheia/vibe-ops-gates

Detectors, not commands. A gate knows what to look for and nothing about scope — not the repository,
not which paths it was given, not whether anything downstream records what it finds. An **ops**
composes gates over declared paths and decides what emits; see
[`@entelekheia/vibe-ops-agents-md`](../ops-agents-md/) for the first one.

```ts
import "@entelekheia/vibe-ops-gates/budget";      // one folder, one gate, one subpath export
```

| Gate | Ported from | What it catches | Fixable |
|---|---|---|---|
| `budget` | `module-check/sh/checks/10-budget.sh` (retired, Plan-038 Track 7) | `AGENTS.md` over its line budget | no — relocation is judgement |
| `pairing` | new | no sibling `CLAUDE.md` (`fail`), or one that exists but does not import `@AGENTS.md` (`warn`) | the first mode only — creates the missing sibling; never edits one that exists |
| `claude-md-content` | new | a `CLAUDE.md` carrying content beyond `@AGENTS.md` | no — a judgement about where the content belongs |
| `bridge` | `module-check/sh/checks/30-bridge.sh` (retired, Plan-038 Track 7) | a `.claude/` entry that is not a resolving relative symlink | no |
| `check-frontmatter` | `40-frontmatter.sh` + `45-skill-frontmatter.sh` (both retired, Plan-038 Track 7) | a missing frontmatter block, a description, frontmatter that genuinely does not parse (any fault, named by line — Plan-013), or (schema `skill`) an unquoted `": "` that silently drops all fields | no |
| `template-heading-drift` | new | a document CLAIMING a record carries a section its template no longer has, or stating the wrong living-section count — per record type, so a heading dropped from one template but live in another is judged against the type the sentence is about | no — rewriting a sentence is a judgement about someone else's prose |

`memory-slug` is not a gate here — its fragment, `60-memory-slugs.sh`, was one of ten unported fragments
Plan-037 folded into the parameterised `classification` gate (`cli/AGENTS.md`'s `packages/gates/` row),
composed under `exposure` as its `memory-slug` entry, and `60-memory-slugs.sh` itself was retired in
Plan-038 Track 7.

Nine gates read the parsed document model instead of the file — `check-frontmatter`, `pairing`,
`claude-md-content` and `template-heading-drift` above, plus `markdown-link`, `breadcrumb`,
`record-header` and `template-version` (not in the table above; see `cli/AGENTS.md`'s layout table) and
`classification`. How to read one is [core's README](../core/README.md). Only `budget` and `bridge`
do not — neither has document structure to extract.

`template-heading-drift` is the one that reads **two** masks of the same document, and which is which
matters: the signal comes from `describedText`, which keeps the interior of a code span, because a
claim about a section is written as `` `Progress` `` and masking it blanks the very thing being
detected; the record type a sentence is about comes from `proseText`, which masks code spans, because
`` `Decision Log` `` is a quoted name rather than a mention of the log record type.

`pairing`'s two findings split by **failure mode, not by root-versus-nested depth** — a nested `AGENTS.md`
with no sibling fails exactly like a root one, because once the file exists it either loads or it does
not, at every depth. A `defineGate` third argument, `fix()`, is present only when `fixable: true` is
declared — `pairing`'s repairs the missing-sibling case and returns nothing for the unrepairable one,
which the ops re-runs the gate to confirm.

## Why a gate is not a package

A gate lives in its own folder and is consumed by API — the same relationship `eita` has between a
trait and a profile — but it does **not** have to be an npm package the way an `eita` trait is.
Promoting one to a standalone package later costs a line in the resolver, not a rewrite. Resolution
follows the same three forms `packages/cli/src/resolve.ts` uses for a module: a bare name under
`@entelekheia/vibe-ops-gates/<name>`, a scoped package taken verbatim, or a path.

## A port runs beside its fragment only until the fragment is retired

A gate ported from a `module-check/sh/checks/*.sh` fragment matched it faithfully — same population, same
messages where the shell one had a name for them — and the two ran side by side, compared finding by
finding, until [RFC-0001](../../../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md)'s
bar was met. `budget`, `bridge` and `check-frontmatter` above have already outlived the fragment they
ported: Plan-038 Track 7 deleted `10-budget.sh`, `30-bridge.sh`, `40-frontmatter.sh` and
`45-skill-frontmatter.sh` once `fragment-parity` — since deleted with them — had shown no divergence over
a wide enough corpus with both sides failing one shared fixture. A gate with no shell precedent, or whose
fragment has since been retired, is simply the detector now.
