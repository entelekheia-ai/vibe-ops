// `composedOwnership` reports every repository-layer entry's origin as the literal string `"repository"`
// (`harness/src/ownership.ts:218`) — it discards the finer `<layer>:<file>` the narrowing itself carries
// since Plan-032 Track 2 (`OwnershipNarrowing.origin`, set by `loadConfig`'s `tagOwnershipOrigin`),
// because a `ComposedEntry` is deliberately a smaller shape than the config entry it came from. This
// noun is the first reader that needs the finer answer, so it looks the narrowing back up by its exact
// `match` rather than widening `ComposedEntry` itself — a shape change to `composedOwnership` would touch
// every existing assertion pinned to the literal `"repository"` (`harness/test/ownership.test.ts`) for a
// need only this module has so far.

import type { ComposedEntry } from "@entelekheia/vibe-ops-harness";
import type { OwnershipNarrowing, VibeOpsConfig } from "@entelekheia/vibe-ops-core";

/** `entry.origin` when it already names a fragment (`"harness"`, a package name); otherwise the
 *  `<layer>:<file>` of the repository's own narrowing for this exact match, falling back to the bare
 *  `"repository"` composedOwnership already reports when the config carries no such narrowing (a pinned
 *  tree's own declaration, or a narrowing this composition resolved from elsewhere). Last match wins,
 *  same as `classOf`/`entryFor` — a config with two entries for the same match is legal, and the later
 *  one is the one that decided. */
export function originFor(entry: ComposedEntry, config: VibeOpsConfig | undefined): string {
  if (entry.origin !== "repository") return entry.origin;
  let found: string | undefined;
  for (const narrowing of config?.ownership ?? []) {
    if (narrowing.match === entry.match && (narrowing as OwnershipNarrowing).origin !== undefined) {
      found = (narrowing as OwnershipNarrowing).origin;
    }
  }
  return found ?? "repository";
}
