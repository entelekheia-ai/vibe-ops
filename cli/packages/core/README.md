# @entelekheia/vibe-ops-core

The contract every [vibe-ops](../../README.md) module implements, plus the two things a module must not
each solve its own way: where configuration comes from, and how an observation is recorded.

## `defineModule(definition, run)`

Returns the `{ definition, run }` pair the CLI and the MCP server both load. The `definition` is read by
every surface — `--help`, flag parsing, the MCP tool schema — so a module describes itself once.

```ts
import { defineModule } from "@entelekheia/vibe-ops-core";

export default defineModule(
  { id: "thing", version: "0.1.0", summary: "One line", flags: [] },
  async (context) => ({ code: 0, summary: "what happened" }),
);
```

Validated at definition time, because each of these fails silently otherwise: an id that is not lowercase
and hyphenated, an empty `summary` (invisible in `--help` and in MCP), a flag declared twice.

## `loadConfig(start)`

Finds `vibeops.config.ts` from `start` upward to the home directory, nearest key winning, `settings`
merged one level deep so one repo's override does not discard another module's settings. A file with no
default export is an error, never a silent skip.

## `createEmitter(options)`

Appends JSONL observations. **A producer records what was observed and never scores, ranks or grades it** —
there is no `severity`, `pass` or `score` field, deliberately, because thresholds belong to the consuming
product. Emitting an id the module does not declare throws, so the definition and the code cannot
disagree in silence.
