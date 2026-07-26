# AGENTS.md — rfc/

**Design proposals**, not final specifications.

- Code, schemas, and interfaces described here are **illustrative** — they communicate design intent, not
  something to implement directly.
- No RFC here is a source of truth for implementation. The source of truth is the code (and its docs).

## Before implementing anything based on an RFC

1. Check the RFC header status is `Accepted` — `Draft` RFCs are still under discussion and may change.
2. Confirm with the maintainer that it has been ratified.

## Lifecycle

```
Draft → Review → Accepted → Implemented
                ↘ Rejected
                ↘ Superseded (by another RFC)
```

An RFC leaves `Draft` only after explicit review. After `Implemented`: **frozen** — move it to
`implemented/`, do not edit further (canonical docs live in the code/docs). After `Rejected`: move it to
`rejected/` as a record of what was considered and why.

## Structure

```
rfc/
├── AGENTS.md          ← this file
├── <NNNN>-<name>.md   ← active RFCs (Draft / Review / Accepted)
├── implemented/       ← frozen
└── rejected/          ← frozen
```

## Relationship to tasks/

An `Accepted` RFC often produces one or more task dossiers describing the concrete implementation steps.
RFCs require ratification and freeze after implementation; tasks need no ratification and are removed after.

Use `/vibe-ops:new-rfc` to scaffold one. See [`../../GOVERNANCE.md`](../../GOVERNANCE.md) for the full process.
