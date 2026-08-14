# Bring a repository up to a newer norm

**Goal:** a repository that already has governance records, written against an older version of the
templates, ends up on the current one — with the records themselves brought along rather than left behind
declaring a shape they no longer have.

**Two versions move independently, and confusing them is the mistake this page exists to prevent.**

| Version | Lives in | Answers |
|---|---|---|
| what a **record** was written against | that record's own `vibe-ops-template:` frontmatter | "which shape is this file?" |
| what was **promulgated** into this clone | `vibeops.config.local.json` | "which norm did this repository receive?" |

They diverge exactly when something has not been migrated yet, and that divergence is the thing worth
detecting. Storing one would not give you the other.

## 1. The signal usually finds you

Opening a session in a repository whose promulgated version is behind the installed one injects a note
saying which record types are behind and by how much. When they match it says **nothing at all** — the
comparison is self-clearing, so there is no switch anyone has to remember to turn off after the work is
done.

To ask directly:

```bash
vibe-ops harness status .
vibe-ops records census .        # every record and the template version each declares
```

A type absent from the map is **not** reported as behind. Never promulgated to is a different state from
being on an old version, and a signal that fires in every repository is one nobody reads.

## 2. Migrate the records first, then promulgate

Order matters, and it is the opposite of what most people reach for.

```bash
/vibe-ops:migrate .              # brings existing records up, one recorded jump at a time
vibe-ops harness sync . --dry-run
vibe-ops harness sync .
```

Migrating first means the records are already in the current shape when the new templates land, so a
reader never meets a repository whose template says one thing and whose records say another. Migration
reads each record's own frontmatter stamp and applies the recorded note for each version jump; **a jump
with no note stops the run** rather than being invented.

## 3. What "behind" does not mean

`template-version-behind` is a warning rather than a failure, deliberately. A template bump leaves every
record behind at once, which is correct mid-migration and wrong for a repository that has finished one. If
your repository has finished, raise it in config rather than living with a permanent warning:

```ts
export default { settings: { governance: { level: { "template-version-behind": "fail" } } } };
```

## 4. Upgrading the tooling itself

The plugin is installed as a **copy** into a version-keyed cache, so a newer clone does not become a newer
install on its own. Under the current version freeze the copy made on install day runs forever. See
[install and verify](install-and-verify.md) §3 — the two commands are `uninstall` + `install` to re-copy,
or `claude --plugin-dir` to bypass the cache entirely.

The CLI is different: `npm link` points at your working tree, so a rebuild is live.

```bash
npm run build     # the linked CLI now runs the new code
```

## 5. When a repository has a real backlog

A gate handed over red is the one that gets switched off in its first week — and `--no-verify` switches
off every other check at the same time. So do not hand one over red. Declare the failing check off, with
a reason, in that repository's own config:

```ts
export default { settings: { governance: { disabled: { "record-header-rfc": "still migrating" } } } };
```

It then reports `SKIP` naming the reason instead of running, which is a ledger entry rather than a silent
pass. `disabled` takes a **reason string, never a boolean**, precisely so that `git grep` over these is a
debt register.

## Troubleshooting

| Symptom | Cause |
|---|---|
| The session says nothing and you expected a warning | the versions match, or this clone was never promulgated to — `harness status` distinguishes them |
| `migrate` stops on a jump | there is no recorded note for it; one has to be written before the jump can be applied |
| `sync` refuses paths after an upgrade | the ownership boundary widened — [what the norm owns](../explanation/what-the-norm-owns.md) |
| Records look migrated but the warning persists | the records moved; the *promulgated* version did not. Run `sync`. |

## Related

- [How to promulgate the norm into a repository](promulgate-the-norm.md) — the mechanics of the write.
- [What the norm owns](../explanation/what-the-norm-owns.md) — why some files are overwritten and others
  never are.
