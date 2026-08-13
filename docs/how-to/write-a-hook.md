# How to add a hook

A hook is the one always-on surface this plugin has: it fires in **every** repository where the plugin is
installed, without anyone invoking it. This walks a new one from "should this be a hook at all" to a real
session firing it, and names the traps that fail *silently* — a hook that never runs looks exactly like a
hook with nothing to say.

The catalogue of what exists is [reference/hook-surfaces.md](../reference/hook-surfaces.md); the decision
behind the shape is [ADR-0009](../../project/adr/0009-hooks-as-a-delivery-surface.md). Neither is repeated
here.

## 1. Earn the hook

**A hook is not a cheaper way to write a line in an instruction file.** It earns its place only by
delivering one of two things a line cannot:

- **State read from disk at that instant** — the next plan number, whether a closure box is checked.
- **Context placed where an instruction file cannot reach** — a plan-mode turn is written before anything
  under `project/` has been read.

If a static line would do the same job, write the line. If the rule is mechanically checkable after the
fact, write a [check fragment or a gate](write-a-gate.md) instead — that is a detector, and it is cheaper.

Then price the firing. `additionalContext` **re-enters the model**: every firing buys a full turn of
reasoning, tools and visible output. Measured over one workspace's history, 42 firings of the progress
nudge bought 263 model turns, and two-fifths of those ended in a paragraph explaining why nothing was
owed. A hook that fires often must say something worth a turn, or say nothing at all.

## 2. Pick the event, and check the payload actually carries what you need

Each event delivers a different object, and this decides everything downstream.

| You need | Event | The field |
|---|---|---|
| the file just written | `PostToolUse` | `tool_input.file_path` |
| to refuse a command before it runs | `PreToolUse` | `tool_input.command` |
| context at the top of a turn | `UserPromptSubmit` | `permission_mode`, `cwd` |
| context before a typed `/command` expands | `UserPromptExpansion` | `command_args` |
| the turn's writes, after the fact | `Stop` | `transcript_path` |

**Do not assume a field exists across events.** `tool_input.file_path` is Pre/PostToolUse only; reaching
for it from a `UserPromptSubmit` handler yields `undefined` and the hook exits silently forever.

## 3. Write it as a CLI surface, not a script

Add a function to [`cli/packages/cli/src/`](../../cli/packages/cli/src/) and register it in the `hook`
namespace. A shipped shell script would exist only to pull one field out of the JSON and wrap the answer
back into the envelope — and it would carry three hazards every hand-written hook here has a copy of: a
jq-or-nothing dependency, hand-rolled JSON escaping, and a second parse of the payload shape.

```ts
// cli/packages/cli/src/my-surface.ts
interface MyPayload {
  readonly session_id?: string;
  readonly cwd?: string;
}

export async function runMySurfaceHook(): Promise<number> {
  let payload: MyPayload;
  try {
    payload = JSON.parse(await readStdin()) as MyPayload;
  } catch {
    return 0;                                  // trap 1
  }

  if (/* the exact condition does not hold */) return 0;   // trap 2

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: text },
    })}\n`,
  );
  return 0;                                    // trap 3
}
```

Then add it to `HOOK_SURFACES` and the dispatch in
[`hook.ts`](../../cli/packages/cli/src/hook.ts). There is no registry file beyond that one array, which is
also what `--help` prints and what an unknown surface's error message names.

**`ops` is a reserved first word** in that namespace. Do not name a surface something an ops might be
called, and do not add a surface that shadows one.

## 4. Register it

Two shapes, and the choice is about **lifetime**, not about the event.

**Always on** — [`plugin/hooks/hooks.json`](../../plugin/hooks/hooks.json), auto-discovered, no manifest
entry:

```json
{ "type": "command", "command": "vibe-ops", "args": ["hook", "my-surface"], "timeout": 10 }
```

**Only while a skill is active** — that skill's own `hooks:` frontmatter. Combined with `paths:` the chain
costs nothing standing.

Either way the `command` is `vibe-ops` directly: no `sh`, no wrapper, **no `command -v` guard**. A machine
without the CLI on `PATH` must fail loudly rather than present an install that looks like it works.

Update `hooks.json`'s top-level `description` in the same edit. It states how many shipped `.sh` scripts
are registered, and [`25-hooks-registration.sh`](../../cli/packages/module-check/sh/checks/25-hooks-registration.sh)
checks that number — a `command: "vibe-ops"` entry ships no script and does not count toward it.

## 5. Exercise it with a real payload on a real stdin

```sh
npm run build && npm link -w @entelekheia/vibe-ops-cli

printf '{"session_id":"probe","permission_mode":"plan","cwd":"'"$PWD"'"}' | vibe-ops hook my-surface
```

Assert **both branches**: the one that speaks, and the one that must not. A hook is judged mostly by its
silence, so a test that only proves it fires proves half of it. Follow
[`hook.test.ts`](../../cli/packages/cli/test/hook.test.ts), which spawns the real binary — a hand-built
payload object passed to the function does not exercise the transport, and transport is where a stray
`console.log` corrupts the response.

Then run it in a **real session**: `claude --plugin-dir <this tree>`. That bypasses the versioned install
cache, which under the release freeze never refreshes itself, so a change made here reaches an installed
plugin only after an uninstall/install cycle.

**A headless `claude -p` run does not deliver a `Stop` hook**, and each `-p` invocation ends its session —
so `SessionEnd` clears per-session state and every resumed turn arrives as a *first* event. Session-scoped
behaviour is exercised in a real session, or against fixtures the way
[`27-nudge-behaviour.sh`](../../cli/packages/module-check/sh/checks/27-nudge-behaviour.sh) does.

## 6. If it keeps state, say who deletes it

Per-session state goes in `$CLAUDE_PLUGIN_DATA` (falling back to `$TMPDIR`, then `/tmp`), named
`vibe-ops-<kind>-<session_id>`. Two things must be true, and the first was once false for a year:

- [`session-state-cleanup.sh`](../../plugin/hooks/session-state-cleanup.sh) deletes it at `SessionEnd` —
  add the name there, or nothing ever collects it. Counted once: 13 stray markers on disk.
- `SessionEnd` never fires for a crashed or killed session, which is what the age sweep in
  `plan-progress-nudge.sh` exists for. Keeping the `vibe-ops-*` prefix is what puts a new file under it.

A state directory that cannot be written must cost a repeated injection, never a failed hook.

## The traps

| # | Trap | What it looks like | What to do |
|---|---|---|---|
| 1 | Throwing on a malformed payload | Claude Code reports a hook failure, and the repository looks broken | Catch and `return 0` — fail silent, never fail open while appearing to work |
| 2 | A guard that never holds | Perfect silence, forever, indistinguishable from a working hook with nothing to say | Assert the speaking branch in a test, not only the silent one |
| 3 | A non-zero exit as enforcement | The turn is blocked by an advisory surface | Exit 0 on every path a hook reaches; report in `additionalContext` |
| 4 | Writing to stdout for any other reason | One stray line corrupts the response envelope | Only the single JSON line; a module reached this way prints only under `surface: "cli"` |
| 5 | Restating a format in the hook's own prose | Right against today's template, wrong the day it changes, and nothing detects the drift | Read it from the artifact — the template's markers, the resolver's output |

Trap 5 is the one with a measurement behind it: the plan-mode hook listed the plan template's living
sections in its own text, which was correct until the template dropped two of them, at which point it
prescribed a format that had been deleted. The names now cross the boundary as a list from
[`vibe-ops plan resolve`](../reference/hook-surfaces.md), and there is no second place to write them down.

## Verify

```bash
npm run build && npm test
vibe-ops check .          # 25-hooks-registration accepts the new registration
vibe-ops --help           # the surface is listed
```

A hook that produced no output in testing has proven nothing yet. Make its condition hold once, on purpose,
and watch it speak.
