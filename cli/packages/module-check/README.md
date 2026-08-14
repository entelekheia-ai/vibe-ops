# @entelekheia/vibe-ops-module-check

`vibe-ops check` — the mechanical governance checks: the `AGENTS.md` line budget, every relative link
resolving inside the repository, the `.agents/` ↔ `.claude/` symlink bridge, rule and skill frontmatter,
licence texts against pinned digests, and no machine path or personal-memory link in tracked markdown.

It checks **the repository you point it at**, not the one it lives in, and writes nothing into it.

```bash
vibe-ops check              # the repository you are standing in
vibe-ops check --list       # what was composed, and the file each check came from
vibe-ops check --self-test  # assert every check still fires on a deliberately broken fixture
```

## Declaring a check off

A repository with a real backlog still gets the gate, with the failing check declared off — reported as
`SKIP` naming the reason, never a silent pass. The declaration belongs in the repository's own config,
where every caller of the gate reads it:

```ts
settings: {
  check: { "machine-paths": "the private layer, tracked in project/plans/020" },
},
```

`VIBE_OPS_DISABLED_CHECKS` in the environment still works and still wins, and that is the division: it is
an override at the point of invocation, for a single run. A declaration that lives *only* there lives in
whatever script exports it, so the same repository checked from a hook, from a sibling directory, or from
an editor is a different configuration each time — which is how a known backlog comes back as failures.

A declared id that no composed check answers to is reported. It changes no run, which is precisely why it
would otherwise sit in the config reading as though something were switched off.

## The checks are shell, and stay shell

`sh/checks/` holds one fragment per check, composed at run time by `sh/check-agents-md.sh`. This package
is their front door, not a rewrite: porting them would have shipped freshly-written checks with no history
of having caught anything, and every one of them exists because a failure got through by hand at least
once.

`--self-test` is the acceptance criterion for the runner itself. **A check that detects nothing passes
exactly like a check that works**, so the fixture is deliberately broken and every check must fire on it.
