# ADR-0003: `.agents/` is canonical, `.claude/` mirrors it, and each fact has one surface

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Deciders | Danilo Borges |

---

## Context

Every coding agent reads a different instruction file — `CLAUDE.md`, `AGENTS.md`, `.cursorrules`,
`.github/copilot-instructions.md`, `GEMINI.md`. Build commands, conventions and invariants are the same
regardless of which agent reads them, so copying them into four files and keeping them in sync is
maintenance that produces nothing. [Roland Huß, surveying 38 of his own
projects](https://ro14nd.de/what-goes-in-agents-md/), measured roughly 55% of instruction content as
universal, 30% as genuinely agent-specific, and 15% as universal advice written in agent-specific
language.

This plugin has been emitting an answer to that problem since v0.2.0 — a canonical `.agents/`
directory with `.claude/` symlinks back into it — without ever recording the decision, the
alternatives, or its known limitation. It is also missing the rule for a question that arises the
moment more than one always-on surface exists: **when a fact could go in either the instruction file or
an always-on rule, which one gets it?** Writing this ADR forced that question and it had to be answered
on the spot.

Two mechanical facts constrain the answer, and both are easy to get wrong. Both are documented
externally; the conclusions drawn from them below are ours.

**How the file reaches the model.** Per
[Anthropic's memory documentation](https://code.claude.com/docs/en/memory), the instruction file is
delivered as a user message *after* the system prompt, so there is no guarantee of strict compliance.
[HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md) documented the envelope it
arrives in — a system reminder stating the context may or may not be relevant and should not be acted
on unless highly relevant to the task — and concluded that the more non-universally-applicable content
the file carries, the more likely the agent discounts it. **Our reading:** the relevance gate applies to
the block as a whole, so every non-universal line raises the chance the *universal* lines are discounted
with it.

**What actually differs between surfaces.** Also from Anthropic's documentation: a rule **without**
`paths:` frontmatter loads at launch *with the same priority as the instruction file*, and an
instruction that must run at a fixed lifecycle point should be a hook rather than a sentence. So an
always-on rule is **not** a stronger form of enforcement. The ladder below is our synthesis of those
facts, ordered strongest first:

| Mechanism | Enforcement |
|---|---|
| Hook / CI / type / lint | Executes regardless of the agent's decision. Not ignorable. |
| Path-scoped rule (`paths:`) | Loads only for matching files, so it lands in a small, high-relevance block |
| Always-on rule ≡ section of the instruction file | Same priority, same relevance gate |
| Skill | On demand, and only if the agent selects it |

The load-bearing conclusion, ours: **the only way to raise compliance is to move up this ladder, not
sideways along it.**

## Decision

**One canonical home.** Agent configuration lives in `.agents/` — `rules/`, `skills/`, `workflows/`.
`.claude/` holds thin relative symlinks back into it, so every agent reads the same bytes and there is
no second copy to drift. The real file is **never** placed under `.claude/`.

```bash
ln -s ../../.agents/rules/<name>.md .claude/rules/<name>.md
ln -s ../../.agents/skills/<name>   .claude/skills/<name>
```

**Windows fallback.** Creating a symlink on Windows requires Administrator privileges or Developer
Mode. Where symlinks are unavailable, the canonical file stays in `.agents/` and `CLAUDE.md` imports it
with `@` instead. The symlink is the default; the import is the documented fallback, and the skills that
build the bridge state it rather than leaving the failure to be discovered.

**The instruction-file split**, adopting [Huß's universal-versus-agent-specific
division](https://ro14nd.de/what-goes-in-agents-md/). `AGENTS.md` carries what is universal: layout,
build and test commands, conventions, invariants, security boundaries. `CLAUDE.md` is `@AGENTS.md` plus
only what other agents would ignore or misread — skill routing, `@` imports, subagent delegation,
context budget, `${CLAUDE_PLUGIN_ROOT}` paths.

**Where each fact goes**, resolved by what the fact *is*. This table is ours:

| The fact is… | Surface | Why |
|---|---|---|
| Mechanically enforceable | hook / CI / type / lint | Not ignorable; beats any sentence |
| Scoped to a path or file type | path-scoped rule | Loads only when relevant, keeping the always-on block small |
| "Do this and it breaks" | always-on rule, one topic per file | Organizational: named by filename, individually removable |
| "This is how the repo is shaped" | `AGENTS.md` | It is the map, and the map is what a newcomer reads first |
| "How to do X" | skill | Needed occasionally; permanent context is the wrong price |

The third and fourth rows load identically. **The split between them is organizational, not a
difference in compliance** — claiming otherwise would be false, and the honest statement is that the
only way to raise compliance is to move up the ladder, not sideways along it.

**Budget follows from the relevance gate.** Because the gate applies to the whole always-on block, a
size limit is a correctness measure rather than a cost measure. Padding does not merely cost tokens; it
degrades the instructions that were needed.

## Options considered

- **A — copy the content into each agent's file.** Works everywhere with no filesystem tricks. Four
  copies, and they diverge within weeks. Rejected.
- **B — put the real file under `.claude/` and symlink into `.agents/`.** Identical mechanics, opposite
  bias: it privileges one agent and makes the others second-class in a repository meant to be
  agent-neutral. Rejected.
- **C — `@`-import everywhere, no symlinks.** Portable across every OS with no privilege requirement.
  Only the importing agent sees the content; an agent that reads `.agents/` directly gets nothing, which
  reintroduces the duplication the bridge exists to remove. Rejected as the default, **retained as the
  Windows fallback.**
- **D (chosen) — `.agents/` canonical, `.claude/` symlinks, `@`-import where symlinks are unavailable.**

For the placement question specifically:

- **A — everything in `AGENTS.md`.** One file to read; grows past the budget, and the relevance gate
  then discounts the whole thing. Rejected.
- **B — everything in rules, `AGENTS.md` reduced to a pointer.** Clean separation; loses the map as a
  first thing a newcomer reads, and always-on rules cost exactly the same. Rejected.
- **C (chosen) — split by what the fact is**, per the table above.

## Consequences

**Easier.** One file to edit per fact, and adding an agent means adding an adapter, not a copy. The
placement table removes a recurring judgement call and prevents the same invariant appearing on two
surfaces that both load anyway — pure duplication with no compensating benefit.

**Harder.** The Windows caveat is now a permanent branch that every bridge-building skill must carry,
and it cannot be tested from a Unix machine. Contributors on Windows will hit it before the
documentation reaches them.

**Accepted costs.** The organizational split between an always-on rule and an `AGENTS.md` section is a
convention with no mechanical backing — nothing prevents someone putting a guardrail in the map or vice
versa, and the agent will behave identically either way. It is worth having because it makes the file a
maintainer looks in predictable, not because it changes compliance.

**Risk.** Symlinks survive `git clone` on Unix but are checked out as plain text files containing the
path when `core.symlinks=false`, which is the Windows default in some configurations. That failure is
silent: the rule file appears to exist and contains one line of nonsense. Worth a validator check.

## Related

- [`project/research/context-file-practices.md`](../research/context-file-practices.md) — the relevance
  gate, the enforcement ladder, and the size-budget evidence.
- [ADR-0002](0002-knowledge-lifecycle.md) — the promotion test whose fourth question routes into the
  table above.
