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
| `budget` | `module-check/sh/checks/10-budget.sh` | `AGENTS.md` over its line budget | no — relocation is judgement |
| `pairing` | new | no sibling `CLAUDE.md` (`fail`), or one that exists but does not import `@AGENTS.md` (`warn`) | the first mode only — creates the missing sibling; never edits one that exists |
| `claude-md-content` | new | a `CLAUDE.md` carrying content beyond `@AGENTS.md` | no — a judgement about where the content belongs |
| `bridge` | `module-check/sh/checks/30-bridge.sh` | a `.claude/` entry that is not a resolving relative symlink | no |
| `check-frontmatter` | `40-frontmatter.sh` + `45-skill-frontmatter.sh` | a missing frontmatter block, description, or (schema `skill`) an unquoted `": "` that silently drops all fields | no |
| `memory-slug` | `60-memory-slugs.sh` | a `[[…]]` personal-memory link, fences and inline code spans excluded | no |

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

## These run beside the shell fragments, not instead of them

Every gate here ports one `module-check/sh/checks/*.sh` fragment, faithfully — same population, same
messages where the shell one had a name for them. Read
[RFC-0001](../../../project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md) before removing
the fragment a gate replaces: the two are meant to be compared, finding by finding, first.
