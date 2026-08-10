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
```

This package holds **only the composition** — no detector. `src/index.ts` is the whole thing:

| Entry | Paths | Emits |
|---|---|---|
| `budget` | `AGENTS.md` | no — a structural property |
| `pairing` | `**/AGENTS.md` | no |
| `bridge` | the gate's own default (`.claude/`) | no |
| `check-frontmatter` (schema `rule`) | `.agents/rules/*.md` | no |
| `check-frontmatter` (schema `skill`, labelled `skill-frontmatter`) | `<plugin>/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md` | no |
| `memory-slug` | `AGENTS.md`, `**/AGENTS.md`, `**/CLAUDE.md`, `**/README.md` | **yes** |

Only `memory-slug` emits. The other five are structural — a file has a sibling or it does not, a
symlink resolves or it does not — and stay fixed once corrected; a series of zeros there says nothing
about whether a guide is working. `memory-slug` on the instruction surface is behavioural and
recurrent, which is what makes it worth a reading.

## Runs beside the shell gate, not instead of it

`vibe-ops check` still runs `module-check/sh/checks/10-budget.sh`, `30-bridge.sh`, `40-frontmatter.sh`,
`45-skill-frontmatter.sh` and `60-memory-slugs.sh` — the five fragments this ops ports. The two are
meant to be run against the same repository and compared, finding by finding, before the shell
fragments are ever removed. That removal is a separate, later act, tracked in RFC-0001.
