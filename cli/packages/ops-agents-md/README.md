# @entelekheia/vibe-ops-agents-md

`vibe-ops agents-md` — the instruction surface, composed: `AGENTS.md`, `CLAUDE.md`, and the `.agents/` ↔
`.claude/` bridge. The first **ops** in this repository — a named composition of
[`@entelekheia/vibe-ops-gates`](../gates/) over declared paths, deciding which of them emit. See
[RFC-0001](../../../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md).

```bash
vibe-ops agents-md              # the repository you are standing in
vibe-ops agents-md --list       # the gates composed, and the paths each runs over
vibe-ops agents-md --audit      # the same report, always exit 0
vibe-ops agents-md --verbose    # the full run, not only what failed
vibe-ops agents-md --file AGENTS.md         # scope to one file — need not be tracked yet
vibe-ops agents-md --file AGENTS.md --fix pairing   # repair only what "pairing" can fix
```

This package holds **only the composition** — no detector. `src/index.ts` is the whole thing:

| Entry | Paths | Emits |
|---|---|---|
| `budget` | `AGENTS.md` | no — a structural property |
| `pairing` | `**/AGENTS.md` | no |
| `claude-md-content` | `**/CLAUDE.md` | no |
| `bridge` | the gate's own default (`.claude/`) | no |
| `check-frontmatter` (schema `rule`) | `.agents/rules/*.md` | no |
| `check-frontmatter` (schema `skill`, labelled `skill-frontmatter`) | `<plugin>/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md` | no |
| `memory-slug` | `AGENTS.md`, `**/AGENTS.md`, `**/CLAUDE.md`, `**/README.md` | **yes** |

Only `memory-slug` emits. The other six are structural — a file has a sibling or it does not, a
symlink resolves or it does not — and stay fixed once corrected; a series of zeros there says nothing
about whether a guide is working. `memory-slug` on the instruction surface is behavioural and
recurrent, which is what makes it worth a reading.

Of the seven, only `pairing` is `fixable`. `--fix` repairs it — and only it, unless named otherwise —
because a caller that just reacted to one edit (the skill-scoped `hooks:` block calling
`vibe-ops hook ops agents-md --fix pairing`, see [RFC-0001](../../../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md))
has no business rewriting a file the edit never touched.

## The fragments this ops ported are gone; the ports are what runs now

Plan-038 Track 7 retired `module-check/sh/checks/10-budget.sh`, `30-bridge.sh`, `40-frontmatter.sh` and
`45-skill-frontmatter.sh` once a corpus wide enough showed no divergence from the gates that ported them
and both sides were made to fail on one shared fixture — the comparison RFC-0001 asks for before a
fragment is removed. Four of this ops's seven entries ported one of those fragments each (`budget`,
`bridge`, and `check-frontmatter` under both its default and `skill-frontmatter` labels); `pairing`,
`claude-md-content` and `check-frontmatter`'s `agent-frontmatter` label have no shell precedent.
`vibe-ops check` composes this ops beside the eight fragments still shell — under `module-check/sh/checks/`
— none of which this ops itself ported.
