---
"@entelekheia/vibe-ops-cli": minor
---

The terminal surface stops writing prompt framing into pipes, and gains `--ui` and `--no-ui`

Every summary, error and `--help` block — all but the summary of a `--print` run, which goes to stderr
raw so it never lands inside the document — now goes through one render layer that decides, once per run,
whether stdout is a person at a terminal or a machine. A pipe, a Claude Code hook, continuous integration, or `CI` /
`NO_COLOR` in the environment gets plain lines — so a green `vibe-ops check` piped anywhere no longer
carries the orphaned `│` and the `◆` bullet it used to. An interactive terminal gets a glyph and colour.
`--ui` forces the rich output and `--no-ui` the plain one, anywhere on the command line; `--json` outranks
both.

A refused flag or unknown verb now prints `error: <message>` in plain mode. Every line keeps the stream it
had: the summary of a failing run stays on stdout, where consumer gates read `N checks, M failed`.

A module's `--help` lists its own flags under `flags:` and the two CLI-wide ones under
`flags on every command:`.
