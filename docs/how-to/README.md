# how-to/

**Task-oriented** recipes: numbered steps that get one real goal done ("How to add a package", "How to
publish a release"). Assume a competent reader with a specific need. One goal per doc; keep it to the steps
that goal requires.

- [**Install vibe-ops, and prove it actually installed**](install-and-verify.md) — both halves, why they
  are co-dependent, and the gap between *installed* and *working* that makes a skill behave like an older
  version of itself.
- [**Promulgate the norm into a repository**](promulgate-the-norm.md) — `harness sync`, its branch and
  tag, and what each of its three refusals is telling you.
- [**Bring a repository up to a newer norm**](upgrade-a-repository.md) — the two versions that move
  independently, why records migrate before the templates land, and what to do with a real backlog.
- [**Write a gate that reads document structure**](write-a-gate.md) — from empty folder to composed and
  running, including the four traps that fail silently rather than loudly.
- [**Add a hook**](write-a-hook.md) — from "should this be a hook at all" to a real session firing it,
  including why a hook that never runs is indistinguishable from one with nothing to say.
