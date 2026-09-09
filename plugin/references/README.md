---
vibe-ops-reference: README@1
---

# references/

Shared policy the skills point at instead of restating. Each file here is the **single copy** of a rule
that governs more than one skill; a `SKILL.md` that repeats one of these has created a second copy, and
the copy in the skill is the one that goes stale.

Read from a skill at `${CLAUDE_PLUGIN_ROOT}/references/<file>`. These are not skills — the plugin exposes
only `skills/` and `agents/`, so nothing here is ever invoked directly. It is content a skill loads when
its own steps say to, or hands to a subagent as an absolute path.

**Six policy files that used to live here moved into the governance packages whose policy they are**
(Plan-040 Tracks 1 and 5) and are read through the CLI instead of a path — this directory keeps only the
three that have no such package. The table below carries both kinds; a "Read through" cell names a
command, a relative link names a file still in this directory.

| File | Answers | Read through | Pointed at by |
|---|---|---|---|
| `convergence-policy@2` | Is this skill target-state or event, and how does it reconcile a repo that already exists? | `vibe-ops records norm --type base --facet policy --name convergence --print` | every target-state skill; `new` and `close` declare themselves events; the `governance-auditor` agent, for the verbs it assigns |
| [`knowledge-lifecycle.md`](knowledge-lifecycle.md) | Where does a learning go once the work is done? | this file | `close`, `authoring-agents-md` |
| `instruction-surfaces@1` | Which file gets a given fact, and how does it reach the agent? | `vibe-ops records norm --type instructions --facet policy --name surfaces --print` | `authoring-agents-md`, `setup`, and question 4 of the promotion test |
| [`authoring-style.md`](authoring-style.md) | How is a generated document written — phrasing, budget, tables, diagrams? | this file | every skill that writes prose into a target repo |
| `exposure-contract@1` | What may this record carry into a repository that will be cloned alone and may go public? | `vibe-ops records norm --type classification --facet policy --name exposure --print` | `new` and `close` directly; `authoring-style.md` for everything else that writes prose |
| `harness-pair@1` | What binds a rule, the guard enforcing it and the reading that says whether it worked into one signal? | `vibe-ops harness policy --name pair --print` | `setup` (harness mode) and `new-signal` |
| `harness-model@1` | What is a repository's harness made of, and how is a gap in it judged rather than merely counted? | `vibe-ops harness policy --name model --print` | `setup` (harness audit); the `governance-auditor` agent, for what its readings mean |
| `template-shape-change@1` | A template's shape changed — what else has to change with it? | `vibe-ops records norm --type base --facet policy --name migration --print` | `new-migration` when the note is written; `migrate` when it is applied |

The decisions behind them are recorded in [`../project/adr/`](../../project/adr/): ADR-0001 for the taxonomy
and the verbs, ADR-0002 for the promotion test, ADR-0003 for placement and the enforcement ladder. A
reference states the rule as it is applied; the ADR states why it is that way and what was rejected. When
they disagree, the ADR is the record of the decision and the reference is the bug.
