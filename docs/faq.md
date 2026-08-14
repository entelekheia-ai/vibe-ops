# Questions people actually ask

Not a fifth Diátaxis quadrant — a **way in**. Each answer is one or two lines and a pointer to the page
that owns it. If an answer here grows past that, it belongs in the page it points at and this entry
should shrink back.

## Getting started

**What is this, in one sentence?**
Two products from one tree: a Claude Code plugin that scaffolds repositories and authors their governance
docs, and a CLI that does the deterministic half — from a terminal or over MCP. See
[`README.md`](../README.md).

**Do I need both halves?**
Yes. Seven of the plugin's nine hook registrations invoke `vibe-ops` by name and ship no script, so the
plugin without the CLI fails loudly by design. [Install and verify](how-to/install-and-verify.md).

**I installed it and a skill is behaving like an older version of itself.**
Almost always the install cache. Installing *copies* the tree to a version-keyed path, and this repository
is under a version freeze, so the copy made on install day runs until you replace it.
[Install and verify §3](how-to/install-and-verify.md).

**Where do I start on an existing repository?**
`/vibe-ops:setup harness audit` — it writes nothing and tells you what the repository has and lacks. Every
number in its report comes from a command rather than a reading.

## The norm, and what gets overwritten

**What do `norm`, `seed` and `repo` mean?**
The three ownership classes: `norm` this tooling overwrites, `seed` it writes once when absent and never
again, `repo` it never touches and stops if it would have.
[What the norm owns](explanation/what-the-norm-owns.md).

**Will this overwrite my `AGENTS.md`?**
No. It is `seed` — written once if absent, yours from the moment it exists. `seed` is the largest class,
and promulgation being safe is mostly a statement about how little it overwrites.

**What if a path is not in the declaration at all?**
The run stops and reports it. Absence of an entry is never read as permission.

**Can I change the classes for my repository?**
No, and deliberately. A boundary each repository can redraw is not a boundary — it is a negotiation that
happens when someone is mid-promulgation and wants the run to finish. What *is* per repository is which
version of the boundary you have agreed to.

## Promulgation (`harness sync`)

**Will it disturb what I am working on?**
No. It builds a linked working tree of its own; your checkout, branch and uncommitted work are untouched.
[Promulgate the norm](how-to/promulgate-the-norm.md).

**Where did my changes go? I do not see them.**
On a branch, `vibe-ops/norm-<n>`, with a tag. It does not merge and does not push — that is your call,
made whenever you like.

**It said `SWALLOWED` and exited non-zero.**
A file was written and your clone's ignore list ate it before it reached the index — often
`.git/info/exclude`, which is not in the repository and which nobody remembers. The rule that caught it is
named in the message. [Promulgate the norm §3](how-to/promulgate-the-norm.md).

**It said `REFUSED … (seed → norm)`.**
The ownership boundary changed in the one direction that takes something away from you, and this clone has
not agreed to it. Read the paths, then `--accept-boundary <n>` if you accept.
[Promulgate the norm §4](how-to/promulgate-the-norm.md).

**Can I promulgate into ten repositories at once?**
Not in one call — a module is handed exactly one repository. Loop; each gets its own branch and tag.

**Can I undo it?**
Delete the branch and the tag. Nothing else was written.

## Records and versions

**Which version is my repository on?**
Two different versions, and confusing them is the common mistake: what each *record* was written against
(its own frontmatter) and what was *promulgated* into the clone (`vibeops.config.local.json`).
[Upgrade a repository](how-to/upgrade-a-repository.md).

**Should I migrate records or promulgate first?**
Migrate first, then promulgate. Otherwise a reader meets a repository whose template says one thing and
whose records say another.

**Why is the session telling me nothing when I expected a warning?**
Either the versions match, or this clone was never promulgated to — which are different states.
`vibe-ops harness status .` distinguishes them.

## The gate

**What is the difference between a gate and an ops?**
A **gate** is a pure detector that knows nothing about which repository it is in. An **ops** is a named
composition of gates over declared paths, and it decides which of them record observations.
[Write a gate](how-to/write-a-gate.md).

**A check fails and I cannot fix it today.**
Declare it off with a reason in that repository's config — never a boolean. It then reports `SKIP` naming
the reason, and `git grep` over those is the debt register.
[Upgrade a repository §5](how-to/upgrade-a-repository.md).

**Why is my check green when it should be red?**
Check whether it examined anything. A population that shrank to zero in silence is indistinguishable from
a clean run, and only one of the two is a reading — which is why runs report `examined` and `ignored`
beside the result, and why `--self-test` exists.

## Surfaces

**CLI or MCP tool?**
Prefer the tool where it is listed: it returns the report as structured data rather than terminal text to
read back. The CLI stays correct either way. Tool names are prefixed by however the server was registered,
so nothing here hardcodes one.

**Why does an MCP tool list a flag my command rejects?**
An MCP input schema is one static shape per tool, so a tool per noun publishes every verb's flags. Each
entry names the verbs that accept it, and calling one with the wrong verb is refused by name rather than
silently ignored.

**Should this be a hook?**
Only if it delivers something a line in an instruction file cannot: state read from disk at that instant,
or context placed where an instruction file cannot reach. [Add a hook](how-to/write-a-hook.md).

## Contributing

**Where does a decision go?**
ADR if it is hard to reverse, RFC if it is still open, a plan if it is decided work too large for one
task, a task dossier if it is being done now. [`GOVERNANCE.md`](../GOVERNANCE.md) is the map.

**Where does something I learned go?**
Through a closure ceremony — `/vibe-ops:close-task` or `/vibe-ops:close-plan` — which routes each entry to
whichever surface matches what the fact is, including "nowhere". Never by hand.

**Why is there a rule about this instead of a check?**
There usually should not be. Anything mechanically checkable becomes a check fragment rather than a
sentence, and a sentence a new guard makes redundant gets deleted.
