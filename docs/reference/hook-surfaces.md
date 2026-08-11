# Hook surfaces

Every entry point that reads a [Claude Code hook](https://docs.claude.com/en/docs/claude-code/hooks)
payload on stdin, and the two places one is registered.

This is a reference, not a rationale: *why* a hook is the CLI rather than a shipped script is
[ADR-0009](../../project/adr/0009-hooks-as-a-delivery-surface.md), and the design narrative is
[explanation/](../explanation/). It lives here rather than in a package README because no single package
owns it — the verbs are in `cli/packages/cli`, the registrations are in `plugin/`.

## `vibe-ops hook <surface>`

Implemented in [`cli/packages/cli/src/hook.ts`](../../cli/packages/cli/src/hook.ts). One namespace, one
member per hook **event**; the payload field, the guard and the reply's `hookEventName` differ in each.

| Surface | Event | Reads from the payload | Runs when |
|---|---|---|---|
| `ops <ops> [flags]` | `PostToolUse` | `tool_input.file_path`, `cwd` | the written file's basename is `AGENTS.md` or `CLAUDE.md` |
| `plan-context` | `UserPromptSubmit` | `permission_mode`, `session_id`, `cwd` | `permission_mode` is `plan`, and this session has not been told yet |
| `new-context` | `UserPromptExpansion` | `command_args`, `cwd` | the first word of `command_args` is `adr`, `rfc`, `plan` or `task` |

**`ops` is a reserved first word.** That surface takes an arbitrary ops name, so the reservation is what
keeps a third-party ops from shadowing a surface, and a surface added later from shadowing an ops.

### Common contract

- **Exit 0 on every path a hook can reach.** These are advisory surfaces, never blocking ones: a finding
  that cannot be fixed is reported in `additionalContext`, not enforced by exit code.
- **Exit 2 only for a missing or unknown surface**, with the valid set named on stderr. This is the one
  case that is not a hook outcome — it is a malformed registration, and a typo must not read as the hook
  having nothing to say.
- **Silence is the default outcome.** No output at all is the normal result; a line of JSON reaches stdout
  only when there is something to report.
- **A malformed payload, an unresolvable ops, or a declared `records.*` path that does not exist produce
  no output and exit 0** — fail silent, never fail open while appearing to work (ADR-0009, obligation 3).
  The sensor for a broken *registration* is
  [`25-hooks-registration.sh`](../../cli/packages/module-check/sh/checks/25-hooks-registration.sh), not
  this process's exit code.
- **Output is exactly one line of JSON**, shaped
  `{"hookSpecificOutput":{"hookEventName":"<event>","additionalContext":"<text>"}}`.

### `ops <ops> [flags]`

Runs `<ops> --file <the written path>` with the caller's own flags and reports what it found or repaired.
`--fix <gates>` repairs only the gates it names. Both sides of the path comparison are realpath-ed, so a
payload path and a `git rev-parse --show-toplevel` root agree even where `/tmp` resolves through
`/private/tmp`.

A `--file` run **emits no observation**, even when the ops entry declares `emits: true`: a per-write
reading of one file is a different signal from a repository sweep. See
[`cli/AGENTS.md`](../../cli/AGENTS.md#gates-and-ops).

### `plan-context`

Emits this repository's plan format, its next plan number, and the living-section names read from the
plan template's own `LIVING SECTIONS` markers — never a list written down a second time.

- **Once per session.** The marker is `vibe-ops-plan-mode-<session_id>` in `$CLAUDE_PLUGIN_DATA`, falling
  back to `$TMPDIR`, then `/tmp`. It is deleted at `SessionEnd` by
  [`session-state-cleanup.sh`](../../plugin/hooks/session-state-cleanup.sh) and, for a session that
  crashed, by the age sweep in [`plan-progress-nudge.sh`](../../plugin/hooks/plan-progress-nudge.sh). A
  state directory that cannot be written costs a repeated injection, never a failed hook.
- **Says nothing** when the repository keeps no plans (`DIR` unresolved) or has no plan template.
- **`$CLAUDE_PROJECT_DIR`**, when set and different from the resolved repository root, adds a request for
  the plan's own `| Repository | <path> |` row. A single-repo session never sees that sentence.

### `new-context`

Emits the resolved layout for the record type named as the first word of the arguments, so the `/new`
skill does not resolve it a second time. Registered with the matcher `^vibe-ops:new$`.

## Where a hook is registered

Two shapes, and only the second is scoped to a skill's lifetime.

### `plugin/hooks/hooks.json` — always on

Auto-discovered; there is no manifest entry. A hook here fires in **every** repository where the plugin is
installed, so each one's first act is its own cheap exit.

```json
{ "type": "command", "command": "vibe-ops", "args": ["hook", "plan-context"], "timeout": 10 }
```

The `command` names `vibe-ops` directly — no `sh`, no wrapper, no `command -v` guard. A machine without
the CLI on `PATH` gets a loud failure rather than an install that looks like it works
([`cli/README.md`](../../cli/README.md) has the `npm link` recipe).

The file's top-level `description` states how many **shipped `.sh` scripts** are registered, and
`25-hooks-registration.sh` checks that number against the registrations. A `command: "vibe-ops"` entry
ships no script and does not count toward it.

### A skill's `hooks:` frontmatter — installed while the skill is active

```yaml
hooks:
  PostToolUse:
    - matcher: "Write|Edit|MultiEdit"
      hooks:
        - type: command
          command: vibe-ops
          args: ["hook", "ops", "agents-md", "--fix", "pairing"]
          timeout: 10
```

Installed when the skill loads, gone when it finishes. Combined with `paths:` the chain costs nothing
standing — but `paths:` makes a skill *eligible* to load, and does not guarantee the load fires; a skill
that was never invoked installs no hook. `25-hooks-registration.sh` validates this block's shape too.

## What `plugin/hooks/` still ships as shell

These are registrations, not CLI surfaces. Each is listed with what keeps it out of the namespace above.

| Script | Event | Why it is still a script |
|---|---|---|
| [`task-dossier-guard.sh`](../../plugin/hooks/task-dossier-guard.sh) | `PreToolUse` (`Bash`) | not yet ported |
| [`plan-approved-copy.sh`](../../plugin/hooks/plan-approved-copy.sh) | `PostToolUse` (`ExitPlanMode`) | not yet ported |
| [`plan-progress-nudge.sh`](../../plugin/hooks/plan-progress-nudge.sh) | `Stop` | its body is session-transcript bookkeeping, which is not governance logic and has no CLI noun; it calls `vibe-ops plan resolve` for the part that is |
| [`session-state-cleanup.sh`](../../plugin/hooks/session-state-cleanup.sh) | `SessionEnd` | session bookkeeping, deliberately out of scope |

## Exercising one

A hook surface is exercised by feeding it a real payload on a real stdin — a hand-built object passed to
the function does not test the transport.

```sh
npm link -w @entelekheia/vibe-ops-cli    # from the repository root

printf '{"session_id":"x","permission_mode":"plan","cwd":"'"$PWD"'"}' | vibe-ops hook plan-context
printf '{"command_args":"plan Add X","cwd":"'"$PWD"'"}'               | vibe-ops hook new-context
printf '{"tool_input":{"file_path":"'"$PWD"'/AGENTS.md"}}'            | vibe-ops hook ops agents-md --fix pairing
```

`claude --plugin-dir <this tree>` is the loop for a real session; it bypasses the versioned install cache,
which under the release freeze never refreshes itself. A headless `claude -p` run **does not deliver a
`Stop` hook**, and each `-p` invocation ends its session, so session-scoped behaviour has to be exercised
in a real session or against fixtures.
