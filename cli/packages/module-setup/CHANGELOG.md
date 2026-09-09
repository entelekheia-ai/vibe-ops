# @entelekheia/vibe-ops-module-setup

## 0.2.0

### Minor Changes

- c3741f0: `vibe-ops setup plan|scaffold <target> [NAME=value …]` — the scaffold as a composition of what the target activates, never a template directory of its own (project/plans/040-\*.md Track 6). Every file comes from a package that declares it in its own `scaffold`, each record template is read from the package that owns the type rather than from a second copy, each type's records directory comes from its `dirs`, and the two governance documents are rendered from the activated types.

  `plan` and `scaffold` are the same traversal, and `plan` writes nothing: a dry run implemented separately is a second implementation, and what it would drift about is what a tool is about to write into somebody's repository.

  Three properties worth naming, each covered by a test. A destination that already exists is kept and reported, not overwritten — this is the FIRST write into a repository, where the honest default is that anything already there was put there by someone; `--force <path>` names an exception. `GOVERNANCE.md` is `shaped`: a second run re-renders the lifecycles and leaves every other line of the file alone. And a placeholder nobody answered is left standing rather than emptied, because `{{PKG_NAME}}` in a written file is visible and greppable while an empty string where a name belongs is a file that looks finished and is not.

### Patch Changes

- Updated dependencies [54a6052]
- Updated dependencies [adb3c7a]
- Updated dependencies [c7d4e3c]
- Updated dependencies [e259e4a]
- Updated dependencies [47f5a8e]
- Updated dependencies [cd42823]
- Updated dependencies [c3741f0]
  - @entelekheia/governance-base@0.2.0
  - @entelekheia/vibe-ops-core@0.2.0
