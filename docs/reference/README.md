# reference/

**Information-oriented** docs: precise, dry, complete descriptions of what exists — public APIs, schemas,
configuration, CLI flags. The reader already knows what they want; help them look it up fast. No tutorials,
no opinions. Mirror the code; when they diverge, the code wins.

**This folder is deliberately near-empty.** A reference that lives away from the code it describes is the
copy that goes stale, so each package documents its own surface and the index of them is
[`cli/README.md`](../../cli/README.md#packages). Start there — in particular
[`vibe-ops-core`](../../cli/packages/core/README.md), which carries the module, gate, ops and document-model
contracts.

A reference doc belongs *here* only when it describes something no single package owns.

- [**Hook surfaces**](hook-surfaces.md) — every entry point that reads a hook payload on stdin, what each
  one guards on, and the two places a hook is registered. Here because the contract is split across the
  CLI, `plugin/hooks/hooks.json` and a skill's own frontmatter, so no package holds all of it. The recipe
  is [how-to/write-a-hook.md](../how-to/write-a-hook.md).
