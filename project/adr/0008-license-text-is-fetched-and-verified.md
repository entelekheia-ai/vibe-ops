<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0008: License text is fetched and checksum-verified, never authored

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-01 |
| Deciders | Danilo Borges |

---

## Context

`license-setup` shipped `templates/LICENSE-apache-2.0` and copied it into every repository it scaffolded.
That file was not the Apache License. It was a paraphrase of it:

- §1 — the definitions of *Work*, *Contribution* and *Contributor* reworded. The rewritten *Contribution*
  says a contribution `is submitted in the "as-is" basis, without any warranty or guarantee of interest`,
  which is not a legal statement of anything.
- §3 — the patent-termination clause rewritten.
- §4(d) — the entire `NOTICE` treatment rewritten.
- §4, close — replaced with a sentence from the MIT license: `sell copies of the Work, and to permit
  persons to whom the Work is furnished to do so, subject to the following conditions:` — followed by no
  conditions at all. MIT's structure grafted into an Apache document.
- §7 — the disclaimer rewritten.

Measured against `https://www.apache.org/licenses/LICENSE-2.0.txt` (203 lines, sha256 `cfc7749b…523d30`),
the shipped template was missing 61 lines of the official text and carried 56 lines that are not in it.
The audit method was validated against a control — an unrelated npm package's Apache-2.0 `LICENSE` — which
came back with 0 lines missing and 0 extra, so the method does not produce false positives.

Seven distinct corrupted variants were found across the workspace, including one in this plugin's own
`LICENSE`, which did not even match the template it ships. Nothing detected any of it: a `LICENSE` is
written once at scaffold time and never read again, and a paraphrase of a legal document reads fluently,
sounds legal, and passes every review a human gives it. **A repository whose `LICENSE` is not the Apache
License is not licensed the way it declares** — which makes this the one file in a scaffold where a
plausible-sounding approximation is unrecoverable rather than merely sloppy.

The origin is not copy corruption. Prose that flows and is wrong in exactly the operative clauses is what
a model produces when it fills a template from memory instead of from the source.

## Decision

**We will never author, edit, reflow, trim or reproduce license text — the skill fetches it and verifies
it against a pinned sha256, or it writes nothing.**

- `skills/license-setup/licenses/SOURCES.tsv` pins, per SPDX id: the canonical URL, the sha256 of the
  upstream file, and the sha256 of its *canonical text*.
- `skills/license-setup/get-license.sh fetch <id>` serves the bundled pristine copy when it matches its
  pin and falls back to `curl` when it does not, verifying either way. A mismatch is a hard failure that
  writes nothing; re-pinning is a deliberate maintainer act (`get-license.sh pin`), never automatic.
- The **only** edit made to a fetched file is the year and holder inside the Apache appendix boilerplate.
- `get-license.sh verify <file>` is run before the step is considered done, and the target repo gets
  `scripts/verify-license-text.sh` + a CI workflow so the property is asserted forever, not once.
- `scripts/checks/90-license-texts.sh` asserts the same inside this repository, this plugin's own
  `LICENSE` included.

*Canonical text* means: everything from the license's own "how to apply this license" section onward
dropped (Apache's `APPENDIX:`, the GPL family's `How to Apply These Terms to Your New Programs` — the
blocks a repo fills in with its program name, year and holder), standalone `Copyright …` lines dropped,
whitespace collapsed. The holder legitimately varies and apache.org's 72-column wrapping and SPDX's
reflowed text are the same license; every operative word must be identical.

Fifteen licenses ship pinned — the permissive set, the GPL family, and the three Creative Commons licenses
used for documentation. Breadth is deliberate: an id that is not pinned is the moment somebody reaches for
a text they wrote themselves, which is the failure this ADR exists to remove.

## Options considered

- **Option A — keep the bundled template, proofread it once.** Fixes today's file and nothing else. The
  next edit, the next license, the next model asked to "update the LICENSE" reintroduces it, silently.
- **Option B — depend on a package that ships license texts** (`spdx-license-list` on npm, GitHub's
  `licensee`, FSF's `reuse`). Rejected on three counts: this plugin has no build and no `package.json`
  and target repos are polyglot, so a language-runtime dependency does not travel; `licensee` is a *fuzzy*
  similarity matcher built to detect which license a file resembles — the wrong instrument, since
  resembling Apache-2.0 is precisely what the corrupted text did; and a package that bundles the texts
  moves the trust to someone else's copy without ever verifying it, which is the failure being fixed.
  `reuse download` does do the right thing, but adopting it drags in the whole REUSE layout (`LICENSES/`,
  SPDX headers on every file) for one file's worth of benefit.
- **Option C — fetch at scaffold time, no bundled copy.** Simple and always canonical, but breaks offline
  and puts a network round-trip in the middle of a scaffold.
- **Option D (chosen) — pinned digest as the trust anchor, bundled copy as a verified cache, curl as
  fallback, and a check at both ends.** Deterministic (the same bytes offline or online), offline-capable,
  and a corrupted bundle can only fail loudly or be bypassed by the network — never served.

## Consequences

- Adding a license is now a two-command act with a human in the loop (`pin`, then read the text), instead
  of an agent writing a file. Deliberate friction, in the one place that deserves it.
- The pins must be maintained if upstream republishes. Apache-2.0's text is frozen in practice, and a
  changed upstream *should* stop the world rather than flow through — which is what a hard failure does.
- Repos scaffolded before this ADR carry corrupted `LICENSE` files. They are not fixed by this change;
  `get-license.sh verify LICENSE` identifies them, and replacing each is the maintainer's call.
- This plugin's own `LICENSE` was replaced with the official text (holder line preserved) as part of the
  change, and is now covered by the guard.
- The convention is now explicit: the `APPENDIX:` block stays in the file. A repo that keeps only the
  boilerplate and drops the appendix header fails verification. That is a deliberate narrowing — one
  shape, mechanically checkable.

## Related

- [ADR-0004](0004-budgeted-artifacts-and-guards.md) — anything mechanically checkable becomes a guard;
  this is that policy applied to the one artifact nobody re-reads.
- [ADR-0007](0007-license-enforcement-writes-no-git-config.md) — the previous correction to the same skill.
- [`skills/license-setup/SKILL.md`](../../skills/license-setup/SKILL.md) Step 2 / 2b.
