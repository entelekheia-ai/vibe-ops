// A publishable package whose NAME has never reached the registry — the one step in this repository's
// release that a workflow cannot take.
//
// WHY IT EXISTS. Under trusted publishing the workflow authenticates itself against a package that
// already exists; it cannot CREATE a name. So a release containing a new package name publishes every
// package ahead of it in dependency order, then 404s, and publication does not undo. Measured
// 2026-09-09: six packages reached npm at 0.2.0 and the seventh, `@entelekheia/governance-instructions`,
// stopped the run — leaving the workspace half-released with `main` declaring versions the registry did
// not have.
//
// THE FINDING'S AUDIENCE IS A PERSON, WHICH IS WHY THIS IS A GATE AND NOT A CI STEP. Nothing automated
// can clear it: somebody has to log in and publish the name once. A detector that runs while the work is
// happening reports that at a moment when it can still be arranged; the same fact discovered by the
// release run is discovered at the one moment nobody can act on it.
//
// IT DETECTS AND DECIDES NOTHING. `level: "warn"` is the default a commit inherits — the fact changes
// about once per package, not once per commit, and blocking every commit on it would be the reason
// somebody switches the hook off. The publish path calls the same detector and refuses on any finding,
// which is the ops-owns-the-consequence split (RFC-0001) rather than two copies of the check.

import { defineGate } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Whether the registry knows this NAME at all — deliberately not `<name>/<version>`, which answers a
 *  different question and is the conflation this gate exists to undo: a 404 there means "the package OR
 *  the version is new", and only one of those two can be published by a workflow. */
export async function nameOnRegistry(name: string): Promise<boolean | undefined> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${name}`, { method: "HEAD" });
    if (response.status === 404) return false;
    if (response.ok) return true;
    return undefined; // A 5xx is not an answer, and guessing one is how a gate reports a fact it never read.
  } catch {
    return undefined; // Offline. Distinguished from "not published" below, because they are opposite claims.
  }
}

/** Every package in `files` that would be published — a manifest without `private: true`. */
export function publishableNames(repoRoot: string, files: readonly string[]): readonly string[] {
  const names: string[] = [];
  for (const file of files) {
    if (path.basename(file) !== "package.json") continue;
    try {
      const manifest = JSON.parse(readFileSync(path.join(repoRoot, file), "utf8")) as {
        name?: string;
        private?: boolean;
      };
      if (manifest.private === true || typeof manifest.name !== "string") continue;
      names.push(manifest.name);
    } catch {
      continue; // A manifest that does not parse is another gate's finding, not this one's.
    }
  }
  return names;
}

export default defineGate(
  {
    id: "registry-first-publish",
    version: 1,
    summary: "Every publishable package name already exists on the registry, so a release can publish it",
    // The workspace's own manifests. Overridable by the composing ops, like every default scope.
    defaultPaths: ["cli/packages/*/package.json"],
  },
  async ({ repoRoot, files }) => {
    const names = publishableNames(repoRoot, files);
    if (names.length === 0) {
      return { findings: [], skipped: "no publishable package manifest in this population" };
    }

    const findings: GateFinding[] = [];
    let examined = 0;
    let unreachable = 0;

    for (const name of names) {
      const known = await nameOnRegistry(name);
      if (known === undefined) {
        unreachable += 1;
        continue;
      }
      examined += 1;
      if (known) continue;
      findings.push({
        rule: "registry-first-publish",
        // A PERSON, NOT A PIPELINE, CLEARS THIS, so warning is the honest default while the work is
        // happening: the fact changes about once per package, and blocking every commit on it is how a
        // hook gets switched off. The level lives on the FINDING and not on the definition —
        // `GateDefinition` has no such field, and `ops.ts:543` falls back to `finding.level ?? "fail"`,
        // so a gate that declares it in the wrong place fails loudly while looking configured.
        level: "warn",
        evidence:
          `${name} has never been published, so a release cannot create it — trusted publishing ` +
          `authenticates against a package that already exists. Publish it once by hand ` +
          `(\`npm publish --access public\` from its directory), then the workflow carries it.`,
      });
    }

    // COULD NOT ASK IS NOT AN ANSWER. A run with no network reports a skip naming that, never a pass:
    // "every name exists" and "I reached none of them" are indistinguishable in a record, and only one
    // of them is a reading.
    if (examined === 0) {
      return { findings: [], skipped: `the registry answered for none of ${names.length} package(s) — offline, or it is down` };
    }
    // A PARTIAL ANSWER REPORTS ITS OWN SIZE. `examined` below `names.length` is how a reader sees that
    // some names went unasked; inventing a second field for it would put the same fact in two places.
    return { findings, examined };
  },
);
