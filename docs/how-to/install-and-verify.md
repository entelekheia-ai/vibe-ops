# Install vibe-ops, and prove it actually installed

Two products ship from this repository and **you need both**: the Claude Code plugin (skills, agents,
hooks) and the CLI (`vibe-ops` on `PATH`). They are co-dependent by design — seven of the plugin's nine
hook registrations invoke `vibe-ops` by name and ship no script of their own, so a machine with the plugin
and no CLI gets a loud hook failure rather than a silent no-op.

The whole of this page is about the gap between *installed* and *working*, because the two diverge quietly
and the symptom is always the same: something behaving like an older version of itself.

## 1. The CLI

```bash
npm i -g @entelekheia/vibe-ops-cli
```

One command, twenty-one packages: the CLI declares what it needs and npm installs the closure. They are
separate packages on purpose — a record type is a package name in `config.types`, so a repository can
bind `plan` to its own and never resolve `@entelekheia/governance-plan`.

Verify — and verify the *resolution*, not just that a binary answered:

```bash
which vibe-ops
readlink -f "$(command -v vibe-ops)"   # says which install answered: a global one, or a linked tree
vibe-ops --version
vibe-ops check .        # against a repository with the harness, reports its checks and 0 failed
```

**Working on vibe-ops itself is the other install, and only one can be on `PATH`.** From a clone:

```bash
npm install && npm run build          # core builds first, explicitly; see cli/AGENTS.md for why
npm link -w @entelekheia/vibe-ops-cli
```

`npm link` points the binary at the working tree, so a rebuild is live. It replaces the global install
and is replaced by one — which is why the `readlink` above is part of verifying, not a debugging step:
the two are indistinguishable from `vibe-ops --version` alone whenever the tree and the registry carry
the same number.

## 2. The plugin

```bash
claude plugin marketplace add <path-to-this-clone>
claude plugin install vibe-ops
```

Verify with the first-party validator, then with this repository's own layer on top:

```bash
claude plugin validate . --strict
vibe-ops agents-md --list
```

**`validate --strict` passing is weaker evidence than it looks.** It ignores unknown frontmatter keys
entirely — measured against a control key — and it has passed a plugin agent whose `description` carried
an unquoted `": "`, which drops every field at load. It reads the manifest and the schemas; it does not
tell you a field is honoured, spelled correctly, or read at all.

## 3. The part that catches people: the install is a copy

A `source: directory` marketplace does **not** mean the tree you cloned is the tree that loads. Two
config fields have confusingly similar names and only the second decides what runs:

| File | Field | Points at |
|---|---|---|
| `~/.claude/plugins/known_marketplaces.json` | `installLocation` | your clone — the **marketplace's** location |
| `~/.claude/plugins/installed_plugins.json` | `installPath` | `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` — the **plugin's**, where skills actually load from |

Installing **copies** the tree into that versioned cache and records the commit it copied. So
`${CLAUDE_PLUGIN_ROOT}` resolves there, never to your clone.

The cache path is keyed by the version, and **this repository is under a deliberate version freeze**, so
the copy made on install day runs until you replace it. An install once sat ten commits behind, still
offering a skill under its pre-rename name.

Two ways out, and the second is better while you are developing:

```bash
claude plugin uninstall vibe-ops && claude plugin install vibe-ops   # re-copies at the same version
claude --plugin-dir <path-to-this-clone>                            # bypasses the cache entirely
```

To check whether you are stale, compare the recorded commit against your clone:

```bash
git rev-parse HEAD
grep -o '"gitCommitSha": *"[^"]*"' ~/.claude/plugins/installed_plugins.json
```

## 4. Where the norm comes from

Anything that compares a repository against the installed norm — `vibe-ops harness status`, `sync`, and
the `SessionStart` hook — reads it from the **activated governance packages**
(`@entelekheia/governance-<type>`), which travel with the CLI (Plan-033, ADR-0019). Installing the CLI is
installing the norm; nothing extra to point at, from a Claude Code session or a bare terminal alike.

A repository can **pin an older tree instead**, and the pin wins over the bundled packages — that is what
a pin is for:

```bash
vibe-ops harness status . --source <path-to-an-older-clone>/plugin
```

or once, in a `vibeops.config.local.ts` beside the repository or in your home directory:

```ts
export default { harness: { source: "/absolute/path/to/pinned/plugin" } };
```

A single type can also be re-bound to another package in the committed config —
`types: { plan: "@scope/pkg#plan" }` — the config is the registry. Nothing resolving at all is **not an
error**: `status` says there is nothing to compare against, which is a different answer from "you are up
to date".

## Troubleshooting

| Symptom | Cause |
|---|---|
| A skill answers to a name you renamed | the install is a stale copy — §3 |
| A hook fails loudly naming `vibe-ops` | the CLI is not on `PATH`; the co-dependency is deliberate |
| `harness status` says nothing to compare against | no norm resolved — §4 |
| `check` reports 0 checks | you are not inside a git repository, or pointed at the wrong path |
| A verb exists in the CLI but not as an MCP tool | the MCP server is started once per session; restart it |

## Related

- [`cli/README.md`](../../cli/README.md) — the packages, and the full install recipe for each.
- [How to promulgate the norm into a repository](promulgate-the-norm.md) — the first thing to do with a
  working install.
