## License rules

**License headers are mandatory on every source file** (`{{SOURCE_GLOB}}`). Before committing, ensure the
correct header is present at the very top of the file. Headers are SPDX identifiers, not copyright prose —
per [ASF's own current practice](https://www.apache.org/legal/src-headers.html), a copyright line per file
is not recommended (it goes stale the moment anyone else touches the file); copyright lives collectively in
[`NOTICE`](NOTICE) + [`AUTHORS`](AUTHORS), where contributors retain their own copyright.

The pre-commit hook classifies each file from **the header it already has**:

- **No header at all** (brand new file): `// SPDX-License-Identifier: {{LICENSE_ID}}`
<!-- FORK_ONLY:start -->
- **Old block header mentioning {{ORIGIN_LICENSE_SHORT}} *and* {{LICENSE_ID}}/{{PROJECT_NAME}}** (modified
  legacy — carried over from {{ORIGIN_PROJECT}} and changed here): migrated to
  `// SPDX-License-Identifier: {{LICENSE_ID}} AND {{ORIGIN_LICENSE_SHORT}}` + a one-line pointer to `NOTICE`
  ({{ORIGIN_LICENSE_SHORT}} requires the original notice be retained; `NOTICE` carries it).
- **Old block header mentioning {{ORIGIN_LICENSE_SHORT}} only, no {{LICENSE_ID}}/{{PROJECT_NAME}} marker**
  (unmodified legacy — never touched by this project): left completely untouched, never relicensed.
<!-- FORK_ONLY:end -->
- **Old block header with no {{ORIGIN_LICENSE_SHORT}} mention** (sole {{PROJECT_NAME}} authorship): migrated
  to plain `{{LICENSE_ID}}`.

Migration is **opportunistic, on touch** — staging a file that still carries an old copyright-prose block
replaces it with the SPDX form in that same commit. Files nobody touches keep their old (still valid) header;
there is no repo-wide retrofit.

Two layers enforce this: the git-native pre-commit hook (`scripts/ensure-license-headers.sh`, wired via
`core.hooksPath=.githooks`, set by the `prepare` npm script — no husky) injects/migrates and re-stages
headers locally, and the `License headers` CI workflow runs the same script in `--check` mode so
`--no-verify` or a missing hook cannot merge unlicensed code. If you add a file programmatically and bypass
the hook, inject the header manually before staging. Never remove or alter existing license headers.
