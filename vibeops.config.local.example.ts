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
  // NOT HERE: `harness.applied`, `harness.boundary`, `harness.agreed`. Which version of each record type
  // was promulgated, under which boundary, is a fact about the tree, not about one clone — it lives in
  // the committed `vibeops.config.json` (the managed layer, RFC-0004), written by `harness sync` inside
  // the promulgation commit. A copy in this file is stripped at load and never consulted.

  // Where observations go. Overriding this per clone is the intended use of the local file: the committed
  // value points inside the git directory on purpose, and an operator who wants them elsewhere says so
  // here rather than in a file everyone shares.
  // artifactDir: ".git/gate-artifacts",
} satisfies VibeOpsConfig;
