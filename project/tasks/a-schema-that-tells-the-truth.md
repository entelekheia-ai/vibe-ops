---
vibe-ops-template: task@3
---

<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Task: A schema that tells the truth

| Field | Value |
|---|---|
| Status | In Progress |
| Created | 2026-08-14 |
| Author | Danilo Borges |
| Issue | pending |
| Plan | [plans/027-one-resolve-and-a-schema-that-tells-the-truth.md](../plans/027-one-resolve-and-a-schema-that-tells-the-truth.md), Track 2 |

---

## Context

Plan-027 Track 2 was written against a premise that measurement refuted, and the refutation makes the
track both smaller and more important than it looked.

**The premise.** The plan describes one MCP tool per noun whose schema unions every verb's flags, so the
`task` tool advertises `plan` and `summary-file` on `resolve`, and the `plan` tool advertises `from` and
`project-dir` on all six of its verbs. It proposes replacing that with either a discriminated schema per
noun or one tool per verb, and it names the defect as "the tool inviting a call that cannot work".

**What is actually wrong is worse than the schema.** `runModule` — the one place both surfaces pass
through — validates the *command* and never validates a *flag*. Its entire flag handling applies
module-level defaults and then copies whatever arrived. So over MCP an inapplicable flag is not merely
advertised: it is accepted, ignored, and reported as success. The comment above that code asserts the
opposite. Rejection exists only on the terminal path, where `parseArgs` runs with `strict: true` against
a flag set correctly scoped to the dispatched verb.

The consequence for this plan is direct: its own success criterion — "the input schema of a given
`command` contains no flag that `runModule` would reject for that command" — is **vacuously satisfiable
today**, because `runModule` rejects nothing. Narrowing the schema without adding the rejection would
satisfy the criterion on paper and leave the defect in place.

**And the option the plan prefers does not exist.** Measured 2026-08-14 against the MCP SDK this
repository depends on: a discriminated union passed as `registerTool`'s `inputSchema` publishes
`{"type":"object","properties":{}}` — an empty schema, strictly worse than the union it would replace.
The SDK's shape extraction understands object schemas and raw shapes, and a union yields neither. The
low-level server API does publish arbitrary JSON Schema verbatim, including per-verb `allOf`/`if`/`then`,
but validates nothing at all — an invalid argument reached the handler in the same measurement.

So the direction is decided by what is real: **one tool per noun, made honest by rejection.** The call
shape every skill's prose documents survives, the tool count stays where it is, and a call that cannot
work fails loudly naming what the verb does accept.

## Work items

| # | Priority | Item | Effort |
|---|---|---|---|
| 1 | P0 | `runModule` rejects a flag the dispatched verb does not declare | M |
| 2 | P0 | `runModule` enforces a declared `required` flag, and applies a verb's own defaults | M |
| 3 | P0 | The schema names, per flag, which verbs accept it | M |
| 4 | P1 | A flag declaring `choices` is advertised as an enum | S |
| 5 | P1 | Two verbs declaring the same flag no longer lose the second description | S |
| 6 | P0 | The MCP suggestion builder scopes its flag set to the parsed verb | S |
| 7 | P0 | The assertion, over every tool and every verb | M |
| 8 | P1 | The two places that describe the old behaviour | S |

### 1. `runModule` rejects a flag the dispatched verb does not declare — P0

**What:** After the command is validated and before the destructive gate, compare the arriving flag names
against the module's flags plus the dispatched command's flags plus `--source` where `needsSource` is set.
Anything else exits 2.

**Why:** Measured in `cli/packages/cli/src/run.ts`: the function's whole flag handling is a defaults loop
followed by `Object.assign(resolved, flags)`. Nothing is rejected, and the comment directly above it
claims that a flag the module never declared cannot silently arrive.

**Change:** The message names the offending flag and what the verb does accept. When the flag is declared
by a *sibling* verb — the common case, since that is exactly what the union schema invites — it names that
verb instead, because "this belongs to `plan file`" is the answer and "valid: --json" is only half of it.
Placed before the destructive gate deliberately: a malformed call has not asked to run anything, so it
should not be offered a confirmation prompt first.

### 2. `runModule` enforces `required`, and applies a verb's own defaults — P0

**What:** A flag declared `required` and absent exits 2. Command-level `default` values are applied, which
today only module-level ones are.

**Why:** `required` landed in Track 1 with the verb that proved it and nothing consumes it yet. The
defaults gap is the same asymmetry seen from the other side: a verb may declare a default and never
receive it, which is a silent wrong answer rather than an error.

**Change:** Both in the same pass over the same declared-flag set item 1 builds.

**Not extended to `choices`.** Value diagnosis stays with the module. `records resolve --type plan` must
answer "plan resolves under its own noun", and a generic domain refusal in `runModule` would replace that
migration path with a list — which would undo, at the terminal, what Track 1 just built.

### 3. The schema names, per flag, which verbs accept it — P0

**What:** Each flag's description in the MCP schema is prefixed with the verbs that accept it; a flag the
module declares carries no prefix, because it applies to all of them.

**Why:** One static shape per tool is what the SDK publishes, so a union is unavoidable while there is one
tool per noun. What is avoidable is the union being *silent* about which verb each entry belongs to.

**Change:** Derived from the definition in `cli/packages/cli/src/mcp.ts`, so it cannot drift from what
item 1 enforces.

### 4. A flag declaring `choices` is advertised as an enum — P1

**What:** `choices` becomes a `z.enum` in the schema rather than a bare string.

**Why:** A client reads the schema before choosing arguments; listing the accepted values is the whole
point of declaring them.

**Change:** Note the consequence and accept it: an enum rejects an out-of-domain value at the transport,
before the module runs, so the module's own redirect message is unreachable over MCP. That is the right
trade — a client that reads the schema never constructs the bad call — and the redirect still serves the
terminal and any client that ignores schemas, which the module must handle regardless.

### 5. Two verbs declaring the same flag no longer lose the second description — P1

**What:** The de-duplication in the schema builder merges the verb prefixes instead of keeping the first
description and discarding the rest.

**Why:** The current loop keeps a `seen` set and skips a repeat outright. Track 1 removed one instance of
this (a flag declared at both module and command level, silently accepted), but the general case stands.

### 6. The MCP suggestion builder scopes its flag set to the parsed verb — P0

**What:** `cli/packages/cli/src/prefer-mcp.ts` builds its flag-arity map from the same union.

**Why:** It uses that map to decide whether a flag consumes the next token. A flag valid only for another
verb is in the map, so a bash line the hook rewrites can be mis-parsed — a positional swallowed as a flag
value.

### 7. The assertion, over every tool and every verb — P0

**What:** For every exposed module and every verb, assert that a flag the schema advertises is either
declared for that verb or refused by a real call.

**Why:** This is Plan-027's success criterion, and it is the one that was vacuous. It stops being vacuous
only once item 1 exists.

**Change:** `cli/packages/cli/test/mcp-nouns.test.ts` builds a server over four of the nine exposed
modules. Extend it to all nine, so the harness module and the three ops are covered too.

### 8. The two places that describe the old behaviour — P1

**What:** The comment in `cli/packages/cli/src/mcp.ts` claiming the module rejects a flag its verb does
not use, and the line in `cli/AGENTS.md` saying a verb's flags "are only valid for that verb".

**Why:** Both are true of the terminal and false of MCP. After item 1 they are true everywhere, and the
comment should describe what the code does rather than what it intended.

## Implementation order

<!-- Delegation: none. Item 1 changes the contract's enforcement point, which is the judgement this
     track turns on; items 3–5 are its schema-side expression and must agree with it exactly. The split
     agreed for this plan keeps design judgement here and sends only discovery and mechanical porting
     out, and nothing below is mechanical porting. -->

- [x] P0 — Items 1 and 2: the rejection and the required/defaults pass, in `run.ts`
- [x] P0 — Item 3, then P1 items 4 and 5: the schema side, in `mcp.ts`
- [x] P0 — Item 6: `prefer-mcp.ts` scoped to its parsed verb. `bin.ts` was folded into the same helper
      in the same pass — it held a third hand-written copy of the declared-flag list, and leaving it
      would have kept the drift this item exists to remove.
- [x] P0 — Item 7: the assertion over all nine exposed modules
- [x] P1 — Item 8: the comment and the instruction line
- [x] P0 — `npm run build && npm run typecheck && npm test`, then `vibe-ops check .`
      (done: build and typecheck green, gate green, 437 of 438 tests pass; the one failure predates
      this plan and is recorded in the sibling dossier)
- [x] P0 — Write the tool-identity decision into Plan-027's `Decision Log`, with what the measurement
      refuted and why one tool per verb was not chosen

## Surprises & Discoveries

- Observation: Plan-027 Track 2's success criterion could be satisfied without fixing anything, because
  the function it names as the authority does not do the thing the criterion assumes.
  Evidence: `runModule` in `cli/packages/cli/src/run.ts` validates the command and never inspects a flag;
  its flag handling is a module-level defaults loop followed by `Object.assign`.
- Observation: the schema shape this plan preferred cannot be published through the SDK's high-level API.
  Evidence: a discriminated union passed as `registerTool`'s `inputSchema` lists as
  `{"type":"object","properties":{}}`, measured 2026-08-14. The low-level server API publishes arbitrary
  JSON Schema verbatim but performs no validation — an argument the schema forbids reached the handler.
- Observation: narrowing a value domain in a shared schema breaks the *sibling* verb, not the one being
  narrowed — and the same is true of marking a flag required. A shared shape can scope neither.
  Evidence: publishing `records resolve`'s `--type` enum (`adr|rfc`) made `records list --type plan`
  fail at the transport with `Invalid enum value. Expected 'adr' | 'rfc'`, a call that is valid and had
  a passing test. Marking `--type` required would have done the same to `records census`, which takes no
  type at all. Both were caught by tests rather than by reading, after the reasoning that produced them
  looked sound.
- Observation: the narrow enum also swallowed the retirement message the sibling track had just built.
  Evidence: with `adr|rfc` published, `records resolve --type plan` over MCP returned a schema error
  instead of "plan resolves under its own noun (vibe-ops plan resolve)" — so a rename would have been
  experienced as a removal by exactly the callers most likely to have the old spelling. Unioning the
  domain fixed the sibling verb and restored the message in the same change, which is a sign the union
  is the right rule rather than a workaround for one case.
- Observation: `bin.ts`, `run.ts` and `mcp.ts` each built the declared-flag list themselves, and only two
  of the three ever ran on any one call — so no single call could reveal that they disagreed.
  Evidence: three separate spreads of `definition.flags` + `commandDef.flags` + `SOURCE_FLAG`. Replaced
  by one exported helper the three now share.

## Closure

- [x] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
