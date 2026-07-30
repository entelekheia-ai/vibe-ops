# Instruction surfaces — which file gets a fact, and how it reaches the agent

Decision record: [ADR-0003](../project/adr/0003-instruction-file-architecture.md).

A repository has several places to put an instruction and they are **not** interchangeable. This file is
the routing rule and the mechanics behind it.

## The enforcement ladder

Ordered strongest first. The load-bearing conclusion: **the only way to raise compliance is to move *up*
this ladder, not sideways along it.**

| Mechanism | Enforcement |
|---|---|
| Hook / CI / type / lint | Executes regardless of the agent's decision. Not ignorable. |
| Path-scoped rule (`paths:`) | Loads only for matching files, so it lands in a small, high-relevance block |
| Always-on rule ≡ section of the instruction file | Same priority, same relevance gate |
| Skill | On demand, and only if the agent selects it |

Two mechanical facts this rests on, both from
[Anthropic's memory documentation](https://code.claude.com/docs/en/memory): a rule **without** `paths:`
frontmatter loads at launch *with the same priority as the instruction file*, and an instruction that must
run at a fixed lifecycle point belongs in a hook rather than a sentence. So an always-on rule is **not** a
stronger form of instruction than a section of `AGENTS.md`.

**The relevance gate.** The instruction file is delivered as a user message after the system prompt, inside
an envelope stating the context may or may not be relevant and should not be acted on unless highly
relevant ([documented by HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)). The gate
applies to the **block as a whole** — so every non-universal line raises the chance the universal ones get
discounted along with it. This is why a size budget is a correctness measure, not a cost measure.

## Where each fact goes

Resolved by what the fact *is*, not by who wrote it or when:

| The fact is… | Surface | Why |
|---|---|---|
| Mechanically enforceable | hook / CI / type / lint | Not ignorable; beats any sentence |
| Scoped to a path or file type | path-scoped rule (`paths: ["glob"]`) | Loads only when relevant, keeping the always-on block small |
| "Do this and it breaks" | always-on rule, one topic per file | Named by filename, individually removable |
| "This is how the repo is shaped" | `AGENTS.md` | It is the map, and the map is what a newcomer reads first |
| "How to do X" | a skill | Needed occasionally; permanent context is the wrong price |
| Hard-to-reverse choice already made | an ADR | Not an instruction at all — a record |
| True in *any* repository | the maintainer's own notes | Not repository knowledge; writing it here means writing it again in the next repo |

Rows three and four **load identically**. The split between them is organizational, not a difference in
compliance — it makes the file a maintainer looks in predictable. Claiming it raises adherence would be
false.

Never put the same fact on two of these surfaces. Both load anyway, so it is pure duplication with a drift
surface attached.

## `AGENTS.md` vs `CLAUDE.md`

`AGENTS.md` carries what is **universal**: layout, build and test commands, conventions, invariants,
security boundaries. `CLAUDE.md` is `@AGENTS.md` plus only what another agent would ignore or misread —
skill routing, `@` imports, subagent delegation, context budget, `${CLAUDE_PLUGIN_ROOT}` paths. In a survey
of 38 projects, [Roland Huß](https://ro14nd.de/what-goes-in-agents-md/) measured roughly 55% of instruction
content as universal, 30% as genuinely agent-specific, and 15% as universal advice written in
agent-specific language — that last slice is the one to rewrite, not to copy.

If a repository has no Claude-specific content, `CLAUDE.md` is one line — `@AGENTS.md` — and that is the
correct end state, not a stub to fill in later.

## Nested instruction files do not auto-load

A `CLAUDE.md` in a subdirectory is read when work happens in that directory; an `AGENTS.md` sitting in a
subdirectory with no sibling `CLAUDE.md` and no `@`-import from anywhere **never enters context on its own**.
Good content in a file nothing loads is not a smaller problem than bad content — it is a silent one.

So a nested `AGENTS.md` needs one of:

- a sibling `CLAUDE.md` containing `@AGENTS.md`, or
- an `@`-import from the nearest ancestor that does load, or
- conversion into a **path-scoped rule** (`paths: ["that-dir/**"]`), which is usually the right answer —
  it loads exactly when work touches those files and costs nothing otherwise.

Check this before writing a nested file: *what loads it?* If the answer is "nothing", pick a different
surface.

## The `.agents/` ↔ `.claude/` bridge

Agent configuration has **one canonical home: `.agents/`** (`rules/`, `skills/`, `workflows/`). `.claude/`
holds thin **relative** symlinks back into it, so Claude Code and any `.agents`-reading agent load the same
bytes and there is no second copy to drift.

| Kind | Canonical file | Claude adapter |
|---|---|---|
| **Rule** (always-on fact/guardrail) | `.agents/rules/<name>.md` — needs a `description:`; no `paths:` = always-on, or `paths: ["glob"]` to scope | `.claude/rules/<name>.md` → `../../.agents/rules/<name>.md` |
| **Skill** (on-demand capability) | `.agents/skills/<name>/SKILL.md` | `.claude/skills/<name>` → `../../.agents/skills/<name>` |
| **Workflow** | `.agents/workflows/<name>.md` | via the rule or skill that references it |

```bash
ln -s ../../.agents/rules/<name>.md .claude/rules/<name>.md
ln -s ../../.agents/skills/<name>   .claude/skills/<name>
```

- **Never put the real file under `.claude/`.** An agent that reads `.agents/` would never see it, and the
  two copies drift silently.
- **Windows fallback.** Creating a symlink on Windows requires Administrator privileges or Developer Mode.
  Where symlinks are unavailable, the canonical file stays in `.agents/` and `CLAUDE.md` imports it with
  `@`. The symlink is the default; the import is the documented fallback — state it rather than leaving the
  failure to be discovered.
- **Silent-failure check.** With `core.symlinks=false`, git checks a symlink out as a plain text file
  containing the target path. The rule then *appears* to exist and contains one line of nonsense. Verify
  with `test -L` rather than `test -f`.
- A sub-repository opened standalone needs its **own** committed `.agents/`/`.claude/`. A rule or skill in
  a parent directory is not discovered from inside it.
