---
"@entelekheia/vibe-ops-core": minor
"@entelekheia/vibe-ops-gates": minor
---

`markdown-link` resolves a link against the repository instead of the disk, so the same commit gets the
same verdict from every checkout — the main one, a `git worktree`, CI, a fresh clone
([#41](https://github.com/entelekheia-ai/vibe-ops/issues/41)).

- **New findings, and a run can go red where it was green.** A link to a file that exists on disk but is
  not in the index fails as `links-untracked`: it resolved on the author's machine and nowhere else. A
  link into a path the repository ignores fails as `links-ignored` (a `warn` when the linking document is
  itself ignored). Level or ignore either rule through `settings.<ops>` as usual.
- **`targets` in `vibeops.config`** declares what a repository means by a link into an ignored path.
  `{ ignored: "follow" }` resolves it on disk in the main working tree, from a linked one too — for a
  root that tracks only its own governance and links into sibling repositories. The default is
  `"report"`. `settings.<ops>.targets` overrides it for one ops.
- **Core exports `createTargetResolver`**, and `GateRunContext` gains an optional `targets` field, built
  once per run by the ops. A gate that resolves a reference reads
  `context.targets ?? createTargetResolver(repoRoot)` rather than calling `existsSync`.
