// RFC-0004 §4, gate 3: `vibeops.config.local.json`, the retired state layer, still present at the
// toplevel. `loadConfig` already reports it in `leave` — never read — so this gate only names it and
// points at the ceremony that retires it, rather than re-deriving the retirement rule.

import { defineGate, loadConfig, STATE_FILENAME } from "@entelekheia/vibe-ops-core";
import type { GateFinding } from "@entelekheia/vibe-ops-core";
import path from "node:path";

export default defineGate(
  {
    id: "config-state-leftover",
    version: 1,
    summary: "vibeops.config.local.json — the retired state layer — still exists at the toplevel",
  },
  async ({ repoRoot }) => {
    const { leave } = await loadConfig(repoRoot);
    const resolvedRoot = path.resolve(repoRoot);
    const found = leave.find(
      (entry) => path.basename(entry.file) === STATE_FILENAME && path.dirname(entry.file) === resolvedRoot,
    );
    if (found === undefined) {
      return { findings: [], skipped: `no ${STATE_FILENAME} at the toplevel` };
    }
    const findings: GateFinding[] = [
      {
        rule: "config-state-leftover",
        file: STATE_FILENAME,
        evidence: `${STATE_FILENAME} is the retired state layer — the next harness sync moves its map into vibeops.config.json and deletes it`,
      },
    ];
    return { findings, examined: 1 };
  },
);
