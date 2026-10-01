---
"@entelekheia/vibe-ops-module-check": patch
---

`vibe-ops check --self-test` no longer acts on the real repository when it runs inside a git hook. The
throwaway fixture repository is now built with every `GIT_*` variable removed from the environment, so a
`GIT_DIR` or `GIT_INDEX_FILE` that a hook exports can no longer outrank `git -C` — before this, a commit made
from a linked worktree could flip `core.bare` to `true` in the shared config and stage the fixture's files
into the real index.
