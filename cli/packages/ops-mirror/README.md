# @entelekheia/vibe-ops-mirror

What one place claims, another place must confirm.

```bash
vibe-ops mirror              # run it
vibe-ops mirror --list       # the gates composed, and the paths each runs over
vibe-ops mirror --self-test  # assert every gate that declares a fixture still fires on it
```

## The subject, and why it is its own ops

Every entry here holds two things side by side and fails when they stop agreeing — a manifest against the
marketplace entry describing the same plugin, a registration against the scripts on disk, a template
against the prose describing its shape, a shell fragment against the gate that ports it. None of them
asks *"is this file well formed?"*; each asks *"do these two still say the same thing?"*, and neither
side is the subject on its own.

That is the membership rule, and it is narrower than it looks: an entry belongs here when describing it
by naming only one of the two things it reads would be wrong. Being internal to this repository is not
enough — `unstated-destination` stays in `for-vibe-ops`, because it reads the migration notes as *itself* rather
than against a counterpart.

## What this package replaced

Before Plan-037 these entries were scattered across whichever ops happened to touch their subject, and a
classification pass measured the consequence: every one of them is meaningless in a repository that
publishes no Claude Code plugin or holds no vibe-ops checkout, and nothing distinguished them from the
entries beside them that are meaningful everywhere. A composition announced seventeen checks and
delivered seven.

An `audience` field was built to filter them and removed unshipped — a boundary that has to be switched
on, by a switch nothing turns, is not a boundary. This package **is** the boundary: a repository that
does not install it composes none of these, with nothing to declare and nothing to filter.

## `template-heading-drift` arrived from `for-vibe-ops`, and the reason `for-vibe-ops` exists survived

`governance` excludes `**/templates/**` from every entry through a single `"*"` line. That line is a
**safe default** — a gate added there inherits it without anyone thinking about it — and it is exactly
wrong for the one gate whose subject is the content of those shipped copies. This ops declares no such
exclusion and is not `governance`, so the default it would have broken is not in force here.

Its settings slice moved with it, and that move is worth knowing about: `settings` is keyed by **ops
id**, so a slice left behind is never read and the entry runs unconfigured — silently, with no error.
Here that meant a twelve-path policy switching off at once. Moving an entry between compositions means
moving its configuration in the same commit.

## The four `fragment-parity` entries are the shortest-lived members

Each compares a shell fragment against the gate that ports it — the evidence RFC-0001 requires before a
fragment is removed at all. They retire with the fragments they read; this ops outlives them, because
the other entries compare pairs that are not going away.
