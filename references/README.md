# references/

Shared policy the skills point at instead of restating. Each file here is the **single copy** of a rule
that governs more than one skill; a `SKILL.md` that repeats one of these has created a second copy, and
the copy in the skill is the one that goes stale.

Read from a skill at `${CLAUDE_PLUGIN_ROOT}/references/<file>`. These are not skills — the plugin manifest
exposes only `./skills/`, so nothing here is ever invoked directly. It is content a skill loads when its
own steps say to.

| File | Answers | Pointed at by |
|---|---|---|
| [`convergence-policy.md`](convergence-policy.md) | Is this skill target-state or event, and how does it reconcile a repo that already exists? | every target-state skill; `new` and `close` declare themselves events |
| [`knowledge-lifecycle.md`](knowledge-lifecycle.md) | Where does a learning go once the work is done? | `close`, `authoring-agents-md` |
| [`instruction-surfaces.md`](instruction-surfaces.md) | Which file gets a given fact, and how does it reach the agent? | `authoring-agents-md`, `repo-setup`, and question 4 of the promotion test |
| [`authoring-style.md`](authoring-style.md) | How is a generated document written — phrasing, budget, tables, diagrams? | every skill that writes prose into a target repo |

The decisions behind them are recorded in [`../project/adr/`](../project/adr/): ADR-0001 for the taxonomy
and the verbs, ADR-0002 for the promotion test, ADR-0003 for placement and the enforcement ladder. A
reference states the rule as it is applied; the ADR states why it is that way and what was rejected. When
they disagree, the ADR is the record of the decision and the reference is the bug.
