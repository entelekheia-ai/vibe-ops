---
vibe-ops-template: log@2
name: emitting-an-observation-nothing-can-read
description: The TypeScript emitter wrote a shape the receiving translator refuses at line 1, for its
             whole existence, while the shell producer beside it was ingested normally — emission
             succeeding says a file was written, never that anything can read it.
kind: trap
path:
  - "cli/packages/core/src/emit.ts"
  - "cli/packages/module-check/sh/gate-emit.sh"
attempted: 2026-08-11
source: Plan-012 Track 3
---

# A producer that writes successfully into a registry nothing reads

## What was attempted

Confirming that the observations `defineOps` emits reach the framework they are emitted for.

## What happened

They never had. The emitter wrote one flat object per observation —
`{observedAt, producer, repo, id, subject, value, tags}` — into the configured artifact directory. The
receiving translator validates a header line and refuses anything else:

```text
line 1 must open with {"kind":"gate",…}
```

So every artifact the emitter had ever produced failed at its first line. Meanwhile the shell producer
writing into the **same directory** used the header shape and was ingested normally, and this
repository's own `cli/AGENTS.md` asserted the two landed in one registry.

Nothing about the failure was visible from the producing side. `mkdir` succeeded, `appendFile` succeeded,
the file appeared, its contents were well-formed JSON, and the directory filled up run after run. The only
missing thing was a reader, and a producer has no way to notice that on its own.

## What to do about it

**Acceptance for a producer is ingestion, not conformance to a field list.** Reading the consumer's schema
and matching it by eye produces a file that looks right; running the consumer over the file is the only
thing that establishes it is right. Three checks are worth the minute they cost, and each rules out a
different way of being wrong:

- feed the consumer the **old** shape and confirm it fails, so the test is known to discriminate;
- feed it a shape that should be **rejected for a second reason** — a zero count, an empty population —
  and confirm the complaint moves to that field, which proves the parser reached it;
- feed it a **complete, valid** artifact and read what comes out the far end.

Two producers writing into one directory is the condition that hides this: the directory is never empty,
so "artifacts are being produced" stays true while half of them are unreadable. If a second producer is
added to an existing artifact directory, the shape it must match is whatever the **consumer** accepts —
not whatever the first producer happens to write, and not what the documentation says both write.
