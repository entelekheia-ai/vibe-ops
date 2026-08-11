# vibe-ops — the Claude Code plugin

This directory is the plugin itself: what `claude plugin install` copies and what Claude Code loads. The
project's front page, with the argument for why any of this exists, is [`../README.md`](../README.md).

## Install

```bash
claude plugin marketplace add entelekheia-ai/vibe-ops
claude plugin install vibe-ops@entelekheia
```

The repository is the marketplace and this directory is the plugin — `marketplace.json` at the repository
root points here with `source: "./plugin"`. To iterate without installing, use
`claude --plugin-dir ./plugin`, which bypasses the versioned install cache entirely.

## Commands

| | |
|---|---|
| `/vibe-ops:setup <repo\|harness>` | Set up **or reconcile** a repo or npm-workspaces monorepo (`repo`), or the guide-and-sensor apparatus that checks it (`harness`). `audit` reports without writing. |
| `/vibe-ops:new <adr\|rfc\|plan\|task>` | Open one governance record, using the *target repo's* own template and numbering. |
| `/vibe-ops:close-task` | Close a dossier — write back, route what the work taught, distil into the issue, then delete it leaving a git breadcrumb. |
| `/vibe-ops:close-plan` | Close a plan — retrospective against its own goals, demotion check, issue closed, then the file moves to `shipped/` with its number. Never deleted. |
| `/vibe-ops:migrate [path]` | Bring artifacts up to the current template version, per artifact rather than per plugin. |
| `/vibe-ops:new-migration <type>` | Move a template's version and write the migration note, as one act. |
| `/vibe-ops:new-signal <rule>` | Turn one rule into a matched trio: the prose, the guard, and the fixture proving the guard fires. |
| `/vibe-ops:authoring-agents-md` · `authoring-readme` | Write or repair the two files a newcomer — human or agent — reads first. |
| `/vibe-ops:license-setup` | `LICENSE`, `NOTICE`/`AUTHORS` for a fork, optional header enforcement. |

`authoring-agents-md`, `authoring-readme` and `new-migration` are **path-scoped**: they also arrive while
you are editing the file they govern, not only when invoked.

## What ships

| | |
|---|---|
| `skills/` | The commands above. A `templates/` folder beside a `SKILL.md` holds files the skill copies at runtime. |
| `templates/` | The versioned governance templates (`plan`, `task`, `adr`, `rfc`) that `/new` and `/migrate` read. |
| `hooks/` | The only always-on surface — six guards, each silent unless its exact condition holds. |
| `references/` | Shared policy the skills point at instead of restating. |
| `scripts/` | Runtime helpers the plugin executes inside a target repo. |

Everything written into a target repository is in **English**, whatever language the conversation is in.

## Not shipped from here

The mechanical checks are a separate product: [`../cli/`](../cli/README.md), run as `vibe-ops check`. A
skill that needs them reaches a sibling path that exists only inside a clone of this repository, never in
an install — which is why the CLI is installed on its own rather than bundled.

Working on the plugin: [`AGENTS.md`](AGENTS.md).
