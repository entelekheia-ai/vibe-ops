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
| `plan-file` | `PostToolUse` (`ExitPlanMode`) | `tool_response.plan`, `tool_response.filePath`, `cwd` | the approved plan has an H1 and a `Status` row |
| `new-context` | `UserPromptExpansion` | `command_args`, `cwd` | the first word of `command_args` is `adr`, `rfc`, `plan` or `task` |
| `task-guard` | `PreToolUse` | `tool_input.command`, `cwd` | the command deletes a `tasks/*.md` whose closure box is unchecked |
| `prefer-mcp` **(temporary)** | `PreToolUse` | `tool_input.command`, `cwd` | the command invokes a `vibe-ops` module that is also an MCP tool |
| `harness-status --plugin <dir>` | `SessionStart` | `cwd` | a record type's promulgated version is older than the installed template's |
| `check-global` | `Stop` | `cwd`, `stop_hook_active` | the repository declares a `vibeops.config.*` of its own — **and then it reports whether or not anything failed**, the one surface here that speaks on a clean run |

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
  [`25-hooks-registration.sh`](../../cli/packages/module-check/sh/unported/checks/25-hooks-registration.sh), not
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

### `plan-file`

Files an approved plan-mode plan as `<next>-<slug>.md` and reports where it landed. **The hook firing at
all already means approved**: `PostToolUse` fires only on success, and a manual rejection is excluded from
`PostToolUseFailure` and `PermissionDenied` too — so for this one tool there is no outcome to branch on.

Which repository is decided by the plan's own `| Repository |` row when it has one, read from the header
table rather than by matching a line; otherwise by the payload's `cwd`, resolved to its git toplevel. That
row is then **dropped from the filed copy** — it is routing metadata for this step and the one thing in a
plan that is an absolute path on somebody's machine.

Confirmed unusable headless: `ExitPlanMode` does not exist as a callable tool under `claude -p` at all.
That is a headless-only fact and does not apply to the interactive sessions this runs in.

### `new-context`

Emits the resolved layout for the record type named as the first word of the arguments, so the `/new`
skill does not resolve it a second time. Registered with the matcher `^vibe-ops:new$`.

### `task-guard`

**The one surface that answers `permissionDecision: "deny"` rather than `additionalContext`.** It is a
guard, not an observation: the act it stops — deleting a task dossier by hand — is not recoverable, and
everything the dossier taught is promoted during closure, so the file going first loses it silently.

It invents no convention. The task template ships the marker, and the box is read by the same function
`vibe-ops task close` ticks through, so the guard and the ceremony cannot disagree about what closed
means. A dossier from a repository that never adopted the convention has no such line and is not
blocked — absence is not a refusal.

### `prefer-mcp` — temporary

Names the MCP tool equivalent to a `vibe-ops` command just issued through Bash. **It never returns a
`permissionDecision`**, in any branch: `task-guard` is the hook that refuses things on `Bash`, and the two
share an event without competing because their conditions are disjoint by construction — one fires on a
deletion, the other on an invocation of `vibe-ops <module>`, and no single command is both.

Silent for: a hook surface or `mcp` (not modules, so no tool exists), a **destructive** verb (over MCP its
consent is a `confirm: true` the caller sets itself, weaker than a skill's `--dry-run` preview shown to a
person — nudging toward it would be a downgrade, not a migration), a command already passing `--json`, and
any module the config does not expose.

**Its success condition is its own deletion.** When the CLI form stops appearing in transcripts, remove
`prefer-mcp.ts`, its entry in `HOOK_SURFACES`, and its registration. A migration nudge that outlives its
migration is a tax on every Bash call.

### `harness-status --plugin <dir>`

Compares the version of each record type **promulgated** into the repository being opened — the
`harness.applied` map in `vibeops.config.local.*` — against what the installed templates declare, and
reports only the types that are behind.

**Silence is its normal outcome, and the design point.** It runs at the start of every session in every
repository the operator opens, and almost none of them have anything pending. It says nothing when the
versions match, nothing when a type was never promulgated (absence is a state, not version zero), and
nothing when the repository is *ahead* of an older installed plugin. Comparing only what someone actually
promulgated is what keeps precision at 1 by construction — a signal that fires in unrelated repositories
is one people stop reading.

**It reports and never writes**, however obvious the repair looks. Whether a hook may configure a
repository the operator merely opened is
[RFC-0002](../../project/rfc/0002-bootstrapping-a-repository-and-what-auto-configuration-may-decide.md)'s
first open question, and answering it as a side effect of being helpful is what that RFC exists to
prevent.

**It is the only surface besides `ops` that takes arguments.** `--plugin` is where the installed versions
are read from, passed explicitly because the registration expands `${CLAUDE_PLUGIN_ROOT}` for exactly this
— a module is handed one repository root, and the source/target seam does not exist yet. No `--plugin`, an
unreadable directory, or a malformed payload: silence and exit 0. Every error path fails open, because an
advisory hook must never be why a session does not start.

## A hook is never an MCP tool

`type: command` is a process invocation: a hook cannot call a tool, and nothing here can be "moved to
MCP". The two surfaces answer different questions — a hook fires on an *event* nobody asked about, a tool
is called *because* someone asked. What did move is the **skills**: `close-task` and `close-plan` name the
`task`/`plan` tools first and the shell form as the fallback, and the plugin ships the server that
provides them (`mcpServers` in `plugin.json`, started as `vibe-ops mcp` off `PATH`).

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
(`npm i -g @entelekheia/vibe-ops-cli`; [`cli/README.md`](../../cli/README.md) has both recipes).

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
