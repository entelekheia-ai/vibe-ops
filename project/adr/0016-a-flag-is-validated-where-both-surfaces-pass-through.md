---
vibe-ops-template: adr@2
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0016: A flag is validated where both surfaces pass through, and a shared schema may only widen

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-14 |
| Deciders | Danilo Borges |

---

## Context

A module may declare verbs, and a verb may declare flags that are valid for it alone. That was the stated
contract and it was true of exactly one surface.

The terminal parsed with `parseArgs({strict: true})` against a flag set correctly scoped to the dispatched
verb, so it refused an inapplicable flag. `runModule` — the one place the terminal and MCP both pass
through, and where the command and the destructive gate are already validated — inspected no flag at all:
its entire flag handling applied module-level defaults and then copied whatever arrived. Over MCP an
inapplicable flag was therefore accepted, ignored, and reported as success.

The tool's own schema is what invited that call. An MCP input schema is **one static object shape per
tool**, so a tool per noun publishes every verb's flags for every verb. Passing a discriminated union
instead publishes `{"type":"object","properties":{}}` — measured against the SDK this repository depends
on, an empty schema and strictly worse than the union it would replace. The low-level server API does
publish arbitrary JSON Schema verbatim but validates nothing.

One tool per verb was costed: 22 verbs plus 4 flat modules is 26 tools against a listing budget shared
with every other installed plugin, and it invalidates the `<prefix>__<noun>` plus `command:` pattern that
eight shipped skill files document.

## Decision

We will validate flags in `runModule`, against the module's flags plus the dispatched verb's plus
`--source` where `needsSource` is declared. An undeclared flag exits 2 naming the sibling verb that owns
it; a `required` flag that is absent exits 2; a verb's own defaults are applied.

We will keep one tool per noun and one union schema, and make the union honest: every entry names the
verbs that accept it.

**A shared schema may only ever widen.** Where several verbs declare the same flag, the published `choices`
domain is the **union** across all of them, and `required` reaches the schema only when it holds for every
verb. Narrowing per verb belongs to `runModule` and the module.

## Options considered

- **Option A — a discriminated schema per noun.** The shape the plan preferred. Rejected on measurement:
  the SDK publishes it as an empty schema.
- **Option B — one tool per verb.** An exact schema per verb for free, with no rejection needed. Rejected
  on tool count against a shared listing budget, and on invalidating the call shape every shipped skill
  documents.
- **Option C — the low-level server API, publishing per-verb JSON Schema.** An exact schema and nine
  tools. Rejected because the SDK then validates nothing, so the repository takes over parsing,
  validation and error shaping — trading a real guarantee for a published constraint nothing enforces.
- **Option D (chosen) — one tool per noun, honest by rejection.** The union stays, because it is the
  SDK's constraint rather than a choice; what was missing was the refusal.

## Consequences

**Easier.** A call that cannot work fails loudly, naming what the verb accepts and which sibling owns the
flag it was given — where before it was silently dropped and reported as success. One exported helper
serves the terminal parser, the refusal and the schema, so the three cannot come to disagree.

**Harder.** The schema still lists flags a given verb will refuse, and no schema-level mechanism can fix
that while there is one tool per noun. The mitigation is descriptive: each entry names its verbs.

**The widen-only rule is not a style preference.** Both halves of it break the *sibling* verb rather than
the one being described, and both were caught by tests rather than by reasoning: publishing one verb's
narrower `--type` domain made a valid call on another verb unconstructible at the transport, and marking
a scoped flag `required` would have made a verb that takes none unreachable.

**A follow-on obligation.** `ModuleFlag.choices` is advertised and not enforced by `runModule`, on
purpose: value diagnosis stays with the module, so that a retired value can be answered with where it
moved rather than with a domain list. A future change that moves `choices` enforcement into `runModule`
would silently remove those messages.

## Related

- [Plan-027](../plans/027-one-resolve-and-a-schema-that-tells-the-truth.md) — the plan whose Track 2
  produced this, and whose Decision Log records what the measurements refuted.
