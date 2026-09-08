# @entelekheia/vibe-ops-governance

`vibe-ops governance` — this repository's own governance surface, composed: adr/plan/rfc/task header
tables, the links inside every tracked markdown file, and the `git show <sha>:<path>` breadcrumbs a
task's closure leaves behind. The second **ops** in this repository, following
[`@entelekheia/vibe-ops-agents-md`](../ops-agents-md/) — see
[RFC-0001](../../../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md).

```bash
vibe-ops governance              # the repository you are standing in
vibe-ops governance --list       # the gates composed, and the paths each runs over
vibe-ops governance --verbose    # the full run, not only what failed
```

| Entry | Paths | Emits |
|---|---|---|
| `record-header` (type `adr`) | `project/adr/*.md` | no — structural |
| `record-header` (type `plan`) | `project/plans/*.md` | no |
| `record-header` (type `rfc`) | `project/rfc/**/*.md` | no |
| `record-header` (type `task`) | `project/tasks/*.md` | no |
| `record-frontmatter` (type `log`) | `project/log/*.md` | no — structural |
| `template-version` (per type: `adr`, `plan`, `rfc`, `task`, `log`, `research`) | that type's records | **yes** |
| `markdown-link` | the gate's own default (`**/*.md`) | **yes** |
| `breadcrumb` | the gate's own default (`**/*.md`) | **yes** |

`markdown-link` and `breadcrumb` emit because both recur for as long as this repository has markdown —
links rot as files move, and every task closure adds another breadcrumb a rewritten history can break.
`record-header` does not: once a record declares a `Status` it keeps it, and a series of zeros there
says nothing about whether the guide is working. `record-frontmatter` is the same reading for a type whose
fields travel in YAML frontmatter rather than a header table — which one a type gets is decided by its own
`types/<t>/type.json`, under `schema.carrier`, not by anything here.

Research carries no schema: nothing in this repository declares its shape, and inventing one is a
decision for the skill that would create research documents, not for this ops.

`markdown-link`'s shell precedent, `20-links.sh`, and `fragment-parity` — the gate that compared the
two — were both retired in Plan-038 Track 7, once a corpus wide enough showed no divergence between them
and both sides were made to fail on one shared fixture. This ops never actually carried a
`fragment-parity` entry of its own: the comparison for `20-links.sh` lived in `ops-mirror`, not here.
