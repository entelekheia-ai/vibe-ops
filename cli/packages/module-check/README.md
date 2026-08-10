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

## The checks are shell, and stay shell

`sh/checks/` holds one fragment per check, composed at run time by `sh/check-agents-md.sh`. This package
is their front door, not a rewrite: porting them would have shipped freshly-written checks with no history
of having caught anything, and every one of them exists because a failure got through by hand at least
once.

`--self-test` is the acceptance criterion for the runner itself. **A check that detects nothing passes
exactly like a check that works**, so the fixture is deliberately broken and every check must fire on it.
