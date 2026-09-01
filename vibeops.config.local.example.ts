// Committed sample for `vibeops.config.local.ts`, which is version-control-ignored.
//
// WHY THE SAMPLE EXISTS. An ignored file with no committed counterpart is invisible to anyone who did not
// create it: there is nothing to grep, nothing in a diff, and no way to learn which keys are even legal.
// This is the same reason an `.env.example` sits beside a `.env`.
//
// WHAT BELONGS HERE RATHER THAN IN `vibeops.config.ts`. Anything true of ONE working tree on ONE machine.
// The local file LAYERS over the committed one — it does not replace it — so it only ever needs to name
// the handful of keys it overrides, and every key it omits falls through to the committed file. The pair
// repeats at every level of the cascade up to your home directory, so a personal default that should
// apply to every repository belongs in `~/vibeops.config.local.ts` rather than being copied into each.
//
// The directory walk still outranks the pair: a repository's own committed file beats a local file
// further up. A personal override cannot silently govern a repository that declared its own answer.
//
// To use: copy to `vibeops.config.local.ts` and delete what you do not need. An empty file is fine and is
// the normal state — most clones need none of this.

import type { VibeOpsConfig } from "@entelekheia/vibe-ops-core";

export default {
  // Which version of each record type was PROMULGATED into this clone. Written by promulgation and read
  // by the session hook; you would not normally hand-edit it.
  //
  // This is not the same fact as the `vibe-ops-template:` line inside a given record — that says what
  // THAT ARTIFACT was written against. The two diverge exactly when something has not been migrated yet,
  // which is the case worth detecting, so neither can be derived from the other.
  //
  // Absence is a state and it is NOT zero: no `harness` key means this clone has never been promulgated
  // to, and a missing entry means the same about that one record type. Nothing may default either to a
  // number — an untouched repository reported as catastrophically behind is how a signal earns being
  // ignored.
  harness: {
    applied: { adr: 2, rfc: 2, plan: 3, task: 3, log: 2 },
  },

  // Where observations go. Overriding this per clone is the intended use of the local file: the committed
  // value points inside the git directory on purpose, and an operator who wants them elsewhere says so
  // here rather than in a file everyone shares.
  // artifactDir: ".git/gate-artifacts",
} satisfies VibeOpsConfig;
