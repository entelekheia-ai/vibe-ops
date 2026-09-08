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
  check: { disabled: { "private-names": "the private layer, tracked in project/plans/020" } },
},
```

`VIBE_OPS_DISABLED_CHECKS` in the environment still works and still wins, and that is the division: it is
an override at the point of invocation, for a single run. A declaration that lives *only* there lives in
whatever script exports it, so the same repository checked from a hook, from a sibling directory, or from
an editor is a different configuration each time — which is how a known backlog comes back as failures.

A declared id that no composed check answers to is reported. It changes no run, which is precisely why it
would otherwise sit in the config reading as though something were switched off.

## Eight checks are shell, and stay shell until their port earns it

`sh/checks/` holds one fragment per remaining check, composed at run time by `sh/check-agents-md.sh`. This
package is their front door, not a rewrite: writing a new one from scratch would ship a freshly-written
check with no history of having caught anything, and every fragment here exists because a failure got
through by hand at least once. Nine fragments crossed that bar already — a corpus wide enough, no
divergence from their TypeScript port ever reported, and both sides made to fail on one shared fixture —
and Plan-038 Track 7 deleted them, along with `fragment-parity`, the gate that had measured the
comparison. `vibe-ops check` composes what is left here beside the TypeScript ops declared in
`config.ops`, merging both into one `N checks, M failed` line.

`--self-test` is the acceptance criterion for the runner itself. **A check that detects nothing passes
exactly like a check that works**, so the fixture is deliberately broken and every check must fire on it.
