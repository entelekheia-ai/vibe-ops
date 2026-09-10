# @entelekheia/vibe-ops-cli

The `vibe-ops` binary: module dispatch for a terminal, and the same modules as MCP tools. Usage,
configuration and how to write a module are in [`../../README.md`](../../README.md).

## Dispatch

`vibe-ops <name>` resolves a bare name to `@entelekheia/vibe-ops-module-<name>` and takes anything
starting with `@`, `.` or `/` verbatim — so a built-in, a published third-party module and a local path
are all invoked the same way. **There is no registry file**: a registry is a second place to forget, and a
module missing from it looks broken rather than absent.

`records` is a bare name, dispatched with no path or `@scope` — resolved straight to
`@entelekheia/vibe-ops-module-records`:

```
$ vibe-ops records census
adr/
  project/adr/0001-skill-taxonomy-target-state-vs-event.md                                                 adr@2
  project/adr/0002-knowledge-lifecycle.md                                                                  adr@2
  project/adr/0003-instruction-file-architecture.md                                                        adr@2
  ...
rfc/
  project/rfc/0001-gates-and-ops-as-the-cli-unit-of-composition.md                                         rfc@2
  project/rfc/0002-bootstrapping-a-repository-and-what-auto-configuration-may-decide.md                    rfc@2
  ...
```

Trimmed with `...`; the full run also lists `plan/`, `task/` and `log/`.

## MCP

`vibe-ops mcp` serves every configured module over stdio; `--http` serves the same over streamable HTTP.

**Stateless by construction** — the server and its transport are built per request, with
`sessionIdGenerator: undefined`, and nothing is retained between calls. These modules act on a repository
on disk, so the repository *is* the state; a session would add a weaker second copy of it that goes stale
the moment anything else writes to the tree.

## Programmatic API

`loadModule`, `runModule` and `buildServer` are exported, so a package can build on the same dispatch
rather than shelling out to the binary.
