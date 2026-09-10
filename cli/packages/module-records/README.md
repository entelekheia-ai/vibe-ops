# @entelekheia/vibe-ops-module-records

**The cross-type record verbs: census a repository, resolve a layout for a type with no noun of its own,
read the norm behind a type's facet, and show or list what is already written.** A vibe-ops module: the
`records` noun on the `vibe-ops` CLI, and the same verbs as MCP tools.

## Why

`plan`, `task` and `log` each resolve under their own noun, because each has lifecycle actions of its own
(`plan close`, `task guard`, …). `adr` and `rfc` do not — Plan-011 put no lifecycle verbs on them — so
`resolve` (directory, template, next number) still answers for those two here, rather than gaining a noun
of their own for one verb apiece.

Four other questions belong to no single type: `census` reads the template-version every governance record
in a repository declares, `handling` says which documents describe one record's shape, `show` reads one
record's status, sections and open tracks, and `list` reports every record of one type with its status.
Nothing on a noun answers those — narrowing them to the types that have a noun would remove the only way
to ask. `norm` is the proxy verb the Claude Code plugin skills read through: where the installed norm's
copy of a type's template, authoring rules, migration notes, or composed style policy actually is, so an
npm-only install (no `${CLAUDE_PLUGIN_ROOT}`) can still resolve it.

## Install

This package is part of the `vibe-ops` CLI; installing the CLI installs it.

```bash
npm i -g @entelekheia/vibe-ops-cli
```

## Usage

```
$ vibe-ops records census
adr/
  project/adr/0001-skill-taxonomy-target-state-vs-event.md                                                 adr@2
  project/adr/0002-knowledge-lifecycle.md                                                                  adr@2
  ...
rfc/
  project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md                                         rfc@2
  ...
```

```bash
vibe-ops records census                       # every record in this repository, with its template version
vibe-ops records handling [<path>...]          # which version each declares, and what describes that shape
vibe-ops records show <path>...                # one record: status, sections, open tracks, entries, migrations owed
vibe-ops records list --type adr|rfc|plan|task # every record of one type, with status and (for a plan) open tracks
vibe-ops records list --type plan --fields all # a chosen projection instead of the default file,type,status,tracks
vibe-ops records resolve --type adr|rfc        # directory, template and next number — plan/task resolve under their own noun
vibe-ops records resolve --type adr --next-number
vibe-ops records resolve --type adr --template
vibe-ops records norm --type <t> --facet template|authoring|migrations|policy [--name <n>] [--print]
```

`handling` with no path censuses the whole repository — the same reading `census` gives, because the two
differ only in population. `norm --type style --facet policy` is served by `--for <artefact>` and
`--explain` instead of `--name`, since a style policy is a composed stack of layers rather than one file.

Add `--json` to any command for the structured object instead of lines.

## Requirements

Runs wherever the `vibe-ops` CLI runs: Node ≥ 22.18.

## License

Apache-2.0 — see [LICENSE](../../../LICENSE) in the repository root.
